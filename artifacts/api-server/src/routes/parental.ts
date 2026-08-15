import { Router } from "express";
import { query, queryOne } from "../lib/db";

const router = Router();

// ── Create a child account linked to this parent ──────────────────────────────
router.post("/children", async (req, res) => {
  try {
    const { parentId, displayName, username, pin } = req.body as {
      parentId: string;
      displayName: string;
      username?: string;
      pin?: string;
    };

    if (!parentId || !displayName?.trim()) {
      res.status(400).json({ error: "parentId and displayName are required" });
      return;
    }

    // Ensure parent exists and set their account_type to 'parent'
    await query(
      `UPDATE vm_users SET account_type = 'parent' WHERE id = $1`,
      [parentId]
    );

    // Create child user
    const child = await queryOne<{ id: string }>(
      `INSERT INTO vm_users (display_name, username, account_type)
       VALUES ($1, $2, 'child') RETURNING id`,
      [displayName.trim(), username?.trim() ?? null]
    );

    if (!child) { res.status(500).json({ error: "Failed to create child account" }); return; }

    // Link parent ↔ child
    await query(
      `INSERT INTO vm_parent_child (parent_id, child_id) VALUES ($1, $2)`,
      [parentId, child.id]
    );

    // Create default time restrictions row
    await query(
      `INSERT INTO vm_time_restrictions (child_id) VALUES ($1) ON CONFLICT (child_id) DO NOTHING`,
      [child.id]
    );

    res.json({ child: { id: child.id, displayName, username } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "error";
    if (msg.includes("unique")) {
      res.status(409).json({ error: "Username already taken" });
    } else {
      res.status(500).json({ error: msg });
    }
  }
});

// ── List children for a parent ────────────────────────────────────────────────
router.get("/children", async (req, res) => {
  try {
    const { parentId } = req.query as { parentId: string };
    if (!parentId) { res.status(400).json({ error: "parentId required" }); return; }

    const children = await query<{
      id: string; displayName: string; username: string | null;
      avatar: string | null; isOnline: boolean; lastSeen: number;
      unflaggedCount: number;
    }>(
      `SELECT u.id,
              u.display_name AS "displayName",
              u.username,
              u.avatar,
              u.is_online    AS "isOnline",
              u.last_seen    AS "lastSeen",
              (SELECT COUNT(*) FROM vm_content_flags cf
               WHERE cf.child_id = u.id AND cf.is_reviewed = false)::int AS "unflaggedCount"
         FROM vm_parent_child pc
         JOIN vm_users u ON u.id = pc.child_id
        WHERE pc.parent_id = $1
        ORDER BY u.display_name`,
      [parentId]
    );

    res.json({ children });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

// ── Get child detail + settings ───────────────────────────────────────────────
router.get("/children/:childId", async (req, res) => {
  try {
    const { childId } = req.params;

    const child = await queryOne<{
      id: string; displayName: string; username: string | null;
      avatar: string | null; isOnline: boolean; lastSeen: number;
    }>(
      `SELECT id, display_name AS "displayName", username, avatar,
              is_online AS "isOnline", last_seen AS "lastSeen"
         FROM vm_users WHERE id = $1`,
      [childId]
    );

    if (!child) { res.status(404).json({ error: "Child not found" }); return; }

    const timeRestriction = await queryOne<{
      enabled: boolean; startHour: number; endHour: number; days: string;
    }>(
      `SELECT enabled, start_hour AS "startHour", end_hour AS "endHour", days
         FROM vm_time_restrictions WHERE child_id = $1`,
      [childId]
    );

    res.json({ child, timeRestriction: timeRestriction ?? { enabled: false, startHour: 8, endHour: 21, days: "mon,tue,wed,thu,fri,sat,sun" } });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

// ── Update time restrictions ──────────────────────────────────────────────────
router.put("/children/:childId/time-restrictions", async (req, res) => {
  try {
    const { childId } = req.params;
    const { enabled, startHour, endHour, days } = req.body as {
      enabled: boolean; startHour: number; endHour: number; days: string;
    };

    await query(
      `INSERT INTO vm_time_restrictions (child_id, enabled, start_hour, end_hour, days)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (child_id) DO UPDATE
         SET enabled = $2, start_hour = $3, end_hour = $4, days = $5`,
      [childId, enabled, startHour, endHour, days]
    );

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

// ── Check if child has access right now ──────────────────────────────────────
router.get("/check-access/:childId", async (req, res) => {
  try {
    const { childId } = req.params;

    const restriction = await queryOne<{
      enabled: boolean; startHour: number; endHour: number; days: string;
    }>(
      `SELECT enabled, start_hour AS "startHour", end_hour AS "endHour", days
         FROM vm_time_restrictions WHERE child_id = $1`,
      [childId]
    );

    if (!restriction || !restriction.enabled) {
      res.json({ allowed: true });
      return;
    }

    const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const now = new Date();
    const currentDay = dayNames[now.getDay()];
    const currentHour = now.getHours();
    const allowedDays = restriction.days.split(",");

    const dayAllowed = allowedDays.includes(currentDay);
    const hourAllowed = currentHour >= restriction.startHour && currentHour < restriction.endHour;

    res.json({
      allowed: dayAllowed && hourAllowed,
      startHour: restriction.startHour,
      endHour: restriction.endHour,
      days: restriction.days,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

// ── Contact approvals ─────────────────────────────────────────────────────────
router.get("/children/:childId/contacts", async (req, res) => {
  try {
    const { childId } = req.params;

    const contacts = await query<{
      contactId: string; displayName: string; username: string | null;
      avatar: string | null; status: string; requestedAt: number;
    }>(
      `SELECT ca.contact_id AS "contactId",
              u.display_name AS "displayName",
              u.username,
              u.avatar,
              ca.status,
              ca.requested_at AS "requestedAt"
         FROM vm_contact_approvals ca
         JOIN vm_users u ON u.id = ca.contact_id
        WHERE ca.child_id = $1
        ORDER BY ca.requested_at DESC`,
      [childId]
    );

    res.json({ contacts });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

router.put("/children/:childId/contacts/:contactId", async (req, res) => {
  try {
    const { childId, contactId } = req.params;
    const { status } = req.body as { status: "approved" | "blocked" };

    if (!["approved", "blocked"].includes(status)) {
      res.status(400).json({ error: "status must be approved or blocked" });
      return;
    }

    await query(
      `INSERT INTO vm_contact_approvals (child_id, contact_id, status, reviewed_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (child_id, contact_id) DO UPDATE
         SET status = $3, reviewed_at = $4`,
      [childId, contactId, status, Date.now()]
    );

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

// Request contact approval (called from child's device)
router.post("/children/:childId/contacts/request", async (req, res) => {
  try {
    const { childId } = req.params;
    const { contactId } = req.body as { contactId: string };

    await query(
      `INSERT INTO vm_contact_approvals (child_id, contact_id, status)
       VALUES ($1, $2, 'pending')
       ON CONFLICT (child_id, contact_id) DO NOTHING`,
      [childId, contactId]
    );

    res.json({ ok: true, status: "pending" });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

// Check if a contact is approved for a child
router.get("/children/:childId/contacts/:contactId/status", async (req, res) => {
  try {
    const { childId, contactId } = req.params;

    const row = await queryOne<{ status: string }>(
      `SELECT status FROM vm_contact_approvals WHERE child_id = $1 AND contact_id = $2`,
      [childId, contactId]
    );

    res.json({ status: row?.status ?? "none" });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

// ── AI content flags ──────────────────────────────────────────────────────────
router.get("/children/:childId/flags", async (req, res) => {
  try {
    const { childId } = req.params;
    const { reviewed } = req.query as { reviewed?: string };

    const whereReviewed = reviewed === "true"
      ? "AND cf.is_reviewed = true"
      : reviewed === "false"
      ? "AND cf.is_reviewed = false"
      : "";

    const flags = await query<{
      id: string; flaggedText: string; severity: string;
      aiReason: string | null; isReviewed: boolean; createdAt: number;
      senderName: string | null; chatId: string | null;
    }>(
      `SELECT cf.id,
              cf.flagged_text  AS "flaggedText",
              cf.severity,
              cf.ai_reason     AS "aiReason",
              cf.is_reviewed   AS "isReviewed",
              cf.created_at    AS "createdAt",
              cf.chat_id       AS "chatId",
              u.display_name   AS "senderName"
         FROM vm_content_flags cf
         LEFT JOIN vm_users u ON u.id = cf.sender_id
        WHERE cf.child_id = $1 ${whereReviewed}
        ORDER BY cf.created_at DESC
        LIMIT 100`,
      [childId]
    );

    res.json({ flags });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

router.patch("/children/:childId/flags/:flagId", async (req, res) => {
  try {
    const { childId, flagId } = req.params;

    await query(
      `UPDATE vm_content_flags SET is_reviewed = true
        WHERE id = $1 AND child_id = $2`,
      [flagId, childId]
    );

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

export default router;
