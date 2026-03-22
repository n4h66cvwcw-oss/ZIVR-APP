import { Router } from "express";
import { query, queryOne } from "../lib/db";

const router = Router();

router.post("/direct", async (req, res) => {
  try {
    const { myUserId, theirUserId } = req.body as { myUserId: string; theirUserId: string };

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
