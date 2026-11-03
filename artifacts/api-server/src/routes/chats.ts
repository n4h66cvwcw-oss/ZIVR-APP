import { Router } from "express";
import pool, { query, queryOne } from "../lib/db";
import {
  checkDirectContactAllowed,
  checkGroupContactsAllowed,
  MAX_GROUP_MEMBERS,
  requestApprovalAndNotifyParents,
} from "../lib/approvals";
import { getAuthUserId } from "../lib/auth";
import { checkContentForChild } from "../lib/socket";
import { messagePushData, sendExpoPush } from "../lib/push";
import { fanoutChatEvent, fanoutMessage, pushTokensForChat } from "../lib/realtime-bus";
import { parseReactionEmoji } from "../lib/reactions";
import { toggleMessageReaction } from "../lib/reactions-store";
import type { ServerMessage } from "../lib/socket";
import {
  mediaJsonParam,
  messagePreview,
  prepareOutgoingMessage,
  serializeHistoryMessage,
  serializedMessageFromRow,
} from "../lib/message-content";
import {
  assertGroupHasNoAgents,
  assertHumanCanOpenDirect,
  noteHumanCiphertext,
  notifyChatAgents,
  rejectAgentMemberSend,
} from "../lib/agent-delivery";

const router = Router();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

router.post("/direct", async (req, res) => {
  try {
    const { myUserId, theirUserId } = req.body as { myUserId: string; theirUserId: string };

    // Actor identity must be proven by a signed token, not trusted from the body
    const authUserId = getAuthUserId(req);
    if (!authUserId || authUserId !== myUserId) {
      res.status(401).json({ error: "Invalid or missing auth token", code: "auth" });
      return;
    }

    const partyGate = await assertHumanCanOpenDirect(myUserId, theirUserId);
    if (!partyGate.ok) {
      res.status(partyGate.status).json({ error: partyGate.error, code: partyGate.code });
      return;
    }

    // Parental contact-approval enforcement: if either user is a child,
    // the other must be approved by the child's parent before a chat exists.
    const check = await checkDirectContactAllowed(myUserId, theirUserId);
    if (!check.allowed) {
      if (check.status === "blocked") {
        res.status(403).json({
          error: "This contact has been blocked by a parent.",
          approval: "blocked",
        });
        return;
      }
      // Auto-create pending approval request(s) and notify parent(s)
      await requestApprovalAndNotifyParents(check.unapprovedPairs);
      res.status(403).json({
        error: "Waiting for parent approval before you can chat with this contact.",
        approval: "pending",
      });
      return;
    }

    const existing = await queryOne<{ id: string }>(
      `SELECT c.id FROM vm_chats c
       JOIN vm_chat_members m1 ON m1.chat_id = c.id AND m1.user_id = $1
       JOIN vm_chat_members m2 ON m2.chat_id = c.id AND m2.user_id = $2
       WHERE c.type = 'direct' LIMIT 1`,
      [myUserId, theirUserId]
    );

    if (existing) { res.json({ chatId: existing.id, existed: true }); return; }

    const chat = await queryOne<{ id: string }>(
      `INSERT INTO vm_chats (type, created_by) VALUES ('direct', $1) RETURNING id`,
      [myUserId]
    );
    const chatId = chat!.id;

    await query(
      `INSERT INTO vm_chat_members (chat_id, user_id) VALUES ($1, $2), ($1, $3)`,
      [chatId, myUserId, theirUserId]
    );

    res.json({ chatId, existed: false });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

/**
 * Durable message write used by mobile outbox retries and as the fallback when
 * Socket.IO is unavailable. Authentication is deliberately derived from the
 * token; senderId is not accepted from the request body.
 */
router.post("/:chatId/messages", async (req, res) => {
  try {
    const { chatId } = req.params;
    const authUserId = getAuthUserId(req);
    if (!authUserId) {
      res.status(401).json({ error: "Invalid or missing auth token", code: "auth" });
      return;
    }
    const agentGate = await rejectAgentMemberSend(authUserId);
    if (!agentGate.ok) {
      res.status(agentGate.status).json({ error: agentGate.error, code: agentGate.code });
      return;
    }
    const { text, type = "text", clientId, media } = req.body as {
      text?: string;
      type?: string;
      clientId?: string;
      media?: unknown;
    };
    const prepared = prepareOutgoingMessage({ text, type, media });
    if (!prepared.ok) {
      res.status(400).json({ error: prepared.error, code: "invalid" });
      return;
    }
    if (typeof clientId !== "string" || clientId.length < 1 || clientId.length > 200) {
      res.status(400).json({ error: "A client operation id is required", code: "invalid" });
      return;
    }

    const member = await queryOne<{ user_id: string }>(
      `SELECT user_id FROM vm_chat_members WHERE chat_id = $1 AND user_id = $2`,
      [chatId, authUserId],
    );
    if (!member) {
      res.status(403).json({ error: "Not a member of this chat", code: "not_member" });
      return;
    }

    const chatInfo = await queryOne<{ type: string }>(
      `SELECT type FROM vm_chats WHERE id = $1`, [chatId],
    );
    if (!chatInfo) {
      res.status(404).json({ error: "Chat not found", code: "not_member" });
      return;
    }
    if (chatInfo.type === "direct") {
      const otherMember = await queryOne<{ user_id: string }>(
        `SELECT user_id FROM vm_chat_members
          WHERE chat_id = $1 AND user_id != $2 LIMIT 1`,
        [chatId, authUserId],
      );
      if (otherMember) {
        const check = await checkDirectContactAllowed(authUserId, otherMember.user_id);
        if (!check.allowed) {
           if (check.status === "pending") {
             try { await requestApprovalAndNotifyParents(check.unapprovedPairs); } catch { /* refusal remains terminal */ }
           }
          res.status(403).json({
            error: check.status === "blocked"
              ? "This contact has been blocked by a parent."
              : "Waiting for parent approval before you can chat with this contact.",
            approval: check.status,
            code: check.status,
          });
          return;
        }
      }
    } else if (chatInfo.type === "group") {
      const members = await query<{ user_id: string }>(
        `SELECT user_id FROM vm_chat_members WHERE chat_id = $1`, [chatId],
      );
      if (members.length > MAX_GROUP_MEMBERS) {
        res.status(403).json({ error: `This group has more than ${MAX_GROUP_MEMBERS} members and can't send messages.`, approval: "group_limit", code: "group_limit" });
        return;
      }
      const check = await checkGroupContactsAllowed(members.map((row) => row.user_id));
      if (!check.allowed) {
         try { await requestApprovalAndNotifyParents(check.unapprovedPairs); } catch { /* refusal remains terminal */ }
        res.status(403).json({
          error: check.status === "blocked"
            ? "This group includes a contact who has been blocked by a parent."
            : "Waiting for parent approval before messages can be sent in this group.",
          approval: check.status,
          code: check.status,
        });
        return;
      }
    }

    const sender = await queryOne<{ display_name: string }>(
      `SELECT display_name FROM vm_users WHERE id = $1`, [authUserId],
    );
    const now = Date.now();
    const { text: messageText, type: messageType, media: messageMedia } = prepared.message;
    const inserted = await queryOne<{ id: string; chat_id: string; text: string; type: string; media: unknown; created_at: number }>(
      `INSERT INTO vm_messages (chat_id, sender_id, client_id, text, type, media, created_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
       ON CONFLICT (sender_id, client_id) WHERE client_id IS NOT NULL DO NOTHING
       RETURNING id, chat_id, text, type, media, created_at`,
      [chatId, authUserId, clientId, messageText, messageType, mediaJsonParam(messageMedia), now],
    );
    const msg = inserted ?? await queryOne<{ id: string; chat_id: string; text: string; type: string; media: unknown; created_at: number }>(
      `SELECT id, chat_id, text, type, media, created_at
         FROM vm_messages WHERE sender_id = $1 AND client_id = $2`,
      [authUserId, clientId],
    );
    if (!msg) {
      res.status(500).json({ error: "Message could not be persisted" });
      return;
    }
    if (msg.chat_id !== chatId) {
      res.status(409).json({ error: "Client operation id belongs to another chat", code: "invalid" });
      return;
    }
    const duplicate = !inserted;
    const outgoing: ServerMessage = serializedMessageFromRow(msg, {
      senderId: authUserId,
      senderName: sender?.display_name ?? "Unknown",
      localId: clientId,
    });
    res.json({ message: outgoing });
    if (duplicate) return;
    void noteHumanCiphertext(chatId, messageText);
    // The row and canonical response are authoritative. Fanout/moderation is
    // best effort and must never turn an already committed write into a 500.
    try {
      await query(`UPDATE vm_chats SET last_message_at = $1 WHERE id = $2`, [now, chatId]);
    } catch { /* history remains authoritative even if the preview update fails */ }
    await fanoutMessage(outgoing); // cross-instance; never throws
    void notifyChatAgents(chatId, outgoing, authUserId);
    if (outgoing.type === "text") {
      void checkContentForChild(outgoing.id, chatId, authUserId, outgoing.text).catch(() => {});
    }
    try {
      const tokens = await pushTokensForChat(chatId, authUserId);
      if (tokens.length > 0) {
        await sendExpoPush(
          tokens,
          sender?.display_name ?? "New message",
          messagePreview(outgoing.text, outgoing.type),
          "default",
          messagePushData(chatId, outgoing.id),
        );
      }
    } catch { /* push delivery is retryable by reconnect/history */ }
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

/**
 * Toggle the caller's emoji on a message. messageId is the server UUID or the
 * sender's client id (the id the sender's phone still shows). Peers receive
 * message:reaction with the canonical server id and that clientId.
 */
router.post("/:chatId/messages/:messageId/reactions", async (req, res) => {
  try {
    const chatId = req.params["chatId"];
    const messageId = req.params["messageId"];
    const authUserId = getAuthUserId(req);
    if (!authUserId) {
      res.status(401).json({ error: "Invalid or missing auth token", code: "auth" });
      return;
    }
    if (
      typeof chatId !== "string" ||
      !UUID_PATTERN.test(chatId) ||
      typeof messageId !== "string" ||
      messageId.length < 1 ||
      messageId.length > 200
    ) {
      res.status(404).json({ error: "Message not found", code: "not_found" });
      return;
    }
    const parsed = parseReactionEmoji((req.body as { emoji?: unknown } | undefined)?.emoji);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error, code: "invalid" });
      return;
    }
    const member = await queryOne<{ user_id: string }>(
      `SELECT user_id FROM vm_chat_members WHERE chat_id = $1 AND user_id = $2`,
      [chatId, authUserId],
    );
    if (!member) {
      res.status(403).json({ error: "Not a member of this chat", code: "not_member" });
      return;
    }
    const result = await toggleMessageReaction({
      chatId,
      messageKey: messageId,
      userId: authUserId,
      emoji: parsed.emoji,
    });
    if (!result.ok) {
      res.status(result.status).json({ error: result.error, code: result.code });
      return;
    }
    res.json(result.event);
    await fanoutChatEvent(chatId, "message:reaction", result.event);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

router.post("/group", async (req, res) => {
  try {
    const { myUserId, name, description, memberIds } = req.body as {
      myUserId: string; name: string; description?: string; memberIds: string[];
    };

    const authUserId = getAuthUserId(req);
    if (!authUserId || authUserId !== myUserId) {
      res.status(401).json({ error: "Invalid or missing auth token" });
      return;
    }

    if (
      !Array.isArray(memberIds) ||
      memberIds.length > MAX_GROUP_MEMBERS ||
      memberIds.some((memberId) => typeof memberId !== "string" || !UUID_PATTERN.test(memberId))
    ) {
      res.status(400).json({
        error: `Every group member must be valid, and groups can have up to ${MAX_GROUP_MEMBERS} members.`,
      });
      return;
    }

    const all = [...new Set([myUserId, ...memberIds])];
    const agentMembers = await assertGroupHasNoAgents(myUserId, all);
    if (!agentMembers.ok) {
      res.status(agentMembers.status).json({ error: agentMembers.error, code: agentMembers.code });
      return;
    }
    if (all.length > MAX_GROUP_MEMBERS) {
      res.status(400).json({
        error: `Groups can have up to ${MAX_GROUP_MEMBERS} members.`,
      });
      return;
    }

    const existingMembers = await query<{ id: string }>(
      `SELECT id FROM vm_users WHERE id = ANY($1::uuid[])`,
      [all]
    );
    if (existingMembers.length !== all.length) {
      res.status(400).json({ error: "One or more selected group members could not be found." });
      return;
    }

    const contactCheck = await checkGroupContactsAllowed(all);
    if (!contactCheck.allowed) {
      // Request approval for every non-blocked pair, even if another member is
      // blocked. The helper skips blocked pairs and avoids duplicate notices.
      await requestApprovalAndNotifyParents(contactCheck.unapprovedPairs);
      if (contactCheck.status === "pending") {
        res.status(403).json({
          error: "Waiting for parent approval before you can create this group.",
          approval: "pending",
        });
        return;
      }

      res.status(403).json({
        error: "This group includes a contact who has been blocked by a parent.",
        approval: "blocked",
      });
      return;
    }

    const client = await pool.connect();
    let chatId: string;
    try {
      await client.query("BEGIN");
      const chat = await client.query<{ id: string }>(
        `INSERT INTO vm_chats (type, name, description, created_by) VALUES ('group', $1, $2, $3) RETURNING id`,
        [name, description ?? null, myUserId]
      );
      chatId = chat.rows[0]!.id;

      for (const uid of all) {
        await client.query(
          `INSERT INTO vm_chat_members (chat_id, user_id) VALUES ($1, $2)`,
          [chatId, uid]
        );
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    res.json({ chatId });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const authUserId = getAuthUserId(req);
    if (!authUserId || authUserId !== userId) {
      res.status(401).json({ error: "Invalid or missing auth token" });
      return;
    }
    const chats = await query(
      `SELECT c.id, c.type, c.name, c.description, c.is_e2e AS "isE2e", c.last_message_at,
         (SELECT m.text FROM vm_messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message,
         (SELECT m.created_at FROM vm_messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message_time,
         (SELECT json_agg(json_build_object(
            'id', u.id, 'displayName', u.display_name, 'avatar', u.avatar, 'isOnline', u.is_online,
            'accountType', u.account_type, 'profileMode', u.profile_mode, 'ownerUserId', u.owner_user_id
          ))
          FROM vm_chat_members cm2 JOIN vm_users u ON u.id = cm2.user_id WHERE cm2.chat_id = c.id) as members
       FROM vm_chats c
       JOIN vm_chat_members cm ON cm.chat_id = c.id AND cm.user_id = $1
       ORDER BY COALESCE(c.last_message_at, c.created_at) DESC`,
      [userId]
    );
    res.json({ chats });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

router.get("/:chatId/messages", async (req, res) => {
  try {
    const { chatId } = req.params;
    // Only authenticated members may read a chat's history
    const authUserId = getAuthUserId(req);
    if (!authUserId) { res.status(401).json({ error: "Invalid or missing auth token" }); return; }
    const member = await queryOne(
      `SELECT user_id FROM vm_chat_members WHERE chat_id = $1 AND user_id = $2`,
      [chatId, authUserId]
    );
    if (!member) { res.status(403).json({ error: "Not a member of this chat" }); return; }
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const before = req.query.before ? Number(req.query.before) : Date.now() + 1000;

    const messages = await query<{
      id: string;
      chatId: string;
      senderId: string;
      localId: string | null;
      text: string;
      type: string;
      isEncrypted: boolean;
      createdAt: string | number;
      senderName: string | null;
      senderAvatar: string | null;
      media: unknown;
      reactions: unknown;
    }>(
      `SELECT
         m.id,
         m.chat_id      AS "chatId",
         m.sender_id    AS "senderId",
          m.client_id    AS "localId",
         m.text,
         m.type,
         m.media,
         m.reactions,
         m.is_encrypted AS "isEncrypted",
         m.created_at   AS "createdAt",
         u.display_name AS "senderName",
         u.avatar       AS "senderAvatar"
       FROM vm_messages m
       LEFT JOIN vm_users u ON u.id = m.sender_id
       WHERE m.chat_id = $1 AND m.created_at < $2
       ORDER BY m.created_at DESC LIMIT $3`,
      [chatId, before, limit]
    );

    res.json({
      messages: messages.reverse().map((row) => serializeHistoryMessage(row)),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

export default router;
