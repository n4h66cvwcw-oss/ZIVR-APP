import { Router } from "express";
import { query, queryOne } from "../lib/db";
import { signToken, getAuthUserId } from "../lib/auth";
import { normalizePreferredLanguage } from "./user-language";
import { createRecoveryCode, hashRecoveryCode } from "../lib/recovery-code";

const router = Router();

const USER_SELECT = `
  id,
  display_name        AS "displayName",
  username,
  phone,
  avatar,
  status_message      AS "statusMessage",
  preferred_language  AS "preferredLanguage",
  is_online           AS "isOnline",
  last_seen           AS "lastSeen",
  account_type        AS "accountType"
`;

router.post("/register", async (req, res) => {
  try {
    const { displayName, username, phone, avatar, statusMessage, preferredLanguage } = req.body as {
      displayName: string;
      username?: string;
      phone?: string;
      avatar?: string;
      statusMessage?: string;
      preferredLanguage?: string;
    };

    if (!displayName?.trim()) {
      res.status(400).json({ error: "displayName is required" });
      return;
    }

    const clean = (s?: string) => s?.trim() || null;
    const recovery = createRecoveryCode();
    const user = await queryOne<{ id: string }>(
      `INSERT INTO vm_users (
        display_name, username, phone, avatar, status_message,
        preferred_language, recovery_code_hash, recovery_code_acknowledged, token_claimed
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, false, true)
       RETURNING id`,
        [
          clean(displayName),
          clean(username),
          clean(phone),
          clean(avatar),
          clean(statusMessage) ?? "Hey there! I'm on ZIVR",
          normalizePreferredLanguage(preferredLanguage),
          recovery.hash,
        ]
    );

    res.json({
      user: { id: user!.id, displayName, username, phone },
      authToken: signToken(user!.id),
      recoveryCode: recovery.code,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg.includes("unique")) {
      res.status(409).json({ error: "Username already taken" });
    } else {
      res.status(500).json({ error: msg });
    }
  }
});

// A user ID is public data, never a credential. Tokens are issued at
// registration, through verified recovery credentials, or by an authenticated
// parent for a child account.
router.post("/recover", async (req, res) => {
  try {
    const { recoveryCode } = req.body as {
      recoveryCode?: string;
    };
    const cleanCode = recoveryCode?.trim();
    if (!cleanCode) {
      res.status(400).json({ error: "Recovery code is required" });
      return;
    }

    const user = await queryOne<{
      id: string;
      displayName: string;
      username: string | null;
      phone: string | null;
      avatar: string | null;
      statusMessage: string | null;
      preferredLanguage: string | null;
      isOnline: boolean;
      lastSeen: number;
      accountType: "child" | "parent" | null;
    }>(
      `SELECT ${USER_SELECT}
         FROM vm_users
        WHERE recovery_code_hash = $1
        LIMIT 1`,
      [hashRecoveryCode(cleanCode)]
    );
    if (!user) {
      res.status(401).json({ error: "Invalid recovery credentials" });
      return;
    }

    res.json({ user, authToken: signToken(user.id) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

/**
 * One-time upgrade for accounts created before recovery codes existed.
 * The caller must already be authenticated as this exact account; the plaintext
 * code is returned only when the server successfully writes its verifier.
 */
router.post("/:id/recovery-code", async (req, res) => {
  try {
    const { id } = req.params;
    const { rotate } = (req.body ?? {}) as { rotate?: boolean };
    const authUserId = getAuthUserId(req);
    if (!authUserId || authUserId !== id) {
      res.status(401).json({ error: "Invalid or missing auth token" });
      return;
    }

    if (rotate) {
      const recovery = createRecoveryCode();
      const updated = await queryOne<{ id: string }>(
        `UPDATE vm_users
            SET recovery_code_hash = $1,
                recovery_code_acknowledged = false
          WHERE id = $2
        RETURNING id`,
        [recovery.hash, id]
      );
      if (!updated) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      res.json({ recoveryCode: recovery.code, acknowledgementRequired: true });
      return;
    }

    const recovery = createRecoveryCode();
    const provisioned = await queryOne<{ id: string }>(
      `UPDATE vm_users
          SET recovery_code_hash = $1,
              recovery_code_acknowledged = false
        WHERE id = $2
          AND recovery_code_hash IS NULL
      RETURNING id`,
      [recovery.hash, id]
    );
    if (provisioned) {
      res.json({ recoveryCode: recovery.code, acknowledgementRequired: true });
      return;
    }

    const existing = await queryOne<{ recoveryCodeAcknowledged: boolean | null }>(
      `SELECT recovery_code_acknowledged AS "recoveryCodeAcknowledged"
         FROM vm_users
        WHERE id = $1`,
      [id]
    );
    if (!existing) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    // Never reveal an existing code. If it was not acknowledged, the client
    // must explicitly rotate it and save the replacement.
    res.json({
      recoveryCode: null,
      acknowledgementRequired: existing.recoveryCodeAcknowledged !== true,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

router.post("/:id/recovery-code/acknowledge", async (req, res) => {
  try {
    const { id } = req.params;
    const authUserId = getAuthUserId(req);
    if (!authUserId || authUserId !== id) {
      res.status(401).json({ error: "Invalid or missing auth token" });
      return;
    }
    await query(
      `UPDATE vm_users
          SET recovery_code_acknowledged = true
        WHERE id = $1
          AND recovery_code_hash IS NOT NULL`,
      [id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const authUserId = getAuthUserId(req);
    if (!authUserId || authUserId !== id) {
      res.status(401).json({ error: "Invalid or missing auth token" });
      return;
    }
    const { displayName, username, phone, avatar, statusMessage, pushToken, preferredLanguage } = req.body as Record<string, string | undefined>;

    await query(
      `UPDATE vm_users SET
        display_name       = COALESCE($1, display_name),
        username           = COALESCE($2, username),
        phone              = COALESCE($3, phone),
        avatar             = COALESCE($4, avatar),
        status_message     = COALESCE($5, status_message),
        push_token         = COALESCE($6, push_token),
        preferred_language = COALESCE($7, preferred_language)
       WHERE id = $8`,
      [displayName ?? null, username ?? null, phone ?? null, avatar ?? null, statusMessage ?? null, pushToken ?? null, preferredLanguage ?? null, id]
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
