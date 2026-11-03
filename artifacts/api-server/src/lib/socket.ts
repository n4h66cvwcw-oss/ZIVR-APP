import { Server as HttpServer } from "http";
import { Server as SocketServer, Socket } from "socket.io";
import { query, queryOne } from "./db";
import { messagePushData, sendExpoPush } from "./push";
import { verifyToken } from "./auth";
import { USER_AWAY_EVENT, accountIsOnline, readSocketPresence } from "./presence-push";
import { fanoutEvent, fanoutMessage, pushTokensForChat, startRealtimeBus } from "./realtime-bus";
import {
  checkDirectContactAllowed,
  checkGroupContactsAllowed,
  MAX_GROUP_MEMBERS,
  requestApprovalAndNotifyParents,
} from "./approvals";
import { shouldNotifyForSeverity } from "./content-alert-preferences";
import {
  MAX_MESSAGE_REQUEST_BYTES,
  mediaJsonParam,
  messagePreview,
  prepareOutgoingMessage,
  serializedMessageFromRow,
  type MessageMedia,
} from "./message-content";
import { deliverSubProfileMessage, noteHumanCiphertext, notifyChatAgents, rejectAgentMemberSend } from "./agent-delivery";
import Anthropic from "@anthropic-ai/sdk";

let ioInstance: SocketServer | null = null;

/** Access the live Socket.io server from outside (e.g. HTTP routes). */
export function getIO(): SocketServer | null {
  return ioInstance;
}

const anthropic = new Anthropic({
  apiKey: process.env["AI_INTEGRATIONS_ANTHROPIC_API_KEY"],
  baseURL: process.env["AI_INTEGRATIONS_ANTHROPIC_BASE_URL"],
});

const CONTENT_ALERT_COOLDOWN_MS = 5 * 60 * 1000;

type ContentAlertDecision = {
  shouldNotify: boolean;
  missedCount: number;
};

/**
 * Atomically claim the next content alert for one parent/child pair.
 *
 * The row lock makes concurrent moderation checks safe: exactly one flag can
 * open a new cooldown window, while all others increment the suppressed count.
 */
async function claimContentAlert(
  parentId: string,
  childId: string,
  now: number,
): Promise<ContentAlertDecision> {
  const decision = await queryOne<ContentAlertDecision>(
    `WITH current AS (
       SELECT content_alert_last_sent_at, content_alert_suppressed_count
         FROM vm_parent_child
        WHERE parent_id = $1 AND child_id = $2
        FOR UPDATE
     ),
     decision AS (
       SELECT content_alert_last_sent_at,
              content_alert_suppressed_count,
              (
                content_alert_last_sent_at IS NULL
                OR content_alert_last_sent_at <= CAST($3 AS BIGINT) - CAST($4 AS BIGINT)
              ) AS should_notify
         FROM current
     )
     UPDATE vm_parent_child pc
        SET content_alert_last_sent_at = CASE
              WHEN decision.should_notify THEN CAST($3 AS BIGINT)
              ELSE decision.content_alert_last_sent_at
            END,
            content_alert_suppressed_count = CASE
              WHEN decision.should_notify THEN 0
              ELSE COALESCE(decision.content_alert_suppressed_count, 0) + 1
            END
       FROM decision
      WHERE pc.parent_id = $1 AND pc.child_id = $2
      RETURNING decision.should_notify AS "shouldNotify",
                COALESCE(decision.content_alert_suppressed_count, 0)::int AS "missedCount"`,
    [parentId, childId, now, CONTENT_ALERT_COOLDOWN_MS],
  );

  return decision ?? { shouldNotify: false, missedCount: 0 };
}

// Fire-and-forget: check message for inappropriate content if sender or any
// recipient is a child account. Stores flags in vm_content_flags.
export async function checkContentForChild(
  messageId: string,
  chatId: string,
  senderId: string,
  text: string
): Promise<void> {
  try {
    if (!text || text.length < 3) return;

    // Find all child members of this chat (including sender if they're a child)
    const childMembers = await query<{ userId: string }>(
      `SELECT u.id AS "userId"
         FROM vm_chat_members cm
         JOIN vm_users u ON u.id = cm.user_id
        WHERE cm.chat_id = $1 AND u.account_type = 'child'`,
      [chatId]
    );

    if (childMembers.length === 0) return;

    const prompt = `You are a child-safety content moderation system. Analyze the following message for content inappropriate for minors (under 18). Look for: sexual content, violence, drug/alcohol references, bullying, grooming, hate speech, or other harmful content.

Message: "${text}"

Respond with JSON only (no markdown): { "flagged": true/false, "severity": "low"|"medium"|"high", "reason": "brief explanation or null" }
Only flag if genuinely concerning. Normal conversation should not be flagged.`;

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 150,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    const parsed = JSON.parse(raw) as { flagged: boolean; severity: string; reason: string | null };

    if (!parsed.flagged) return;

    // Insert a flag row for each child member of this chat
    for (const { userId } of childMembers) {
      await query(
        `INSERT INTO vm_content_flags (child_id, message_id, chat_id, sender_id, flagged_text, severity, ai_reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, messageId, chatId, senderId, text.slice(0, 500), parsed.severity, parsed.reason]
      );

      // Store every flag, but only notify each parent when their selected
      // minimum severity allows it. The cooldown still applies per parent/child.
      if (parsed.severity === "low" || parsed.severity === "medium" || parsed.severity === "high") {
        const child = await queryOne<{ display_name: string }>(
          `SELECT display_name FROM vm_users WHERE id = $1`,
          [userId]
        );

        const parents = await query<{
          id: string;
          push_token: string | null;
          content_alert_min_severity: string | null;
        }>(
          `SELECT u.id, u.push_token
                  , u.content_alert_min_severity
             FROM vm_parent_child pc
             JOIN vm_users u ON u.id = pc.parent_id
            WHERE pc.child_id = $1`,
          [userId]
        );

        const childName = child?.display_name ?? "your child";
        for (const parent of parents) {
          if (!shouldNotifyForSeverity(parsed.severity, parent.content_alert_min_severity)) continue;

          const parentToken = parent.push_token;
          if (!parentToken || !parentToken.startsWith("ExponentPushToken")) continue;

          const decision = await claimContentAlert(parent.id, userId, Date.now());
          if (!decision.shouldNotify) continue;

          const missedSuffix = decision.missedCount > 0
            ? ` and ${decision.missedCount} more`
            : "";
          await sendExpoPush(
            [parentToken],
            "⚠️ ZIVR Safety Alert",
            `ZIVR flagged a message in ${childName}'s chat${missedSuffix}`,
            "default"
          );
        }
      }
    }
  } catch {
    // Content check failures are silent — never block message delivery
  }
}

export type ServerMessage = {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  text: string;
  type: string;
  createdAt: number;
  localId?: string;
  media?: MessageMedia;
};

const onlineUsers = new Map<string, string>();

type CheckinReplyRow = {
  id: string;
  client_id?: string | null;
  member_id: string;
  text: string;
  audio_attachment: unknown;
  created_at: number;
  read_at: number | null;
};

async function hydrateCheckinBroadcast(broadcastId: string, userId: string) {
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
  const replies = await query<CheckinReplyRow>(
    `SELECT id, member_id, client_id, text, audio_attachment, created_at, read_at
       FROM vm_checkin_replies
      WHERE broadcast_id = $1
        AND ($2 = (SELECT creator_id FROM vm_broadcasts WHERE id = $1) OR member_id = $2)
      ORDER BY created_at ASC`,
    [broadcastId, userId],
  );
  const replyMap: Record<string, unknown[]> = {};
  for (const reply of replies) {
    (replyMap[reply.member_id] ??= []).push({
      id: reply.id,
      clientId: reply.client_id ?? undefined,
      memberId: reply.member_id,
      text: reply.text,
      audioAttachment: reply.audio_attachment ?? undefined,
      timestamp: Number(reply.created_at),
      read: reply.read_at != null,
    });
  }
  const progress = broadcast.creator_id === userId ? await checkinProgress(broadcastId) : null;
  return {
    id: broadcast.id,
    groupId: broadcast.group_id,
    senderId: broadcast.creator_id,
    text: broadcast.text,
    audioAttachment: broadcast.audio_attachment ?? undefined,
    deadline: broadcast.deadline == null ? undefined : Number(broadcast.deadline),
    timestamp: Number(broadcast.created_at),
    replies: replyMap,
    ...(progress ? { progress: {
      total: Number(progress?.total ?? 0),
      replied: Number(progress?.replied ?? 0),
    } } : {}),
    clientId: broadcast.client_id ?? undefined,
  };
}

export async function emitCheckinBroadcastCreated(broadcastId: string): Promise<void> {
  const row = await queryOne<{ group_id: string; creator_id: string }>(
    `SELECT group_id, creator_id FROM vm_broadcasts WHERE id = $1`, [broadcastId],
  );
  if (!row || !ioInstance) return;
  const members = await query<{ user_id: string }>(
    `SELECT user_id FROM vm_checkin_group_members WHERE group_id = $1`, [row.group_id],
  );
  for (const member of members) {
    const broadcast = await hydrateCheckinBroadcast(broadcastId, member.user_id);
    if (broadcast) ioInstance.to(`user:${member.user_id}`).emit("checkin:new", broadcast);
  }
  const progress = await checkinProgress(broadcastId);
  ioInstance.to(`user:${row.creator_id}`).emit("checkin:progress", {
    broadcastId, total: Number(progress?.total ?? 0), replied: Number(progress?.replied ?? 0),
  });
}

export async function emitCheckinReplyCreated(replyId: string): Promise<void> {
  if (!ioInstance) return;
  const row = await queryOne<{
    id: string; broadcast_id: string; member_id: string; client_id: string | null; text: string;
    audio_attachment: unknown; created_at: number; read_at: number | null; creator_id: string;
  }>(
    `SELECT r.id, r.broadcast_id, r.member_id, r.client_id, r.text, r.audio_attachment,
            r.created_at, r.read_at, b.creator_id
       FROM vm_checkin_replies r JOIN vm_broadcasts b ON b.id = r.broadcast_id
      WHERE r.id = $1`, [replyId],
  );
  if (!row) return;
  const reply = {
    id: row.id, broadcastId: row.broadcast_id, clientId: row.client_id ?? undefined,
    memberId: row.member_id, text: row.text,
    audioAttachment: row.audio_attachment ?? undefined, timestamp: Number(row.created_at),
    read: row.read_at != null,
  };
  ioInstance.to(`user:${row.creator_id}`).emit("checkin:reply", reply);
  ioInstance.to(`user:${row.member_id}`).emit("checkin:reply", reply);
  const progress = await checkinProgress(row.broadcast_id);
  ioInstance.to(`user:${row.creator_id}`).emit("checkin:progress", {
    broadcastId: row.broadcast_id, total: Number(progress?.total ?? 0), replied: Number(progress?.replied ?? 0),
  });
}

async function checkinProgress(broadcastId: string) {
  return queryOne<{ total: number; replied: number }>(
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
}

type CheckinBroadcastAck =
  | { ok: true; broadcast: Awaited<ReturnType<typeof hydrateCheckinBroadcast>> }
  | { ok: false; error: string };
type CheckinReplyAck =
  | { ok: true; reply: { id: string; broadcastId: string; clientId?: string; memberId: string; text: string; audioAttachment?: unknown; timestamp: number; read: boolean } }
  | { ok: false; error: string };

export function attachSocket(httpServer: HttpServer): SocketServer {
  const io = new SocketServer(httpServer, {
    path: "/api/socket.io",
    cors: { origin: "*", methods: ["GET", "POST"] },
    transports: ["websocket", "polling"],
    // Default is 1 MiB, which drops an inline image before message:send runs.
    maxHttpBufferSize: MAX_MESSAGE_REQUEST_BYTES,
  });

  ioInstance = io;
  startRealtimeBus(io);

  io.on("connection", (socket: Socket) => {
    let currentUserId: string | null = null;

    socket.on("user:join", async (payload: string | { userId: string; since?: number }) => {
      // Accept both legacy string form and new object form { userId, since }
      const userId = typeof payload === "string" ? payload : payload.userId;
      const since = typeof payload === "object" ? payload.since : undefined;

      // Identity must be proven by the signed token from the socket handshake —
      // a client cannot join as an arbitrary user id.
      const tokenUserId = verifyToken(socket.handshake.auth?.["token"] as string | undefined);
      if (!tokenUserId || tokenUserId !== userId) {
        // A connection that was previously joined must not retain its old
        // identity after a forged re-join attempt.
        currentUserId = null;
        socket.emit("error", { message: "Authentication failed — invalid or missing token" });
        return;
      }

      currentUserId = userId;
      const joined = socket.data as { userId?: string; presence?: "active" | "away" };
      joined.userId = userId;
      // user:join is the foreground signal (connect, and AppState "active").
      joined.presence = "active";
      onlineUsers.set(userId, socket.id);

      await query(
        `UPDATE vm_users SET is_online = true, last_seen = $1 WHERE id = $2`,
        [Date.now(), userId]
      );

      const chats = await query<{ id: string }>(
        `SELECT chat_id as id FROM vm_chat_members WHERE user_id = $1`,
        [userId]
      );
      chats.forEach(({ id }) => { void socket.join(`chat:${id}`); });
      socket.join(`user:${userId}`);

      io.to(`user:${userId}`).emit("user:online", { userId, online: true });
      socket.emit("user:joined", { userId, chatRooms: chats.map((c) => c.id) });

      // Check-in rooms are only used for membership bookkeeping. Payloads are
      // still sent to per-user rooms so a recipient never learns other members'
      // replies (or an unrelated group's broadcasts).
      const checkinGroups = await query<{ id: string }>(
        `SELECT group_id AS id FROM vm_checkin_group_members WHERE user_id = $1`,
        [userId],
      );
      checkinGroups.forEach(({ id }) => { void socket.join(`checkin:${id}`); });
      const checkinBroadcasts = await query<{ id: string }>(
        `SELECT b.id FROM vm_broadcasts b
          JOIN vm_checkin_group_members gm ON gm.group_id = b.group_id AND gm.user_id = $1
         ORDER BY b.created_at DESC LIMIT 200`,
        [userId],
      );
      const hydratedCheckins = [];
      for (const row of checkinBroadcasts) {
        const item = await hydrateCheckinBroadcast(row.id, userId);
        if (item) hydratedCheckins.push(item);
      }
      if (hydratedCheckins.length > 0) socket.emit("checkin:hydrate", { broadcasts: hydratedCheckins });

      // If the client provided a `since` timestamp, send any messages they may
      // have missed while the socket was disconnected (e.g. app was backgrounded).
      if (since && chats.length > 0) {
        try {
          const chatIds = chats.map((c) => c.id);
          // Build a parameterised query for all chat rooms the user belongs to
          const placeholders = chatIds.map((_, i) => `$${i + 2}`).join(", ");
          const missed = await query<{
            id: string;
            chat_id: string;
            sender_id: string;
            client_id: string | null;
            sender_name: string;
            text: string;
            type: string;
            media: unknown;
            reactions: unknown;
            created_at: string | number;
          }>(
            `SELECT m.id, m.chat_id, m.sender_id, m.client_id,
                    u.display_name AS sender_name,
                    m.text, m.type, m.media, m.reactions, m.created_at
             FROM vm_messages m
             JOIN vm_users u ON u.id = m.sender_id
             WHERE m.created_at > $1
               AND m.chat_id IN (${placeholders})
             ORDER BY m.created_at ASC`,
            [since, ...chatIds]
          );

          if (missed.length > 0) {
            socket.emit("missed_messages", {
              messages: missed.map((m) => serializedMessageFromRow(m, {
                senderId: m.sender_id,
                senderName: m.sender_name,
                localId: m.client_id,
              })),
            });
          }
        } catch (err) {
          console.error("[socket] missed_messages query error:", err);
        }
      }
    });

    socket.on("checkin:send", async (payload: {
      groupId: string;
      text?: string;
      audioAttachment?: unknown;
      deadline?: number;
      clientId?: string;
    }, acknowledge?: (result: CheckinBroadcastAck) => void) => {
      try {
        if (!currentUserId) {
          acknowledge?.({ ok: false, error: "Not authenticated" });
          socket.emit("error", { message: "Not authenticated" });
          return;
        }
        const group = await queryOne<{ id: string; creator_id: string }>(
          `SELECT g.id, g.creator_id FROM vm_checkin_groups g
            JOIN vm_checkin_group_members gm ON gm.group_id = g.id AND gm.user_id = $2
           WHERE g.id = $1`,
          [payload.groupId, currentUserId],
        );
        if (!group) {
          acknowledge?.({ ok: false, error: "Not a member of this check-in group" });
          socket.emit("error", { message: "Not a member of this check-in group" });
          return;
        }
        if (group.creator_id !== currentUserId) {
          acknowledge?.({ ok: false, error: "Only the group creator can broadcast" });
          socket.emit("error", { message: "Only the group creator can broadcast" });
          return;
        }
        const groupMembers = await query<{ user_id: string }>(
          `SELECT user_id FROM vm_checkin_group_members WHERE group_id = $1`, [group.id],
        );
        const contactCheck = await checkGroupContactsAllowed(groupMembers.map((member) => member.user_id));
        if (!contactCheck.allowed) {
          await requestApprovalAndNotifyParents(contactCheck.unapprovedPairs);
          acknowledge?.({
            ok: false,
            error: contactCheck.status === "blocked"
              ? "This group includes a contact who has been blocked by a parent."
              : "Waiting for parent approval before broadcasting.",
          });
          return;
        }
        const text = payload.text ?? "";
        if (typeof text !== "string" || text.length > 2000 || (!text.trim() && !payload.audioAttachment)) {
          acknowledge?.({ ok: false, error: "Broadcast text or audio is required" });
          socket.emit("error", { message: "Broadcast text or audio is required" });
          return;
        }
        const existing = payload.clientId
          ? await queryOne<{ id: string }>(
            `SELECT id FROM vm_broadcasts WHERE creator_id = $1 AND client_id = $2`,
            [currentUserId, payload.clientId],
          )
          : null;
        let duplicate = Boolean(existing);
        let row = existing ?? await queryOne<{ id: string }>(
          `INSERT INTO vm_broadcasts (group_id, creator_id, text, audio_attachment, deadline, client_id)
           VALUES ($1, $2, $3, $4::jsonb, $5, $6)
           ON CONFLICT (creator_id, client_id) WHERE client_id IS NOT NULL DO NOTHING
           RETURNING id`,
          [payload.groupId, currentUserId, text,
            payload.audioAttachment == null ? null : JSON.stringify(payload.audioAttachment),
            payload.deadline ?? null, payload.clientId ?? null],
        );
        if (!row && payload.clientId) {
          row = await queryOne<{ id: string }>(
            `SELECT id FROM vm_broadcasts WHERE creator_id = $1 AND client_id = $2`,
            [currentUserId, payload.clientId],
          );
          duplicate = Boolean(row);
        }
        const broadcast = await hydrateCheckinBroadcast(row!.id, currentUserId);
        if (!broadcast) {
          acknowledge?.({ ok: false, error: "Broadcast could not be hydrated" });
          return;
        }
        acknowledge?.({ ok: true, broadcast });
        if (duplicate) return;
        await emitCheckinBroadcastCreated(broadcast.id);
      } catch {
        acknowledge?.({ ok: false, error: "Failed to send check-in broadcast" });
        socket.emit("error", { message: "Failed to send check-in broadcast" });
      }
    });

    socket.on("checkin:reply", async (payload: {
      broadcastId: string;
      text?: string;
      audioAttachment?: unknown;
      clientId?: string;
    }, acknowledge?: (result: CheckinReplyAck) => void) => {
      try {
        if (!currentUserId) {
          acknowledge?.({ ok: false, error: "Not authenticated" });
          socket.emit("error", { message: "Not authenticated" });
          return;
        }
        const broadcast = await queryOne<{ id: string; group_id: string; creator_id: string }>(
          `SELECT id, group_id, creator_id FROM vm_broadcasts WHERE id = $1`,
          [payload.broadcastId],
        );
        if (!broadcast) {
          acknowledge?.({ ok: false, error: "Broadcast not found" });
          socket.emit("error", { message: "Broadcast not found" });
          return;
        }
        const member = await queryOne<{ user_id: string }>(
          `SELECT user_id FROM vm_checkin_group_members
            WHERE group_id = $1 AND user_id = $2`,
          [broadcast.group_id, currentUserId],
        );
        if (!member || broadcast.creator_id === currentUserId) {
          acknowledge?.({ ok: false, error: "Only a group member may reply" });
          socket.emit("error", { message: "Only a group member may reply" });
          return;
        }
        const groupMembers = await query<{ user_id: string }>(
          `SELECT user_id FROM vm_checkin_group_members WHERE group_id = $1`, [broadcast.group_id],
        );
        const contactCheck = await checkGroupContactsAllowed(groupMembers.map((row) => row.user_id));
        if (!contactCheck.allowed) {
          await requestApprovalAndNotifyParents(contactCheck.unapprovedPairs);
          acknowledge?.({
            ok: false,
            error: contactCheck.status === "blocked"
              ? "This group includes a contact who has been blocked by a parent."
              : "Waiting for parent approval before replying.",
          });
          return;
        }
        const text = payload.text ?? "";
        if (typeof text !== "string" || text.length > 2000 || (!text.trim() && !payload.audioAttachment)) {
          acknowledge?.({ ok: false, error: "Reply text or audio is required" });
          socket.emit("error", { message: "Reply text or audio is required" });
          return;
        }
        const existing = payload.clientId
          ? await queryOne<{ id: string }>(
            `SELECT id FROM vm_checkin_replies
              WHERE broadcast_id = $1 AND member_id = $2 AND client_id = $3`,
            [broadcast.id, currentUserId, payload.clientId],
          )
          : null;
        let duplicate = Boolean(existing);
        let row = existing ?? await queryOne<{ id: string }>(
          `INSERT INTO vm_checkin_replies (broadcast_id, member_id, text, audio_attachment, client_id)
           VALUES ($1, $2, $3, $4::jsonb, $5)
           ON CONFLICT (broadcast_id, member_id, client_id) WHERE client_id IS NOT NULL DO NOTHING
           RETURNING id`,
          [broadcast.id, currentUserId, text,
            payload.audioAttachment == null ? null : JSON.stringify(payload.audioAttachment),
            payload.clientId ?? null],
        );
        if (!row && payload.clientId) {
          row = await queryOne<{ id: string }>(
            `SELECT id FROM vm_checkin_replies
              WHERE broadcast_id = $1 AND member_id = $2 AND client_id = $3`,
            [broadcast.id, currentUserId, payload.clientId],
          );
          duplicate = Boolean(row);
        }
        const reply = await queryOne<CheckinReplyRow>(
          `SELECT id, member_id, client_id, text, audio_attachment, created_at, read_at
             FROM vm_checkin_replies WHERE id = $1`, [row!.id],
        );
        const replyPayload = {
          id: reply!.id,
          broadcastId: broadcast.id,
          clientId: reply!.client_id ?? undefined,
          memberId: reply!.member_id,
          text: reply!.text,
          audioAttachment: reply!.audio_attachment ?? undefined,
          timestamp: Number(reply!.created_at),
          read: reply!.read_at != null,
        };
        acknowledge?.({ ok: true, reply: replyPayload });
        if (duplicate) return;
        // Only the creator receives another member's reply. Echo it to the
        // author as an acknowledgement for optimistic/offline reconciliation.
        io.to(`user:${broadcast.creator_id}`).emit("checkin:reply", replyPayload);
        io.to(`user:${currentUserId}`).emit("checkin:reply", replyPayload);
        io.to(`user:${broadcast.creator_id}`).emit("checkin:progress", {
          broadcastId: broadcast.id,
          ...(await checkinProgress(broadcast.id)),
        });
      } catch {
        acknowledge?.({ ok: false, error: "Failed to send check-in reply" });
        socket.emit("error", { message: "Failed to send check-in reply" });
      }
    });

    socket.on("message:send", async (payload: {
      chatId: string;
      text?: string;
      type?: string;
      localId?: string;
      media?: unknown;
      asProfileId?: string;
    }, acknowledge?: (result: { ok: true; message: ServerMessage } | { ok: false; error: string; status?: string }) => void) => {
      try {
        const { chatId, text, type = "text", localId, media, asProfileId } = payload;
        const senderId = currentUserId;

        // Sender identity is derived exclusively from the verified handshake
        // token. Any legacy senderId field is intentionally ignored.
        if (!senderId) {
          acknowledge?.({ ok: false, error: "Not authenticated as this sender", status: "auth" });
          socket.emit("error", { message: "Not authenticated as this sender" });
          return;
        }
        if (typeof asProfileId === "string" && asProfileId.length > 0) {
          const sent = await deliverSubProfileMessage({
            profileId: asProfileId,
            actorUserId: senderId,
            chatId,
            clientId: localId,
            text,
            type,
            media,
            mode: "owner_send_as",
          });
          if (!sent.ok) {
            acknowledge?.({ ok: false, error: sent.error, status: sent.code });
            return;
          }
          acknowledge?.({ ok: true, message: sent.message });
          return;
        }
        const agentGate = await rejectAgentMemberSend(senderId);
        if (!agentGate.ok) {
          acknowledge?.({ ok: false, error: agentGate.error, status: agentGate.code });
          return;
        }
        const prepared = prepareOutgoingMessage({ text, type, media });
        if (!prepared.ok) {
          acknowledge?.({ ok: false, error: prepared.error, status: "invalid" });
          return;
        }
        if (typeof localId !== "string" || localId.length < 1 || localId.length > 200) {
          acknowledge?.({ ok: false, error: "Invalid client operation id", status: "invalid" });
          return;
        }

        const isMember = await queryOne<{ user_id: string }>(
          `SELECT user_id FROM vm_chat_members WHERE chat_id = $1 AND user_id = $2`,
          [chatId, senderId]
        );
        if (!isMember) {
          acknowledge?.({ ok: false, error: "Not a member of this chat", status: "not_member" });
          socket.emit("error", { message: "Not a member of this chat" });
          return;
        }

        // Contact-approval enforcement for direct chats involving a child:
        // block sends between a child and a contact that isn't parent-approved.
        const chatInfo = await queryOne<{ type: string }>(
          `SELECT type FROM vm_chats WHERE id = $1`,
          [chatId]
        );
        if (!chatInfo) {
          acknowledge?.({ ok: false, error: "Chat not found", status: "not_member" });
          return;
        }
        if (chatInfo?.type === "direct") {
          const otherMember = await queryOne<{ user_id: string }>(
            `SELECT user_id FROM vm_chat_members WHERE chat_id = $1 AND user_id != $2 LIMIT 1`,
            [chatId, senderId]
          );
          if (otherMember) {
            const check = await checkDirectContactAllowed(senderId, otherMember.user_id);
            if (!check.allowed) {
              // Auto-create pending approval request(s) and notify parents,
              // same as the chat-creation path (no-op for blocked pairs).
              if (check.status === "pending") {
                void requestApprovalAndNotifyParents(check.unapprovedPairs).catch(() => {});
              }
              acknowledge?.({ ok: false, error: check.status === "blocked"
                ? "This contact has been blocked by a parent."
                : "Waiting for parent approval before you can chat with this contact.", status: check.status });
              socket.emit("message:blocked", {
                chatId,
                localId,
                senderId,
                status: check.status,
                message:
                  check.status === "blocked"
                    ? "This contact has been blocked by a parent."
                    : "Waiting for parent approval before you can chat with this contact.",
              });
              return;
            }
          }
        } else if (chatInfo?.type === "group") {
          const groupMembers = await query<{ user_id: string }>(
            `SELECT user_id FROM vm_chat_members WHERE chat_id = $1`,
            [chatId]
          );
          if (groupMembers.length > MAX_GROUP_MEMBERS) {
            acknowledge?.({ ok: false, error: `This group has more than ${MAX_GROUP_MEMBERS} members and can't send messages.`, status: "group_limit" });
            socket.emit("message:blocked", {
              chatId,
              localId,
              senderId,
              status: "group_limit",
              message: `This group has more than ${MAX_GROUP_MEMBERS} members and can't send messages.`,
            });
            return;
          }
          const check = await checkGroupContactsAllowed(groupMembers.map((member) => member.user_id));
          if (!check.allowed) {
            // Keep existing groups safe if an approval is revoked after the
            // group was created, and protect groups created before enforcement.
            // The notifier ignores blocked pairs, but can still request other
            // pending approvals when a group also includes a blocked contact.
            void requestApprovalAndNotifyParents(check.unapprovedPairs).catch(() => {});
            acknowledge?.({ ok: false, error: check.status === "blocked"
              ? "This group includes a contact who has been blocked by a parent."
              : "Waiting for parent approval before messages can be sent in this group.", status: check.status });
            socket.emit("message:blocked", {
              chatId,
              localId,
            senderId,
              status: check.status,
              message:
                check.status === "blocked"
                  ? "This group includes a contact who has been blocked by a parent."
                  : "Waiting for parent approval before messages can be sent in this group.",
            });
            return;
          }
        }

        const sender = await queryOne<{ display_name: string; avatar: string }>(
          `SELECT display_name, avatar FROM vm_users WHERE id = $1`,
          [senderId]
        );

        const now = Date.now();
        const { text: messageText, type: messageType, media: messageMedia } = prepared.message;
        const inserted = await queryOne<{ id: string; chat_id: string; text: string; type: string; media: unknown; created_at: string | number }>(
          `INSERT INTO vm_messages (chat_id, sender_id, client_id, text, type, media, created_at)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
           ON CONFLICT (sender_id, client_id) WHERE client_id IS NOT NULL DO NOTHING
           RETURNING id, chat_id, text, type, media, created_at`,
          [chatId, senderId, localId, messageText, messageType, mediaJsonParam(messageMedia), now]
        );
        const msg = inserted ?? (localId
          ? await queryOne<{ id: string; chat_id: string; text: string; type: string; media: unknown; created_at: string | number }>(
            `SELECT id, chat_id, text, type, media, created_at
               FROM vm_messages WHERE sender_id = $1 AND client_id = $2`,
            [senderId, localId],
          )
          : null);
        if (!msg) {
          acknowledge?.({ ok: false, error: "Message could not be persisted", status: "unknown" });
          return;
        }
        if (msg.chat_id !== chatId) {
          acknowledge?.({ ok: false, error: "Client operation id belongs to another chat", status: "invalid" });
          return;
        }
        const duplicate = !inserted;

        const outgoing: ServerMessage = serializedMessageFromRow(msg, {
          senderId,
          senderName: sender?.display_name ?? "Unknown",
          localId,
        });

        // Canonical persistence precedes the acknowledgement and event. A
        // duplicate retry only receives the canonical row and never emits or
        // pushes a second live notification.
        acknowledge?.({ ok: true, message: outgoing });
        if (duplicate) return;
        void noteHumanCiphertext(chatId, messageText);
        try {
          await query(
            `UPDATE vm_chats SET last_message_at = $1 WHERE id = $2`,
            [now, chatId]
          );
        } catch { /* message history remains authoritative */ }
        // Cross-instance fan-out (Autoscale): chat room + every member's user
        // room on every instance. Never throws.
        await fanoutMessage(outgoing);
        void notifyChatAgents(chatId, outgoing, senderId);

        // AI content check for child accounts — fire-and-forget, never blocks delivery
        if (messageType === "text") {
          void checkContentForChild(msg!.id, chatId, senderId, messageText);
        }

        try {
          const tokens = await pushTokensForChat(chatId, senderId);

          if (tokens.length > 0) {
            await sendExpoPush(
              tokens,
              sender?.display_name ?? "New message",
              messagePreview(outgoing.text, outgoing.type),
              "default",
              messagePushData(chatId, outgoing.id),
            );
          }
        } catch { /* push failure cannot invalidate the committed message */ }
      } catch (err) {
        console.error("message:send error", err);
        acknowledge?.({ ok: false, error: "Failed to send message" });
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    socket.on("chat:read", async (payload: { chatId: string; userId: string; lastMessageId?: string }) => {
      try {
        const { chatId, userId } = payload;
        if (!currentUserId || userId !== currentUserId) return;
        // The reader must actually be a member of the chat
        const member = await queryOne<{ user_id: string }>(
          `SELECT user_id FROM vm_chat_members WHERE chat_id = $1 AND user_id = $2`,
          [chatId, userId]
        );
        if (!member) return;
        const now = Date.now();

        const unread = await query<{ id: string; sender_id: string }>(
          `SELECT m.id, m.sender_id FROM vm_messages m
           WHERE m.chat_id = $1 AND m.sender_id != $2 AND m.read_at IS NULL`,
          [chatId, userId]
        );

        if (unread.length > 0) {
          await query(
            `UPDATE vm_messages SET read_at = $1
             WHERE chat_id = $2 AND sender_id != $3 AND read_at IS NULL`,
            [now, chatId, userId]
          );

          const senderIds = [...new Set(unread.map((m) => m.sender_id))];
          for (const sid of senderIds) {
            void fanoutEvent([`user:${sid}`], "message:read", {
              chatId,
              readByUserId: userId,
              readAt: now,
            });
          }
        }
      } catch (err) {
        console.error("chat:read error", err);
      }
    });

    socket.on("chat:join", async (chatId: string) => {
      // Only authenticated members may subscribe to a chat room
      if (!currentUserId) return;
      const member = await queryOne<{ user_id: string }>(
        `SELECT user_id FROM vm_chat_members WHERE chat_id = $1 AND user_id = $2`,
        [chatId, currentUserId]
      );
      if (!member) return;
      void socket.join(`chat:${chatId}`);
    });

    socket.on("typing:start", async (payload: { chatId: string; userId: string; name: string }) => {
      if (!currentUserId || payload.userId !== currentUserId) return;
      const member = await queryOne<{ user_id: string }>(
        `SELECT user_id FROM vm_chat_members WHERE chat_id = $1 AND user_id = $2`,
        [payload.chatId, currentUserId]
      );
      if (!member) return;
      socket.to(`chat:${payload.chatId}`).emit("typing:update", { ...payload, typing: true });
    });

    socket.on("typing:stop", async (payload: { chatId: string; userId: string }) => {
      if (!currentUserId || payload.userId !== currentUserId) return;
      const member = await queryOne<{ user_id: string }>(
        `SELECT user_id FROM vm_chat_members WHERE chat_id = $1 AND user_id = $2`,
        [payload.chatId, currentUserId]
      );
      if (!member) return;
      socket.to(`chat:${payload.chatId}`).emit("typing:update", { ...payload, typing: false });
    });

    // Client contract: emit "user:away" (no payload) when AppState leaves
    // "active". The socket stays in its rooms. Identity is this connection's
    // authenticated user, not a user id in the payload. Coming back to the
    // foreground is the existing "user:join", which sets presence active.
    // Another foreground socket for the same user keeps vm_users.is_online.
    socket.on(USER_AWAY_EVENT, async (payload: unknown, ack?: unknown) => {
      const callback = typeof payload === "function"
        ? payload as (result: unknown) => void
        : typeof ack === "function"
          ? ack as (result: unknown) => void
          : null;
      if (!currentUserId) {
        callback?.({ ok: false, error: "Not joined" });
        return;
      }
      const userId = currentUserId;
      (socket.data as { presence?: "active" | "away" }).presence = "away";
      const now = Date.now();
      try {
        const peers = await io.in(`user:${userId}`).fetchSockets();
        const others = peers.filter((peer) => peer.id !== socket.id);
        const stillForeground = accountIsOnline(others.map((peer) => readSocketPresence(peer.data)));
        await query(
          `UPDATE vm_users SET is_online = $1, last_seen = $2 WHERE id = $3`,
          [stillForeground, now, userId],
        );
        if (stillForeground) {
          const keep = others.find((peer) => readSocketPresence(peer.data) !== "away");
          if (keep) onlineUsers.set(userId, keep.id);
        } else {
          onlineUsers.delete(userId);
          io.emit("user:offline", { userId, lastSeen: now });
        }
        callback?.({ ok: true, isOnline: stillForeground });
      } catch (err) {
        console.error("[presence] user:away failed", err);
        callback?.({ ok: false, error: "Failed to update presence" });
      }
    });

    socket.on("disconnect", async () => {
      if (currentUserId) {
        const userId = currentUserId;
        // Another device of the same user may still be connected on this
        // instance. A lookup failure must not clear is_online: we could not
        // prove this was the last socket. Away sockets do not count as
        // foreground — once none remain, the account is offline.
        const remaining = await io.in(`user:${userId}`).fetchSockets().catch((err: unknown) => {
          console.error("[presence] disconnect lookup failed; leaving is_online unchanged", err);
          return null;
        });
        if (!remaining) return;
        const others = remaining.filter((peer) => peer.id !== socket.id);
        if (accountIsOnline(others.map((peer) => readSocketPresence(peer.data)))) {
          const keep = others.find((peer) => readSocketPresence(peer.data) !== "away");
          if (keep) onlineUsers.set(userId, keep.id);
          return;
        }
        onlineUsers.delete(userId);
        const now = Date.now();
        await query(
          `UPDATE vm_users SET is_online = false, last_seen = $1 WHERE id = $2`,
          [now, userId]
        );
        io.emit("user:offline", { userId, lastSeen: now });
      }
    });
  });

  return io;
}
