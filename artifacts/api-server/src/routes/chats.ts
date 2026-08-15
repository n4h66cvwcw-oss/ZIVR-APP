import { Router } from "express";
import { query, queryOne } from "../lib/db";
import { checkDirectContactAllowed, requestApprovalAndNotifyParents } from "../lib/approvals";
import { getAuthUserId } from "../lib/auth";

const router = Router();

router.post("/direct", async (req, res) => {
  try {
    const { myUserId, theirUserId } = req.body as { myUserId: string; theirUserId: string };

    // Actor identity must be proven by a signed token, not trusted from the body
    const authUserId = getAuthUserId(req);
    if (!authUserId || authUserId !== myUserId) {
      res.status(401).json({ error: "Invalid or missing auth token" });
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

    const chat = await queryOne<{ id: string }>(
      `INSERT INTO vm_chats (type, name, description, created_by) VALUES ('group', $1, $2, $3) RETURNING id`,
      [name, description ?? null, myUserId]
    );
    const chatId = chat!.id;

    const all = [...new Set([myUserId, ...memberIds])];
    for (const uid of all) {
      await query(`INSERT INTO vm_chat_members (chat_id, user_id) VALUES ($1, $2)`, [chatId, uid]);
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
      `SELECT c.id, c.type, c.name, c.description, c.last_message_at,
         (SELECT m.text FROM vm_messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message,
         (SELECT m.created_at FROM vm_messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message_time,
         (SELECT json_agg(json_build_object('id', u.id, 'displayName', u.display_name, 'avatar', u.avatar, 'isOnline', u.is_online))
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

    const messages = await query(
      `SELECT
         m.id,
         m.chat_id      AS "chatId",
         m.sender_id    AS "senderId",
         m.text,
         m.type,
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

    res.json({ messages: messages.reverse() });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

export default router;
