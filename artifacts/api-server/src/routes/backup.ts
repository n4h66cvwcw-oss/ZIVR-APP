import { Router } from "express";
import { query, queryOne } from "../lib/db";

const router = Router();

// ── Full chat history export (no pagination) ──────────────────────────────────
router.get("/chats/:chatId/export", async (req, res) => {
  try {
    const { chatId } = req.params;
    const { userId, format = "json" } = req.query as { userId?: string; format?: string };

    // Verify membership if userId provided
    if (userId) {
      const member = await queryOne(
        `SELECT user_id FROM vm_chat_members WHERE chat_id = $1 AND user_id = $2`,
        [chatId, userId]
      );
      if (!member) { res.status(403).json({ error: "Not a member of this chat" }); return; }
    }

    const messages = await query<{
      id: string; senderId: string; senderName: string;
      text: string; type: string; createdAt: number;
    }>(
      `SELECT m.id,
              m.sender_id    AS "senderId",
              u.display_name AS "senderName",
              m.text,
              m.type,
              m.created_at   AS "createdAt"
         FROM vm_messages m
         LEFT JOIN vm_users u ON u.id = m.sender_id
        WHERE m.chat_id = $1
        ORDER BY m.created_at ASC`,
      [chatId]
    );

    const chatInfo = await queryOne<{ name: string | null; type: string }>(
      `SELECT name, type FROM vm_chats WHERE id = $1`,
      [chatId]
    );

    if (format === "txt") {
      const lines = [
        `ZIVR Chat Export`,
        `Chat: ${chatInfo?.name ?? chatId}`,
        `Exported: ${new Date().toISOString()}`,
        `Messages: ${messages.length}`,
        `${"─".repeat(60)}`,
        "",
        ...messages.map((m) => {
          const d = new Date(m.createdAt);
          const time = d.toLocaleString("en-US", {
            month: "short", day: "numeric", year: "numeric",
            hour: "2-digit", minute: "2-digit",
          });
          return m.type === "text"
            ? `[${time}] ${m.senderName ?? "Unknown"}: ${m.text}`
            : `[${time}] ${m.senderName ?? "Unknown"}: [${m.type}]`;
        }),
      ];
      res.setHeader("Content-Type", "text/plain");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="zivr-chat-${chatId.slice(0, 8)}.txt"`
      );
      res.send(lines.join("\n"));
      return;
    }

    // Default: JSON
    res.json({
      chatId,
      chatName: chatInfo?.name ?? null,
      exportedAt: Date.now(),
      messageCount: messages.length,
      messages,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

// ── Cloud backup: save/update a local chat backup ─────────────────────────────
router.post("/backup", async (req, res) => {
  try {
    const { userId, localChatId, chatName, encryptedData, messageCount } = req.body as {
      userId: string;
      localChatId: string;
      chatName: string;
      encryptedData: string;
      messageCount: number;
    };

    if (!userId || !localChatId || !chatName || !encryptedData) {
      res.status(400).json({ error: "userId, localChatId, chatName, and encryptedData are required" });
      return;
    }

    await query(
      `INSERT INTO vm_chat_backups (user_id, local_chat_id, chat_name, encrypted_data, message_count, backed_up_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, local_chat_id) DO UPDATE
         SET chat_name = $3, encrypted_data = $4, message_count = $5, backed_up_at = $6`,
      [userId, localChatId, chatName, encryptedData, messageCount ?? 0, Date.now()]
    );

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

// ── Cloud backup: list all backups for a user ─────────────────────────────────
router.get("/backup", async (req, res) => {
  try {
    const { userId } = req.query as { userId: string };
    if (!userId) { res.status(400).json({ error: "userId required" }); return; }

    const backups = await query<{
      id: string; localChatId: string; chatName: string;
      messageCount: number; backedUpAt: number;
    }>(
      `SELECT id,
              local_chat_id  AS "localChatId",
              chat_name      AS "chatName",
              message_count  AS "messageCount",
              backed_up_at   AS "backedUpAt"
         FROM vm_chat_backups
        WHERE user_id = $1
        ORDER BY backed_up_at DESC`,
      [userId]
    );

    res.json({ backups });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

// ── Cloud backup: restore a specific local chat ───────────────────────────────
router.get("/backup/:localChatId", async (req, res) => {
  try {
    const { localChatId } = req.params;
    const { userId } = req.query as { userId: string };
    if (!userId) { res.status(400).json({ error: "userId required" }); return; }

    const backup = await queryOne<{
      id: string; localChatId: string; chatName: string;
      encryptedData: string; messageCount: number; backedUpAt: number;
    }>(
      `SELECT id,
              local_chat_id  AS "localChatId",
              chat_name      AS "chatName",
              encrypted_data AS "encryptedData",
              message_count  AS "messageCount",
              backed_up_at   AS "backedUpAt"
         FROM vm_chat_backups
        WHERE user_id = $1 AND local_chat_id = $2`,
      [userId, localChatId]
    );

    if (!backup) { res.status(404).json({ error: "Backup not found" }); return; }
    res.json({ backup });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

// ── Cloud backup: delete a backup ─────────────────────────────────────────────
router.delete("/backup/:localChatId", async (req, res) => {
  try {
    const { localChatId } = req.params;
    const { userId } = req.query as { userId: string };
    if (!userId) { res.status(400).json({ error: "userId required" }); return; }

    await query(
      `DELETE FROM vm_chat_backups WHERE user_id = $1 AND local_chat_id = $2`,
      [userId, localChatId]
    );

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

export default router;
