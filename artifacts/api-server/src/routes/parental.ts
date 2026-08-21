import { Router } from "express";
import { query, queryOne } from "../lib/db";
import { getAuthUserId, signToken } from "../lib/auth";
import { getIO } from "../lib/socket";
import { sendExpoPush } from "../lib/push";

const router = Router();

/** Verify the request is authenticated as a parent of the given child. */
async function requireParentOf(req: Parameters<typeof getAuthUserId>[0], childId: string): Promise<string | null> {
  const authUserId = getAuthUserId(req);
  if (!authUserId) return null;
  const link = await queryOne<{ parent_id: string }>(
    `SELECT parent_id FROM vm_parent_child WHERE parent_id = $1 AND child_id = $2`,
    [authUserId, childId]
  );
  return link ? authUserId : null;
}

/** Allow either the child themself or one of their parents. */
async function requireParentOrSelf(req: Parameters<typeof getAuthUserId>[0], childId: string): Promise<string | null> {
  const authUserId = getAuthUserId(req);
  if (!authUserId) return null;
  if (authUserId === childId) return authUserId;
  const link = await queryOne<{ parent_id: string }>(
    `SELECT parent_id FROM vm_parent_child WHERE parent_id = $1 AND child_id = $2`,
    [authUserId, childId]
  );
  return link ? authUserId : null;
}

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

    const authUserId = getAuthUserId(req);
    if (!authUserId || authUserId !== parentId) {
      res.status(401).json({ error: "Invalid or missing auth token" });
      return;
    }

    // Ensure parent exists and set their account_type to 'parent'
    await query(
      `UPDATE vm_users SET account_type = 'parent' WHERE id = $1`,
      [parentId]
    );

    // Create child user. The child's auth token is handed to the authenticated
    // parent (parent-mediated bootstrap) — there is no public claim endpoint.
    const child = await queryOne<{ id: string }>(
      `INSERT INTO vm_users (display_name, username, account_type, token_claimed)
       VALUES ($1, $2, 'child', true) RETURNING id`,
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

    res.json({ child: { id: child.id, displayName, username, authToken: signToken(child.id) } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "error";
    if (msg.includes("unique")) {
      res.status(409).json({ error: "Username already taken" });
    } else {
      res.status(500).json({ error: msg });
    }
  }
});

// ── Recover a child's auth token (authenticated parent only) ─────────────────
// Secure token recovery for child accounts: children never claim tokens
// themselves; a verified parent can (re)fetch the child's credential.
router.post("/children/:childId/token", async (req, res) => {
  try {
    const { childId } = req.params;
    if (!(await requireParentOf(req, childId))) {
      res.status(403).json({ error: "Only this child's parent can fetch their credential" });
      return;
    }
    await query(`UPDATE vm_users SET token_claimed = true WHERE id = $1`, [childId]);
    res.json({ authToken: signToken(childId) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

// ── List children for a parent ────────────────────────────────────────────────
router.get("/children", async (req, res) => {
  try {
    const { parentId } = req.query as { parentId: string };
    if (!parentId) { res.status(400).json({ error: "parentId required" }); return; }
    const authUserId = getAuthUserId(req);
    if (!authUserId || authUserId !== parentId) {
      res.status(401).json({ error: "Invalid or missing auth token" });
      return;
    }

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
    if (!(await requireParentOrSelf(req, childId))) {
      res.status(403).json({ error: "Not authorized for this child account" });
      return;
    }

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
      overrideUntil: number | null;
    }>(
      `SELECT enabled, start_hour AS "startHour", end_hour AS "endHour", days,
              CASE WHEN override_until > $2 THEN override_until::double precision ELSE NULL END
                AS "overrideUntil"
         FROM vm_time_restrictions WHERE child_id = $1`,
      [childId, Date.now()]
    );

    res.json({
      child,
      timeRestriction: timeRestriction ?? {
        enabled: false,
        startHour: 8,
        endHour: 21,
        days: "mon,tue,wed,thu,fri,sat,sun",
        overrideUntil: null,
      },
    });
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

    // Only a parent of this child may change time restrictions
    if (!(await requireParentOf(req, childId))) {
      res.status(403).json({ error: "Only this child's parent can change time restrictions" });
      return;
    }

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

// ── Grant a temporary schedule override ──────────────────────────────────────
router.put("/children/:childId/override", async (req, res) => {
  try {
    const { childId } = req.params;
    const { durationHours } = req.body as { durationHours?: unknown };
    const hours = Number(durationHours);

    if (!Number.isInteger(hours) || ![1, 2].includes(hours)) {
      res.status(400).json({ error: "durationHours must be 1 or 2" });
      return;
    }

    if (!(await requireParentOf(req, childId))) {
      res.status(403).json({ error: "Only this child's parent can grant an override" });
      return;
    }

    const overrideUntil = Date.now() + hours * 60 * 60 * 1000;
    const saved = await queryOne<{ overrideUntil: number }>(
      `INSERT INTO vm_time_restrictions (child_id, override_until)
       VALUES ($1, $2)
       ON CONFLICT (child_id) DO UPDATE
         SET override_until = EXCLUDED.override_until
       RETURNING override_until::double precision AS "overrideUntil"`,
      [childId, overrideUntil]
    );

    if (!saved) {
      res.status(500).json({ error: "Could not save the temporary override" });
      return;
    }

    getIO()?.to(`user:${childId}`).emit("time:override", {
      childId,
      overrideUntil: saved.overrideUntil,
    });

    res.json({ ok: true, overrideUntil: saved.overrideUntil });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

// ── Check if child has access right now ──────────────────────────────────────
router.get("/check-access/:childId", async (req, res) => {
  try {
    const { childId } = req.params;
    if (!(await requireParentOrSelf(req, childId))) {
      res.status(403).json({ error: "Not authorized for this child account" });
      return;
    }

    const nowTimestamp = Date.now();
    const restriction = await queryOne<{
      enabled: boolean; startHour: number; endHour: number; days: string;
      overrideUntil: number | null;
    }>(
      `SELECT enabled, start_hour AS "startHour", end_hour AS "endHour", days,
              CASE WHEN override_until > $2 THEN override_until::double precision ELSE NULL END
                AS "overrideUntil"
         FROM vm_time_restrictions WHERE child_id = $1`,
      [childId, nowTimestamp]
    );

    if (!restriction || !restriction.enabled) {
      res.json({
        allowed: true,
        overrideUntil: restriction?.overrideUntil ?? null,
        overrideRemainingMs: restriction?.overrideUntil
          ? restriction.overrideUntil - nowTimestamp
          : null,
      });
      return;
    }

    if (restriction.overrideUntil !== null) {
      res.json({
        allowed: true,
        overrideUntil: restriction.overrideUntil,
        overrideRemainingMs: restriction.overrideUntil - nowTimestamp,
        startHour: restriction.startHour,
        endHour: restriction.endHour,
        days: restriction.days,
      });
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
      overrideUntil: null,
      overrideRemainingMs: null,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

// ── Contact approvals ─────────────────────────────────────────────────────────
router.get("/children/:childId/contacts", async (req, res) => {
  try {
    const { childId } = req.params;
    if (!(await requireParentOrSelf(req, childId))) {
      res.status(403).json({ error: "Not authorized for this child account" });
      return;
    }

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

    // Only a parent of this child may approve or block contacts
    const parentId = await requireParentOf(req, childId);
    if (!parentId) {
      res.status(403).json({ error: "Only this child's parent can review contacts" });
      return;
    }

    // This is a single-winner state transition: the only request that inserts
    // or changes the status gets a returned row. Concurrent approval taps
    // therefore cannot send duplicate child notifications.
    const changed = await queryOne<{ status: string }>(
      `INSERT INTO vm_contact_approvals (child_id, contact_id, status, reviewed_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (child_id, contact_id) DO UPDATE
          SET status = EXCLUDED.status, reviewed_at = EXCLUDED.reviewed_at
        WHERE vm_contact_approvals.status IS DISTINCT FROM EXCLUDED.status
       RETURNING status`,
      [childId, contactId, status, Date.now()]
    );

    // Notify the child only for the request that actually reaches approved.
    if (status === "approved" && changed?.status === "approved") {
      const [child, contact] = await Promise.all([
        queryOne<{ push_token: string | null }>(
          `SELECT push_token FROM vm_users WHERE id = $1`,
          [childId]
        ),
        queryOne<{ display_name: string }>(
          `SELECT display_name FROM vm_users WHERE id = $1`,
          [contactId]
        ),
      ]);
      const contactName = contact?.display_name ?? "this contact";
      const notification = {
        childId,
        contactId,
        contactName,
      };

      const io = getIO();
      io?.to(`user:${childId}`).emit("contact:approved", notification);

      const token = child?.push_token;
      if (token?.startsWith("ExponentPushToken")) {
        await sendExpoPush(
          [token],
          "Contact approved",
          `You can now chat with ${contactName}`,
          "default",
          { type: "contact_approved", ...notification },
        );
      }
    }

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
    if (!(await requireParentOrSelf(req, childId))) {
      res.status(403).json({ error: "Not authorized for this child account" });
      return;
    }

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
    if (!(await requireParentOrSelf(req, childId))) {
      res.status(403).json({ error: "Not authorized for this child account" });
      return;
    }

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
    if (!(await requireParentOf(req, childId))) {
      res.status(403).json({ error: "Only this child's parent can view flags" });
      return;
    }

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
    if (!(await requireParentOf(req, childId))) {
      res.status(403).json({ error: "Only this child's parent can review flags" });
      return;
    }

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
