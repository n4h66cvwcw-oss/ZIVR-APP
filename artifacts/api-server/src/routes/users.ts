import { Router } from "express";
import { query, queryOne } from "../lib/db";

const router = Router();

const USER_SELECT = `
  id,
  display_name   AS "displayName",
  username,
  phone,
  avatar,
  status_message AS "statusMessage",
  is_online      AS "isOnline",
  last_seen      AS "lastSeen"
`;

router.post("/register", async (req, res) => {
  try {
    const { displayName, username, phone, avatar, statusMessage } = req.body as {
      displayName: string;
      username?: string;
      phone?: string;
      avatar?: string;
      statusMessage?: string;
    };

    if (!displayName?.trim()) {
      res.status(400).json({ error: "displayName is required" });
      return;
    }

    const clean = (s?: string) => s?.trim() || null;
    const user = await queryOne<{ id: string }>(
      `INSERT INTO vm_users (display_name, username, phone, avatar, status_message)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [clean(displayName), clean(username), clean(phone), clean(avatar), clean(statusMessage) ?? "Hey there! I'm on VibeMsg"]
    );

    res.json({ user: { id: user!.id, displayName, username, phone } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg.includes("unique")) {
      res.status(409).json({ error: "Username already taken" });
    } else {
      res.status(500).json({ error: msg });
    }
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { displayName, username, phone, avatar, statusMessage } = req.body as Record<string, string | undefined>;

    await query(
      `UPDATE vm_users SET
        display_name   = COALESCE($1, display_name),
        username       = COALESCE($2, username),
        phone          = COALESCE($3, phone),
        avatar         = COALESCE($4, avatar),
        status_message = COALESCE($5, status_message)
       WHERE id = $6`,
      [displayName ?? null, username ?? null, phone ?? null, avatar ?? null, statusMessage ?? null, id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

router.get("/find", async (req, res) => {
  try {
    const { phone, username, q } = req.query as Record<string, string | undefined>;
    let users: unknown[] = [];

    if (phone) {
      users = await query(
        `SELECT ${USER_SELECT} FROM vm_users WHERE phone = $1 LIMIT 20`,
        [phone]
      );
    } else if (username) {
      users = await query(
        `SELECT ${USER_SELECT} FROM vm_users WHERE username ILIKE $1 LIMIT 20`,
        [username + "%"]
      );
    } else if (q) {
      users = await query(
        `SELECT ${USER_SELECT} FROM vm_users WHERE display_name ILIKE $1 OR username ILIKE $1 LIMIT 20`,
        ["%" + q + "%"]
      );
    }

    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const user = await queryOne(
      `SELECT ${USER_SELECT} FROM vm_users WHERE id = $1`,
      [req.params.id]
    );
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

export default router;
