import { normalizePhoneNumber } from "./phone-number";

/**
 * Pure helpers for POST /users/recover/request-email.
 * No DB / SMTP imports here so they stay unit-testable.
 */

const MAX_EMAIL_LENGTH = 254;
const MAX_LOCAL_LENGTH = 64;

/** Trim + lowercase. Returns null for non-strings / empty input. */
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const clean = raw.trim().toLowerCase();
  return clean ? clean : null;
}

/** Basic shape check (not RFC 5322): one @, no whitespace, dotted domain. */
export function isValidEmail(email: string): boolean {
  if (!email || email.length > MAX_EMAIL_LENGTH) return false;
  if (/[\s<>()[\]\\,;:"]/.test(email)) return false;
  const at = email.indexOf("@");
  if (at <= 0 || at !== email.lastIndexOf("@")) return false;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (local.length > MAX_LOCAL_LENGTH) return false;
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) return false;
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(domain)) {
    return false;
  }
  const tld = domain.slice(domain.lastIndexOf(".") + 1);
  return tld.length >= 2;
}

/** "jay@example.com" -> "j***@example.com" for logs. */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  return `${email[0]}***${email.slice(at)}`;
}

export type PhoneLookup = {
  /** Canonical key used for rate limiting (digits, US 10-digit promoted to 1XXXXXXXXXX). */
  key: string;
  /** Exact `phone` column values to match (E.164 + legacy raw shapes). */
  exact: string[];
  /** Digit-only forms to match against regexp_replace(phone, '[^0-9]', '', 'g'). */
  digits: string[];
};

/**
 * Build every plausible stored shape for a user-typed phone so legacy rows
 * (pre-E.164 backfill) still match: "+17608803807", "17608803807",
 * "7608803807", "(760) 880-3807" all resolve to the same candidates.
 * Mirrors users.ts: libphonenumber E.164 via normalizePhoneNumber, default US.
 */
export function phoneLookupCandidates(
  rawPhone: unknown,
  phoneCountryCode?: unknown,
): PhoneLookup | null {
  if (typeof rawPhone !== "string") return null;
  const trimmed = rawPhone.trim();
  const onlyDigits = trimmed.replace(/\D/g, "");
  if (onlyDigits.length < 7 || onlyDigits.length > 15) return null;

  const country =
    typeof phoneCountryCode === "string" && phoneCountryCode.trim()
      ? phoneCountryCode.trim().toUpperCase()
      : "US";

  const digits = new Set<string>([onlyDigits]);
  if (onlyDigits.length === 10) digits.add(`1${onlyDigits}`);
  if (onlyDigits.length === 11 && onlyDigits.startsWith("1")) digits.add(onlyDigits.slice(1));

  let e164: string | null = null;
  try {
    e164 = normalizePhoneNumber({ phone: trimmed, phoneCountryCode: country }) ?? null;
  } catch {
    e164 = null;
  }
  if (!e164 && trimmed.startsWith("+")) {
    try {
      // "+<cc>…" parses without a matching region hint.
      e164 = normalizePhoneNumber({ phone: trimmed, phoneCountryCode: "US" }) ?? null;
    } catch {
      e164 = null;
    }
  }
  if (e164) digits.add(e164.replace(/\D/g, ""));

  const exact = new Set<string>();
  if (e164) exact.add(e164);
  exact.add(trimmed);
  for (const d of digits) {
    exact.add(d);
    exact.add(`+${d}`);
  }

  const key = e164
    ? e164.replace(/\D/g, "")
    : onlyDigits.length === 10
      ? `1${onlyDigits}`
      : onlyDigits;

  return { key, exact: [...exact], digits: [...digits] };
}

export type RateLimitRule = { windowMs: number; max: number };
export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterMs: number };

/**
 * In-memory sliding-window limiter. Per-instance only (Autoscale may run
 * several instances, so effective limit is max × instances) — fine for beta.
 */
export class SlidingWindowRateLimiter {
  private readonly hits = new Map<string, number[]>();
  private readonly longestWindowMs: number;
  private calls = 0;

  constructor(
    private readonly rules: RateLimitRule[],
    private readonly now: () => number = Date.now,
  ) {
    if (rules.length === 0) throw new Error("at least one rate limit rule is required");
    this.longestWindowMs = Math.max(...rules.map((rule) => rule.windowMs));
  }

  /** Records a hit when allowed; a blocked attempt is not recorded. */
  hit(key: string): RateLimitResult {
    const now = this.now();
    if (++this.calls % 500 === 0) this.prune(now);

    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.longestWindowMs);
    let retryAfterMs = 0;
    for (const rule of this.rules) {
      const inWindow = recent.filter((t) => now - t < rule.windowMs);
      if (inWindow.length >= rule.max) {
        const oldest = inWindow[inWindow.length - rule.max]!;
        retryAfterMs = Math.max(retryAfterMs, rule.windowMs - (now - oldest));
      }
    }
    if (retryAfterMs > 0) {
      this.hits.set(key, recent);
      return { allowed: false, retryAfterMs };
    }
    recent.push(now);
    this.hits.set(key, recent);
    return { allowed: true };
  }

  prune(now = this.now()): void {
    for (const [key, times] of this.hits) {
      const recent = times.filter((t) => now - t < this.longestWindowMs);
      if (recent.length === 0) this.hits.delete(key);
      else this.hits.set(key, recent);
    }
  }

  size(): number {
    return this.hits.size;
  }
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Spec: ip + identifier → 3 / hour, 10 / day. */
export const IP_IDENTIFIER_RULES: RateLimitRule[] = [
  { windowMs: HOUR_MS, max: 3 },
  { windowMs: DAY_MS, max: 10 },
];
/** Same identifier from any IP (stops inbox-flooding via rotating IPs). */
export const IDENTIFIER_RULES: RateLimitRule[] = [
  { windowMs: HOUR_MS, max: 5 },
  { windowMs: DAY_MS, max: 20 },
];
/** One IP probing many identifiers. */
export const IP_RULES: RateLimitRule[] = [
  { windowMs: HOUR_MS, max: 30 },
  { windowMs: DAY_MS, max: 100 },
];

/** First X-Forwarded-For hop (Replit proxy), else socket address. */
export function clientIp(req: {
  header(name: string): string | undefined;
  ip?: string;
  socket?: { remoteAddress?: string };
}): string {
  const forwarded = req.header("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || req.ip || req.socket?.remoteAddress || "unknown";
}
