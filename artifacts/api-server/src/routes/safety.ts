import { Router } from "express";
import { query, queryOne } from "../lib/db";
import { getAuthUserId } from "../lib/auth";
import { isUuid } from "../lib/moderation";
import { sendModerationNotice } from "../lib/mailer";

const router = Router();

const REPORT_REASONS = new Set(["spam", "harassment", "inappropriate", "other"]);
const DETAILS_MAX = 2000;

router.post("/reports", async (req, res) => {
  try {
    const authUserId = getAuthUserId(req);
    if (!authUserId) {
      res.status(401).json({ error: "Invalid or missing auth token" });
      return;
    }

    const body = req.body as {
      reportedUserId?: string;
      messageId?: string | null;
      chatId?: string | null;
      reason?: string;
      details?: string | null;
    };
    const reason = body.reason?.trim();
    if (!reason || !REPORT_REASONS.has(reason)) {
      res.status(400).json({ error: "reason must be spam, harassment, inappropriate, or other" });
      return;
    }
    if (!isUuid(body.reportedUserId)) {
      res.status(400).json({ error: "reportedUserId is required" });
      return;
    }
    if (body.reportedUserId === authUserId) {
      res.status(400).json({ error: "You can't report yourself" });
      return;
    }
    const messageId = body.messageId ?? null;
    const chatId = body.chatId ?? null;
    if (messageId !== null && !isUuid(messageId)) {
      res.status(400).json({ error: "messageId is invalid" });
      return;
    }
    if (chatId !== null && !isUuid(chatId)) {
      res.status(400).json({ error: "chatId is invalid" });
      return;
    }
    const details = body.details?.trim() || null;
    if (details && details.length > DETAILS_MAX) {
      res.status(400).json({ error: "details is too long" });
      return;
    }

    const reported = await queryOne<{ id: string; handle: string | null }>(
      `SELECT id, COALESCE(username, display_name) AS handle FROM vm_users WHERE id = $1`,
      [body.reportedUserId],
    );
    if (!reported) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    let resolvedMessageId: string | null = messageId;
    let resolvedChatId: string | null = chatId;
    if (messageId) {
      const message = await queryOne<{ id: string; chat_id: string; sender_id: string | null }>(
        `SELECT id, chat_id, sender_id FROM vm_messages WHERE id = $1 AND deleted_at IS NULL`,
        [messageId],
      );
      if (!message) {
        res.status(404).json({ error: "Message not found" });
        return;
      }
      if (message.sender_id && message.sender_id !== body.reportedUserId) {
        res.status(400).json({ error: "messageId does not belong to reportedUserId" });
        return;
      }
      resolvedChatId = resolvedChatId ?? message.chat_id;
    }

    const reporter = await queryOne<{ handle: string | null }>(
      `SELECT COALESCE(username, display_name) AS handle FROM vm_users WHERE id = $1`,
      [authUserId],
    );

    const createdAt = Date.now();
    const report = await queryOne<{ id: string; status: string; created_at: string }>(
      `INSERT INTO content_reports
         (reporter_id, reported_user_id, message_id, chat_id, reason, details, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'open', $7)
       RETURNING id, status, created_at`,
      [authUserId, body.reportedUserId, resolvedMessageId, resolvedChatId, reason, details, createdAt],
    );

    const reportId = report!.id;
    console.info("[moderation] new content report", {
      reportId,
      reporterId: authUserId,
      reportedUserId: body.reportedUserId,
      messageId: resolvedMessageId,
      chatId: resolvedChatId,
      reason,
    });
    // TODO: ops must review open reports within 24 hours (App Store Guideline 1.2).
    sendModerationNotice({
      reportId,
      reporterId: authUserId,
      reporterHandle: reporter?.handle ?? null,
      reportedUserId: body.reportedUserId,
      reportedHandle: reported.handle,
      messageId: resolvedMessageId,
      chatId: resolvedChatId,
      reason,
      details,
      createdAt: Number(report!.created_at),
    });

    res.status(201).json({
      report: {
        id: reportId,
        status: report!.status,
        createdAt: Number(report!.created_at),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

router.post("/blocks", async (req, res) => {
  try {
    const authUserId = getAuthUserId(req);
    if (!authUserId) {
      res.status(401).json({ error: "Invalid or missing auth token" });
      return;
    }
    const userId = (req.body as { userId?: string }).userId;
    if (!isUuid(userId)) {
      res.status(400).json({ error: "userId is required" });
      return;
    }
    if (userId === authUserId) {
      res.status(400).json({ error: "You can't block yourself" });
      return;
    }
    const exists = await queryOne<{ id: string }>(`SELECT id FROM vm_users WHERE id = $1`, [userId]);
    if (!exists) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    await query(
      `INSERT INTO user_blocks (blocker_id, blocked_id, created_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (blocker_id, blocked_id) DO NOTHING`,
      [authUserId, userId, Date.now()],
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

router.delete("/blocks/:userId", async (req, res) => {
  try {
    const authUserId = getAuthUserId(req);
    if (!authUserId) {
      res.status(401).json({ error: "Invalid or missing auth token" });
      return;
    }
    const { userId } = req.params;
    if (!isUuid(userId)) {
      res.status(400).json({ error: "userId is invalid" });
      return;
    }
    await query(
      `DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2`,
      [authUserId, userId],
    );
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

router.get("/blocks", async (req, res) => {
  try {
    const authUserId = getAuthUserId(req);
    if (!authUserId) {
      res.status(401).json({ error: "Invalid or missing auth token" });
      return;
    }
    const blocks = await query(
      `SELECT b.blocked_id AS "userId",
              u.display_name AS "displayName",
              u.username,
              u.avatar,
              b.created_at AS "createdAt"
         FROM user_blocks b
         JOIN vm_users u ON u.id = b.blocked_id
        WHERE b.blocker_id = $1
        ORDER BY b.created_at DESC`,
      [authUserId],
    );
    res.json({
      blocks: blocks.map((row) => {
        const block = row as { createdAt: string | number };
        return { ...block, createdAt: Number(block.createdAt) };
      }),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

export default router;
