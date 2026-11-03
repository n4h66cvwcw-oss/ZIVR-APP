import { Router, type Request, type Response, type NextFunction } from "express";
import { query, queryOne } from "../lib/db";
import { getAuthUserId } from "../lib/auth";
import { logger } from "../lib/logger";
import { isMailConfigured, sendRecoveryCodeEmail } from "../lib/mail";
import { ensureUserEmailSchema } from "../lib/user-email-migrate";
import {
  IDENTIFIER_RULES,
  IP_IDENTIFIER_RULES,
  IP_RULES,
  SlidingWindowRateLimiter,
  clientIp,
  isValidEmail,
  normalizeEmail,
  phoneLookupCandidates,
} from "../lib/recover-email";
import { processRecoveryEmailRequest, type RecoverEmailLookup } from "../lib/recover-email-service";

/**
 * Email-based recovery-code request + self-service email on file.
 * Mounted at /users BEFORE the main users router (routes/index.ts), so it is
 * purely additive: users.ts is untouched.
 *
 *   POST  /users/recover/request-email   { email?, phone?, phoneCountryCode? }  public, rate-limited
 *   GET   /users/:id/email                (X-Auth-Token for :id)
 *   PUT   /users/:id/email   { email }    (X-Auth-Token for :id; "" / null clears)
 *   PATCH /users/:id         { email, ... }  email handled here, rest falls through to users.ts
 */
const router = Router();

const ipIdentifierLimiter = new SlidingWindowRateLimiter(IP_IDENTIFIER_RULES);
const identifierLimiter = new SlidingWindowRateLimiter(IDENTIFIER_RULES);
const ipLimiter = new SlidingWindowRateLimiter(IP_RULES);

/** Pad every accepted response to a floor so "found + SMTP" ≈ "not found". */
const MIN_RESPONSE_MS = Number(process.env["RECOVER_EMAIL_MIN_RESPONSE_MS"] ?? 1500);

const EMAIL_CONFLICT_RESPONSE = {
  error: "Email is already linked to another account",
  code: "EMAIL_IN_USE",
} as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

router.post("/recover/request-email", async (req, res) => {
  const startedAt = Date.now();
  const body = (req.body ?? {}) as { email?: unknown; phone?: unknown; phoneCountryCode?: unknown };

  const email = normalizeEmail(body.email);
  const rawPhone = typeof body.phone === "string" ? body.phone.trim() : "";
  if (!email && !rawPhone) {
    res.status(400).json({ error: "email or phone is required", code: "IDENTIFIER_REQUIRED" });
    return;
  }

  let lookup: RecoverEmailLookup;
  let identifier: string;
  if (email) {
    if (!isValidEmail(email)) {
      res.status(400).json({ error: "Invalid email address", code: "INVALID_EMAIL" });
      return;
    }
    lookup = { kind: "email", email };
    identifier = `e:${email}`;
  } else {
    const phone = phoneLookupCandidates(rawPhone, body.phoneCountryCode);
    if (!phone) {
      res.status(400).json({ error: "Invalid phone number", code: "INVALID_PHONE" });
      return;
    }
    lookup = { kind: "phone", phone };
    identifier = `p:${phone.key}`;
  }

  const ip = clientIp(req);
  for (const [limiter, key] of [
    [ipIdentifierLimiter, `${ip}|${identifier}`],
    [identifierLimiter, identifier],
    [ipLimiter, ip],
  ] as const) {
    const verdict = limiter.hit(key);
    if (!verdict.allowed) {
      const retryAfterSeconds = Math.ceil(verdict.retryAfterMs / 1000);
      res.setHeader("Retry-After", String(retryAfterSeconds));
      res.status(429).json({ error: "Too many requests. Try again later.", code: "RATE_LIMITED", retryAfterSeconds });
      return;
    }
  }

  try {
    await ensureUserEmailSchema();
    await processRecoveryEmailRequest(lookup, {
      query,
      isMailConfigured: () => isMailConfigured(),
      sendRecoveryCodeEmail,
      log: logger,
    });
  } catch (error) {
    // Ops error (DB down etc.). Still generic to the client — logged here.
    logger.error(
      { err: error instanceof Error ? error.message : String(error), lookup: lookup.kind },
      "recover/request-email: unexpected failure",
    );
  }

  const elapsed = Date.now() - startedAt;
  if (elapsed < MIN_RESPONSE_MS) await sleep(MIN_RESPONSE_MS - elapsed + Math.floor(Math.random() * 250));
  // Anti-enumeration: same body whether or not an account / email exists.
  res.json({ ok: true });
});

type EmailUpdateResult =
  | { ok: true; email: string | null }
  | { ok: false; status: number; body: Record<string, unknown> };

async function updateOwnEmail(req: Request, rawEmail: unknown): Promise<EmailUpdateResult> {
  const id = String(req.params["id"]);
  const authUserId = getAuthUserId(req);
  if (!authUserId || authUserId !== id) {
    return { ok: false, status: 401, body: { error: "Invalid or missing auth token" } };
  }
  let email: string | null;
  if (rawEmail === null || (typeof rawEmail === "string" && rawEmail.trim() === "")) {
    email = null;
  } else {
    email = normalizeEmail(rawEmail);
    if (!email || !isValidEmail(email)) {
      return { ok: false, status: 400, body: { error: "Invalid email address", code: "INVALID_EMAIL" } };
    }
  }

  await ensureUserEmailSchema();
  try {
    const updated = await queryOne<{ id: string }>(
      email
        ? `UPDATE vm_users SET email = $1::text
            WHERE id = $2::uuid
              AND NOT EXISTS (
                SELECT 1 FROM vm_users other
                 WHERE other.id <> $2::uuid
                   AND other.email IS NOT NULL
                   AND lower(other.email) = $1::text
              )
          RETURNING id`
        : `UPDATE vm_users SET email = $1::text WHERE id = $2::uuid RETURNING id`,
      [email, id],
    );
    if (!updated) {
      const exists = await queryOne<{ id: string }>(`SELECT id FROM vm_users WHERE id = $1`, [id]);
      if (!exists) return { ok: false, status: 404, body: { error: "User not found" } };
      return { ok: false, status: 409, body: { ...EMAIL_CONFLICT_RESPONSE } };
    }
    return { ok: true, email };
  } catch (error) {
    const message = error instanceof Error ? error.message : "error";
    if (message.includes("vm_users_email_lower_unique")) {
      return { ok: false, status: 409, body: { ...EMAIL_CONFLICT_RESPONSE } };
    }
    throw error;
  }
}

router.get("/:id/email", async (req, res) => {
  try {
    const authUserId = getAuthUserId(req);
    if (!authUserId || authUserId !== req.params.id) {
      res.status(401).json({ error: "Invalid or missing auth token" });
      return;
    }
    await ensureUserEmailSchema();
    const row = await queryOne<{ email: string | null }>(
      `SELECT email FROM vm_users WHERE id = $1`,
      [req.params.id],
    );
    if (!row) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ email: row.email || null });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

router.put("/:id/email", async (req, res) => {
  try {
    const result = await updateOwnEmail(req, (req.body ?? {}).email);
    if (!result.ok) {
      res.status(result.status).json(result.body);
      return;
    }
    res.json({ ok: true, email: result.email });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

/**
 * PATCH /users/:id with `email` in the body: validate + save email here, then
 * strip it and fall through to the existing users.ts PATCH for other fields.
 * Note: email is committed before the other fields; if users.ts then returns
 * 409 (phone conflict) the email change stays saved.
 */
router.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  const body = req.body as Record<string, unknown> | undefined;
  if (!body || !Object.prototype.hasOwnProperty.call(body, "email")) {
    next();
    return;
  }
  try {
    const result = await updateOwnEmail(req, body["email"]);
    if (!result.ok) {
      res.status(result.status).json(result.body);
      return;
    }
    delete body["email"];
    next();
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "error" });
  }
});

export default router;
