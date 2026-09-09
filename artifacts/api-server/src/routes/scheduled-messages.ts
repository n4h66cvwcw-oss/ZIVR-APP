import { Router } from "express";
import pool, { query, queryOne } from "../lib/db";
import { getAuthUserId } from "../lib/auth";
import { getIO, checkContentForChild } from "../lib/socket";
import { sendExpoPush } from "../lib/push";
import {
  checkDirectContactAllowed,
  checkGroupContactsAllowed,
  requestApprovalAndNotifyParents,
  MAX_GROUP_MEMBERS,
} from "../lib/approvals";
import { logger } from "../lib/logger";

const router = Router();
const MIN_LEAD_MS = 30_000;
const MAX_LEAD_MS = 366 * 24 * 60 * 60 * 1000;
const DISPATCH_INTERVAL_MS = 5_000;

type ScheduledRow = {
  id: string;
  sender_id: string;
  chat_id: string;
  chat_name: string | null;
  text: string;
  scheduled_for: string | number;
  status: "pending" | "sending" | "sent" | "cancelled" | "failed";
  created_at: string | number;
  updated_at: string | number;
  sent_message_id: string | null;
  failure_reason: string | null;
};

function serialize(row: ScheduledRow) {
  return {
    id: row.id,
    chatId: row.chat_id,
    chatName: row.chat_name ?? "Chat",
    text: row.text,
    scheduledFor: Number(row.scheduled_for),
    status: row.status,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    sentMessageId: row.sent_message_id,
    failureReason: row.failure_reason,
  };
}

function parseInput(body: unknown, partial = false) {
  const value = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const text = typeof value.text === "string" ? value.text.trim() : undefined;
  const scheduledFor = typeof value.scheduledFor === "number" ? value.scheduledFor : undefined;
  const now = Date.now();

  if (!partial && typeof value.chatId !== "string") return { error: "chatId is required" };
  if (!partial && text === undefined) return { error: "text is required" };
  if (text !== undefined && (text.length === 0 || text.length > 2000)) {
    return { error: "Message must be between 1 and 2000 characters" };
  }
  if (!partial && scheduledFor === undefined) return { error: "scheduledFor is required" };
  if (scheduledFor !== undefined && (!Number.isFinite(scheduledFor) || scheduledFor < now + MIN_LEAD_MS)) {
    return { error: "Scheduled time must be at least 30 seconds in the future" };
  }
  if (scheduledFor !== undefined && scheduledFor > now + MAX_LEAD_MS) {
    return { error: "Scheduled time must be within one year" };
  }
  if (partial && text === undefined && scheduledFor === undefined) {
    return { error: "Provide text or scheduledFor to update" };
  }
  return {
    chatId: typeof value.chatId === "string" ? value.chatId : undefined,
    text,
    scheduledFor,
  };
}

async function getChatPermission(chatId: string, senderId: string) {
  const chat = await queryOne<{ type: "direct" | "group"; name: string | null }>(
    `SELECT c.type, c.name
       FROM vm_chats c
       JOIN vm_chat_members cm ON cm.chat_id = c.id
      WHERE c.id = $1 AND cm.user_id = $2`,
    [chatId, senderId],
  );
  if (!chat) return { allowed: false as const, status: 404, error: "Chat not found or sender is not a member" };

  const members = await query<{ user_id: string }>(
    `SELECT user_id FROM vm_chat_members WHERE chat_id = $1`,
    [chatId],
  );
  if (chat.type === "direct") {
    const other = members.find((member) => member.user_id !== senderId);
    if (other) {
      const check = await checkDirectContactAllowed(senderId, other.user_id);
      if (!check.allowed) {
        if (check.status === "pending") void requestApprovalAndNotifyParents(check.unapprovedPairs);
        return { allowed: false as const, status: 403, error: check.status === "blocked"
          ? "This contact has been blocked by a parent."
          : "Waiting for parent approval before scheduling messages to this contact." };
      }
    }
  } else {
    if (members.length > MAX_GROUP_MEMBERS) {
      return { allowed: false as const, status: 403, error: `This group has more than ${MAX_GROUP_MEMBERS} members.` };
    }
    const check = await checkGroupContactsAllowed(members.map((member) => member.user_id));
    if (!check.allowed) {
      void requestApprovalAndNotifyParents(check.unapprovedPairs);
      return { allowed: false as const, status: 403, error: check.status === "blocked"
        ? "This group includes a contact who has been blocked by a parent."
        : "Waiting for parent approval before scheduling messages in this group." };
    }
  }
  return { allowed: true as const, chatName: chat.name };
}

router.get("/", async (req, res) => {
  const senderId = getAuthUserId(req);
  if (!senderId) return res.status(401).json({ error: "Authentication required" });
  const rows = await query<ScheduledRow>(
    `SELECT sm.*, COALESCE(c.name, other.display_name, 'Chat') AS chat_name
       FROM vm_scheduled_messages sm
       JOIN vm_chats c ON c.id = sm.chat_id
       LEFT JOIN LATERAL (
         SELECT u.display_name FROM vm_chat_members cm
         JOIN vm_users u ON u.id = cm.user_id
         WHERE cm.chat_id = sm.chat_id AND cm.user_id != sm.sender_id LIMIT 1
       ) other ON true
      WHERE sm.sender_id = $1 AND sm.status IN ('pending', 'sending')
      ORDER BY sm.scheduled_for ASC`,
    [senderId],
  );
  return res.json({ scheduledMessages: rows.map(serialize) });
});

router.post("/", async (req, res) => {
  const senderId = getAuthUserId(req);
  if (!senderId) return res.status(401).json({ error: "Authentication required" });
  const input = parseInput(req.body);
  if ("error" in input) return res.status(400).json({ error: input.error });
  const permission = await getChatPermission(input.chatId!, senderId);
  if (!permission.allowed) return res.status(permission.status).json({ error: permission.error });

  const now = Date.now();
  const row = await queryOne<ScheduledRow>(
    `INSERT INTO vm_scheduled_messages
       (sender_id, chat_id, text, scheduled_for, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'pending', $5, $5)
     RETURNING *, $6::text AS chat_name`,
    [senderId, input.chatId, input.text, input.scheduledFor, now, permission.chatName ?? "Chat"],
  );
  return res.status(201).json(serialize(row!));
});

router.patch("/:scheduledMessageId", async (req, res) => {
  const senderId = getAuthUserId(req);
  if (!senderId) return res.status(401).json({ error: "Authentication required" });
  const input = parseInput(req.body, true);
  if ("error" in input) return res.status(400).json({ error: input.error });
  const existing = await queryOne<ScheduledRow>(
    `SELECT sm.*, COALESCE(c.name, 'Chat') AS chat_name
       FROM vm_scheduled_messages sm JOIN vm_chats c ON c.id = sm.chat_id
      WHERE sm.id = $1 AND sm.sender_id = $2`,
    [req.params.scheduledMessageId, senderId],
  );
  if (!existing) return res.status(404).json({ error: "Scheduled message not found" });
  if (existing.status !== "pending") return res.status(409).json({ error: "This message is already being sent" });

  const row = await queryOne<ScheduledRow>(
    `UPDATE vm_scheduled_messages
        SET text = COALESCE($3, text),
            scheduled_for = COALESCE($4, scheduled_for),
            updated_at = $5
      WHERE id = $1 AND sender_id = $2 AND status = 'pending'
      RETURNING *, $6::text AS chat_name`,
    [existing.id, senderId, input.text ?? null, input.scheduledFor ?? null, Date.now(), existing.chat_name],
  );
  if (!row) return res.status(409).json({ error: "This message is already being sent" });
  return res.json(serialize(row));
});

router.delete("/:scheduledMessageId", async (req, res) => {
  const senderId = getAuthUserId(req);
  if (!senderId) return res.status(401).json({ error: "Authentication required" });
  const result = await queryOne<{ id: string }>(
    `UPDATE vm_scheduled_messages
        SET status = 'cancelled', updated_at = $3
      WHERE id = $1 AND sender_id = $2 AND status = 'pending'
      RETURNING id`,
    [req.params.scheduledMessageId, senderId, Date.now()],
  );
  if (!result) return res.status(404).json({ error: "Pending scheduled message not found" });
  return res.status(204).send();
});

async function dispatchDueMessages() {
  const now = Date.now();
  await query(
    `UPDATE vm_scheduled_messages SET status = 'pending', updated_at = $1
      WHERE status = 'sending' AND updated_at < $2`,
    [now, now - 120_000],
  );
  const due = await query<ScheduledRow>(
    `UPDATE vm_scheduled_messages
        SET status = 'sending', updated_at = $1
      WHERE id IN (
        SELECT id FROM vm_scheduled_messages
         WHERE status = 'pending' AND scheduled_for <= $1
         ORDER BY scheduled_for ASC LIMIT 25
         FOR UPDATE SKIP LOCKED
      )
      RETURNING *, NULL::text AS chat_name`,
    [now],
  );

  for (const item of due) {
    try {
      const permission = await getChatPermission(item.chat_id, item.sender_id);
      if (!permission.allowed) {
        await query(
          `UPDATE vm_scheduled_messages SET status = 'failed', failure_reason = $2, updated_at = $3
            WHERE id = $1 AND status = 'sending'`,
          [item.id, permission.error, Date.now()],
        );
        continue;
      }

      const sender = await queryOne<{ display_name: string }>(
        `SELECT display_name FROM vm_users WHERE id = $1`,
        [item.sender_id],
      );
      const createdAt = Date.now();
      const client = await pool.connect();
      let messageId: string | null = null;
      try {
        await client.query("BEGIN");
        const inserted = await client.query<{ id: string }>(
          `INSERT INTO vm_messages (chat_id, sender_id, text, type, created_at)
           SELECT chat_id, sender_id, text, 'text', $2
             FROM vm_scheduled_messages
            WHERE id = $1 AND status = 'sending'
           RETURNING id`,
          [item.id, createdAt],
        );
        messageId = inserted.rows[0]?.id ?? null;
        if (messageId) {
          await client.query(`UPDATE vm_chats SET last_message_at = $1 WHERE id = $2`, [createdAt, item.chat_id]);
          await client.query(
            `UPDATE vm_scheduled_messages
                SET status = 'sent', sent_message_id = $2, updated_at = $3
              WHERE id = $1 AND status = 'sending'`,
            [item.id, messageId, createdAt],
          );
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
      if (!messageId) continue;

      const outgoing = {
        id: messageId,
        chatId: item.chat_id,
        senderId: item.sender_id,
        senderName: sender?.display_name ?? "Unknown",
        text: item.text,
        type: "text",
        createdAt,
      };
      getIO()?.to(`chat:${item.chat_id}`).emit("message:new", outgoing);
      void checkContentForChild(messageId, item.chat_id, item.sender_id, item.text);

      const offline = await query<{ push_token: string | null }>(
        `SELECT u.push_token FROM vm_chat_members cm
          JOIN vm_users u ON u.id = cm.user_id
         WHERE cm.chat_id = $1 AND cm.user_id != $2 AND u.is_online = false`,
        [item.chat_id, item.sender_id],
      );
      const tokens = offline.map((member) => member.push_token)
        .filter((token): token is string => !!token && token.startsWith("ExponentPushToken"));
      if (tokens.length) {
        const preview = item.text.length > 80 ? `${item.text.slice(0, 80)}…` : item.text;
        await sendExpoPush(tokens, sender?.display_name ?? "New message", preview, "default");
      }
    } catch (error) {
      logger.error({ err: error, scheduledMessageId: item.id }, "Scheduled message dispatch failed");
      await query(
        `UPDATE vm_scheduled_messages SET status = 'pending', updated_at = $2
          WHERE id = $1 AND status = 'sending'`,
        [item.id, Date.now()],
      ).catch(() => {});
    }
  }
}

let timer: ReturnType<typeof setInterval> | null = null;
export function startScheduledMessageDispatcher() {
  if (timer) return;
  void dispatchDueMessages();
  timer = setInterval(() => void dispatchDueMessages(), DISPATCH_INTERVAL_MS);
}

export default router;