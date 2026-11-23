import { Router } from "express";
import { query, queryOne } from "../lib/db";
import { isUuid, requireAdmin } from "../lib/moderation";
import { getIO } from "../lib/socket";

const router = Router();

const REPORT_STATUSES = new Set(["resolved", "actioned"]);

router.post("/users/:id/ban", async (req, res) => {
  try {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;
    const { id } = req.params;
    if (!isUuid(id)) {
      res.status(400).json({ error: "user id is invalid" });
      return;
    }
    if (id === adminId) {
      res.status(400).json({ error: "You can't ban your own admin account" });
      return;
    }
    const bannedAt = Date.now();
    const updated = await queryOne<{ id: string }>(
      `UPDATE vm_users
          SET banned = true, banned_at = $2
        WHERE id = $1
        RETURNING id`,
      [id, bannedAt],
    );
    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    getIO()?.in(`user:${id}`).disconnectSockets(true);
    console.info("[moderation] user banned", { userId: id, adminId, bannedAt });
    res.json({ ok: true, userId: id, bannedAt });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

router.delete("/messages/:id", async (req, res) => {
  try {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;
    const { id } = req.params;
    if (!isUuid(id)) {
      res.status(400).json({ error: "message id is invalid" });
      return;
    }
    const removedAt = Date.now();
    const message = await queryOne<{ id: string; chat_id: string }>(
      `UPDATE vm_messages
          SET deleted_at = $2
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING id, chat_id`,
      [id, removedAt],
    );
    if (!message) {
      const existing = await queryOne<{ id: string }>(`SELECT id FROM vm_messages WHERE id = $1`, [id]);
      res.status(existing ? 200 : 404).json(existing ? { ok: true, alreadyDeleted: true } : { error: "Message not found" });
      return;
    }
    const payload = { chatId: message.chat_id, messageId: message.id };
    const io = getIO();
    io?.to(`chat:${message.chat_id}`).emit("message:removed", payload);
    const members = await query<{ user_id: string }>(
      `SELECT user_id FROM vm_chat_members WHERE chat_id = $1`,
      [message.chat_id],
    );
    for (const member of members) {
      io?.to(`user:${member.user_id}`).emit("message:removed", payload);
    }
    console.info("[moderation] message removed", { messageId: message.id, chatId: message.chat_id, adminId });
    res.json({ ok: true, messageId: message.id, chatId: message.chat_id });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

router.patch("/reports/:id", async (req, res) => {
  try {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;
    const { id } = req.params;
    if (!isUuid(id)) {
      res.status(400).json({ error: "report id is invalid" });
      return;
    }
    const status = (req.body as { status?: string }).status?.trim();
    if (!status || !REPORT_STATUSES.has(status)) {
      res.status(400).json({ error: "status must be resolved or actioned" });
      return;
    }
    const report = await queryOne<{ id: string; status: string }>(
      `UPDATE content_reports
          SET status = $2
        WHERE id = $1
        RETURNING id, status`,
      [id, status],
    );
    if (!report) {
      res.status(404).json({ error: "Report not found" });
      return;
    }
    console.info("[moderation] report updated", { reportId: report.id, status: report.status, adminId });
    res.json({ report: { id: report.id, status: report.status } });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

export default router;
