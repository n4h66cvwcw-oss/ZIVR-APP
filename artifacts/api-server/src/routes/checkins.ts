import { Router, type Request, type Response } from "express";
import pool, { query, queryOne } from "../lib/db";
import { getAuthUserId } from "../lib/auth";
import {
  checkGroupContactsAllowed,
  requestApprovalAndNotifyParents,
  MAX_GROUP_MEMBERS,
} from "../lib/approvals";
import { emitCheckinBroadcastCreated, emitCheckinReplyCreated } from "../lib/socket";

const router = Router();
const MAX_TEXT = 2000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type GroupRow = {
  id: string;
  name: string;
  description: string | null;
  anonymous: boolean;
  creator_id: string;
  created_at: number;
  member_ids: string[];
  member_count: number;
};

function auth(req: Request, res: Response): string | null {
  const userId = getAuthUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Invalid or missing auth token" });
    return null;
  }
  return userId;
}

function groupJson(group: GroupRow, viewerId: string) {
  // Do not disclose the other members of a private group to recipients.
  const memberIds = group.creator_id === viewerId
    ? group.member_ids
    : group.member_ids.filter((id) => id === viewerId || id === group.creator_id);
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    anonymous: group.anonymous,
    creatorId: group.creator_id,
    createdAt: Number(group.created_at),
    memberIds,
    memberCount: Number(group.member_count),
  };
}

async function loadGroup(groupId: string, userId: string): Promise<GroupRow | null> {
  return queryOne<GroupRow>(
    `SELECT g.id, g.name, g.description, g.anonymous, g.creator_id, g.created_at,
            ARRAY_AGG(gm.user_id::text ORDER BY gm.joined_at) AS member_ids,
            COUNT(gm.user_id)::int AS member_count
       FROM vm_checkin_groups g
       JOIN vm_checkin_group_members visible ON visible.group_id = g.id AND visible.user_id = $2
       JOIN vm_checkin_group_members gm ON gm.group_id = g.id
      WHERE g.id = $1
      GROUP BY g.id`,
    [groupId, userId],
  );
}

function replyJson(row: {
  id: string;
  client_id?: string | null;
  member_id: string;
  text: string;
  audio_attachment: unknown;
  created_at: number;
  read_at: number | null;
}) {
  return {
    id: row.id,
    clientId: row.client_id ?? undefined,
    memberId: row.member_id,
    text: row.text,
    audioAttachment: row.audio_attachment ?? undefined,
    timestamp: Number(row.created_at),
    read: row.read_at != null,
  };
}

async function loadBroadcast(broadcastId: string, userId: string) {
  const broadcast = await queryOne<{
    id: string; group_id: string; creator_id: string; client_id: string | null; text: string;
    audio_attachment: unknown; deadline: number | null; created_at: number;
  }>(
    `SELECT b.id, b.group_id, b.creator_id, b.client_id, b.text, b.audio_attachment, b.deadline, b.created_at
       FROM vm_broadcasts b
       JOIN vm_checkin_group_members gm ON gm.group_id = b.group_id AND gm.user_id = $2
      WHERE b.id = $1`,
    [broadcastId, userId],
  );
  if (!broadcast) return null;
  const replies = await query<{
    id: string; member_id: string; client_id: string | null; text: string; audio_attachment: unknown;
    created_at: number; read_at: number | null;
  }>(
    `SELECT id, member_id, client_id, text, audio_attachment, created_at, read_at
       FROM vm_checkin_replies
      WHERE broadcast_id = $1
        AND ($2 = (SELECT creator_id FROM vm_broadcasts WHERE id = $1) OR member_id = $2)
      ORDER BY created_at ASC`,
    [broadcastId, userId],
  );
  const replyMap: Record<string, ReturnType<typeof replyJson>[]> = {};
  replies.forEach((reply) => {
    (replyMap[reply.member_id] ??= []).push(replyJson(reply));
  });
  const progress = await queryOne<{ total: number; replied: number }>(
    `SELECT COUNT(DISTINCT gm.user_id)::int AS total,
            COUNT(DISTINCT r.member_id)::int AS replied
       FROM vm_broadcasts b
       JOIN vm_checkin_group_members gm
         ON gm.group_id = b.group_id AND gm.user_id != b.creator_id
       LEFT JOIN vm_checkin_replies r
         ON r.broadcast_id = b.id AND r.member_id = gm.user_id
      WHERE b.id = $1`,
    [broadcastId],
  );
  return {
    id: broadcast.id,
    groupId: broadcast.group_id,
    senderId: broadcast.creator_id,
    text: broadcast.text,
    audioAttachment: broadcast.audio_attachment ?? undefined,
    deadline: broadcast.deadline == null ? undefined : Number(broadcast.deadline),
    timestamp: Number(broadcast.created_at),
    replies: replyMap,
    ...(broadcast.creator_id === userId ? {
      progress: {
        total: Number(progress?.total ?? 0),
        replied: Number(progress?.replied ?? 0),
      },
    } : {}),
    clientId: broadcast.client_id ?? undefined,
  };
}

async function enforceGroupContacts(memberIds: string[]): Promise<{ allowed: boolean; status: "approved" | "pending" | "blocked" }> {
  const check = await checkGroupContactsAllowed(memberIds);
  if (!check.allowed) await requestApprovalAndNotifyParents(check.unapprovedPairs);
  return check;
}

router.post("/groups", async (req, res) => {
  const creatorId = auth(req, res);
  if (!creatorId) return;
  try {
    const { name, description, anonymous = false, memberIds } = req.body as {
      name?: string; description?: string; anonymous?: boolean; memberIds?: string[];
    };
    if (!name?.trim() || !Array.isArray(memberIds) || memberIds.length > MAX_GROUP_MEMBERS) {
      res.status(400).json({ error: "A name and a valid member list are required." });
      return;
    }
    const members = [...new Set([creatorId, ...memberIds])];
    if (members.length > MAX_GROUP_MEMBERS || members.some((id) => !UUID_PATTERN.test(id))) {
      res.status(400).json({ error: `Groups can have up to ${MAX_GROUP_MEMBERS} members.` });
      return;
    }
    const users = await query<{ id: string }>(
      `SELECT id FROM vm_users WHERE id = ANY($1::uuid[])`, [members],
    );
    if (users.length !== members.length) {
      res.status(400).json({ error: "One or more group members could not be found." });
      return;
    }
    const contactCheck = await enforceGroupContacts(members);
    if (!contactCheck.allowed) {
      res.status(403).json({
        error: contactCheck.status === "blocked"
          ? "This group includes a contact who has been blocked by a parent."
          : "Waiting for parent approval before you can create this check-in group.",
        approval: contactCheck.status,
      });
      return;
    }
    const client = await pool.connect();
    let groupId: string;
    try {
      await client.query("BEGIN");
      const group = await client.query<{ id: string }>(
        `INSERT INTO vm_checkin_groups (name, description, anonymous, creator_id)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [name.trim(), description?.trim() || null, Boolean(anonymous), creatorId],
      );
      groupId = group.rows[0]!.id;
      for (const memberId of members) {
        await client.query(
          `INSERT INTO vm_checkin_group_members (group_id, user_id) VALUES ($1, $2)`,
          [groupId, memberId],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    const created = await loadGroup(groupId!, creatorId);
    res.status(201).json({ group: groupJson(created!, creatorId) });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "error" });
  }
});

router.get("/groups", async (req, res) => {
  const userId = auth(req, res);
  if (!userId) return;
  try {
    const groups = await query<GroupRow>(
      `SELECT g.id, g.name, g.description, g.anonymous, g.creator_id, g.created_at,
              ARRAY_AGG(gm.user_id::text ORDER BY gm.joined_at) AS member_ids,
              COUNT(gm.user_id)::int AS member_count
         FROM vm_checkin_groups g
         JOIN vm_checkin_group_members mine ON mine.group_id = g.id AND mine.user_id = $1
         JOIN vm_checkin_group_members gm ON gm.group_id = g.id
        GROUP BY g.id
        ORDER BY g.created_at DESC`,
      [userId],
    );
    res.json({ groups: groups.map((group) => groupJson(group, userId)) });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "error" });
  }
});

router.get("/groups/:groupId", async (req, res) => {
  const userId = auth(req, res);
  if (!userId) return;
  try {
    const group = await loadGroup(req.params.groupId, userId);
    if (!group) { res.status(403).json({ error: "Not a member of this check-in group." }); return; }
    res.json({ group: groupJson(group, userId) });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "error" });
  }
});

router.get("/groups/:groupId/broadcasts", async (req, res) => {
  const userId = auth(req, res);
  if (!userId) return;
  try {
    const group = await loadGroup(req.params.groupId, userId);
    if (!group) { res.status(403).json({ error: "Not a member of this check-in group." }); return; }
    const rows = await query<{ id: string }>(
      `SELECT id FROM vm_broadcasts WHERE group_id = $1 ORDER BY created_at DESC LIMIT 200`,
      [req.params.groupId],
    );
    const broadcasts = [];
    for (const row of rows) {
      const item = await loadBroadcast(row.id, userId);
      if (item) broadcasts.push(item);
    }
    res.json({ broadcasts });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "error" });
  }
});

router.post("/groups/:groupId/broadcasts", async (req, res) => {
  const creatorId = auth(req, res);
  if (!creatorId) return;
  try {
    const group = await loadGroup(req.params.groupId, creatorId);
    if (!group) { res.status(404).json({ error: "Check-in group not found." }); return; }
    if (group.creator_id !== creatorId) { res.status(403).json({ error: "Only the group creator can broadcast." }); return; }
    const contactCheck = await enforceGroupContacts(group.member_ids);
    if (!contactCheck.allowed) {
      res.status(403).json({
        error: contactCheck.status === "blocked"
          ? "This group includes a contact who has been blocked by a parent."
          : "Waiting for parent approval before broadcasting.",
        approval: contactCheck.status,
      });
      return;
    }
    const { text = "", audioAttachment, deadline, clientId } = req.body as {
      text?: string; audioAttachment?: unknown; deadline?: number; clientId?: string;
    };
    if (typeof text !== "string" || text.length > MAX_TEXT || (!text.trim() && !audioAttachment)) {
      res.status(400).json({ error: "Broadcast text or audio is required." });
      return;
    }
    const existing = clientId ? await queryOne<{ id: string }>(
      `SELECT id FROM vm_broadcasts WHERE creator_id = $1 AND client_id = $2`,
      [creatorId, clientId],
    ) : null;
    if (existing) {
      const broadcast = await loadBroadcast(existing.id, creatorId);
      res.json({ broadcast, existed: true });
      return;
    }
    let row = await queryOne<{ id: string }>(
      `INSERT INTO vm_broadcasts (group_id, creator_id, text, audio_attachment, deadline, client_id)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6)
       ON CONFLICT (creator_id, client_id) WHERE client_id IS NOT NULL DO NOTHING
       RETURNING id`,
      [group.id, creatorId, text, audioAttachment == null ? null : JSON.stringify(audioAttachment),
        deadline ?? null, clientId ?? null],
    );
    let existed = Boolean(existing);
    if (!row && clientId) {
      row = await queryOne<{ id: string }>(
        `SELECT id FROM vm_broadcasts WHERE creator_id = $1 AND client_id = $2`,
        [creatorId, clientId],
      );
      existed = Boolean(row);
    }
    const broadcast = await loadBroadcast(row!.id, creatorId);
    if (!existed) await emitCheckinBroadcastCreated(row!.id);
    res.status(existed ? 200 : 201).json({ broadcast, existed });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "error" });
  }
});

router.get("/broadcasts", async (req, res) => {
  const userId = auth(req, res);
  if (!userId) return;
  try {
    const rows = await query<{ id: string }>(
      `SELECT b.id FROM vm_broadcasts b
        JOIN vm_checkin_group_members gm ON gm.group_id = b.group_id AND gm.user_id = $1
       ORDER BY b.created_at DESC LIMIT 200`, [userId],
    );
    const broadcasts = [];
    for (const row of rows) {
      const item = await loadBroadcast(row.id, userId);
      if (item) broadcasts.push(item);
    }
    res.json({ broadcasts });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "error" });
  }
});

router.get("/broadcasts/:broadcastId", async (req, res) => {
  const userId = auth(req, res);
  if (!userId) return;
  try {
    const broadcast = await loadBroadcast(req.params.broadcastId, userId);
    if (!broadcast) { res.status(403).json({ error: "Broadcast not found." }); return; }
    res.json({ broadcast });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "error" });
  }
});

router.post("/broadcasts/:broadcastId/replies", async (req, res) => {
  const memberId = auth(req, res);
  if (!memberId) return;
  try {
    const broadcast = await queryOne<{ id: string; group_id: string; creator_id: string }>(
      `SELECT b.id, b.group_id, b.creator_id FROM vm_broadcasts b WHERE b.id = $1`,
      [req.params.broadcastId],
    );
    if (!broadcast) { res.status(404).json({ error: "Broadcast not found." }); return; }
    const membership = await queryOne<{ user_id: string }>(
      `SELECT user_id FROM vm_checkin_group_members WHERE group_id = $1 AND user_id = $2`,
      [broadcast.group_id, memberId],
    );
    if (!membership || broadcast.creator_id === memberId) {
      res.status(403).json({ error: "Only a group member may reply." });
      return;
    }
    const memberRows = await query<{ user_id: string }>(
      `SELECT user_id FROM vm_checkin_group_members WHERE group_id = $1`, [broadcast.group_id],
    );
    const contactCheck = await enforceGroupContacts(memberRows.map((row) => row.user_id));
    if (!contactCheck.allowed) {
      res.status(403).json({
        error: contactCheck.status === "blocked"
          ? "This group includes a contact who has been blocked by a parent."
          : "Waiting for parent approval before replying.",
        approval: contactCheck.status,
      });
      return;
    }
    const { text = "", audioAttachment, clientId } = req.body as {
      text?: string; audioAttachment?: unknown; clientId?: string;
    };
    if (typeof text !== "string" || text.length > MAX_TEXT || (!text.trim() && !audioAttachment)) {
      res.status(400).json({ error: "Reply text or audio is required." });
      return;
    }
    const existing = clientId ? await queryOne<{ id: string }>(
      `SELECT id FROM vm_checkin_replies
        WHERE broadcast_id = $1 AND member_id = $2 AND client_id = $3`,
      [broadcast.id, memberId, clientId],
    ) : null;
    let replyId = existing?.id;
    let existed = Boolean(existing);
    if (!replyId) {
      let row = await queryOne<{ id: string }>(
        `INSERT INTO vm_checkin_replies (broadcast_id, member_id, text, audio_attachment, client_id)
         VALUES ($1, $2, $3, $4::jsonb, $5)
         ON CONFLICT (broadcast_id, member_id, client_id) WHERE client_id IS NOT NULL DO NOTHING
         RETURNING id`,
        [broadcast.id, memberId, text, audioAttachment == null ? null : JSON.stringify(audioAttachment),
          clientId ?? null],
      );
      if (!row && clientId) {
        row = await queryOne<{ id: string }>(
          `SELECT id FROM vm_checkin_replies
            WHERE broadcast_id = $1 AND member_id = $2 AND client_id = $3`,
          [broadcast.id, memberId, clientId],
        );
        existed = Boolean(row);
      }
      replyId = row!.id;
    }
    const reply = await queryOne<{
      id: string; member_id: string; client_id: string | null; text: string; audio_attachment: unknown;
      created_at: number; read_at: number | null;
    }>(
      `SELECT id, member_id, client_id, text, audio_attachment, created_at, read_at
         FROM vm_checkin_replies WHERE id = $1`, [replyId],
    );
    if (!existed) await emitCheckinReplyCreated(replyId!);
    res.status(existed ? 200 : 201).json({ reply: { ...replyJson(reply!), broadcastId: broadcast.id } , existed });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "error" });
  }
});

router.post("/broadcasts/:broadcastId/read", async (req, res) => {
  const userId = auth(req, res);
  if (!userId) return;
  try {
    const broadcast = await queryOne<{ creator_id: string }>(
      `SELECT creator_id FROM vm_broadcasts WHERE id = $1`, [req.params.broadcastId],
    );
    if (!broadcast || broadcast.creator_id !== userId) {
      res.status(403).json({ error: "Only the broadcast creator can mark replies read." });
      return;
    }
    await query(
      `UPDATE vm_checkin_replies SET read_at = COALESCE(read_at, $1) WHERE broadcast_id = $2`,
      [Date.now(), req.params.broadcastId],
    );
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "error" });
  }
});

export default router;