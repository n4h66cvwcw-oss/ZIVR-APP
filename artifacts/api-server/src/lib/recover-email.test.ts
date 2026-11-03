import assert from "node:assert/strict";
import test from "node:test";
import {
  SlidingWindowRateLimiter,
  IP_IDENTIFIER_RULES,
  clientIp,
  isValidEmail,
  maskEmail,
  normalizeEmail,
  phoneLookupCandidates,
} from "./recover-email";
import { MailNotConfigured, buildRecoveryCodeEmail, getSmtpConfig, isMailConfigured } from "./mail-config";

test("normalizeEmail trims + lowercases and rejects non-strings", () => {
  assert.equal(normalizeEmail("  Jay@Example.COM "), "jay@example.com");
  assert.equal(normalizeEmail("   "), null);
  assert.equal(normalizeEmail(undefined), null);
  assert.equal(normalizeEmail(42), null);
});

test("isValidEmail basic shape", () => {
  for (const ok of ["jay@zivr.app", "a.b+tag@mail.example.co", "x@sub-domain.io"]) {
    assert.equal(isValidEmail(ok), true, ok);
  }
  for (const bad of ["", "jay", "@zivr.app", "jay@", "jay@zivr", "a@@b.co", "a b@c.co", "a@b.c", "a..b@c.co", "a@-b.co", `${"x".repeat(65)}@c.co`]) {
    assert.equal(isValidEmail(bad), false, bad);
  }
});

test("maskEmail never logs the full local part", () => {
  assert.equal(maskEmail("jay@zivr.app"), "j***@zivr.app");
});

test("phone candidates: every US format maps to the same key and includes E.164", () => {
  const forms = ["+17608803807", "17608803807", "7608803807", "(760) 880-3807", "760.880.3807"];
  const keys = new Set<string>();
  for (const f of forms) {
    const c = phoneLookupCandidates(f);
    assert.ok(c, f);
    keys.add(c!.key);
    assert.ok(c!.exact.includes("+17608803807"), f);
    assert.ok(c!.digits.includes("17608803807"), f);
    assert.ok(c!.digits.includes("7608803807"), f);
  }
  assert.deepEqual([...keys], ["17608803807"]);
});

test("phone candidates: non-US with country code", () => {
  const c = phoneLookupCandidates("020 7946 0958", "GB");
  assert.ok(c);
  assert.ok(c!.exact.includes("+442079460958"));
});

test("phone candidates: junk rejected", () => {
  assert.equal(phoneLookupCandidates("12"), null);
  assert.equal(phoneLookupCandidates(""), null);
  assert.equal(phoneLookupCandidates(undefined), null);
  assert.equal(phoneLookupCandidates("1".repeat(16)), null);
});

test("rate limiter: 3 per hour, 10 per day per key", () => {
  let now = 1_000_000;
  const limiter = new SlidingWindowRateLimiter(IP_IDENTIFIER_RULES, () => now);
  for (let i = 0; i < 3; i++) assert.equal(limiter.hit("k").allowed, true);
  const blocked = limiter.hit("k");
  assert.equal(blocked.allowed, false);
  assert.ok(!blocked.allowed && blocked.retryAfterMs > 0 && blocked.retryAfterMs <= 3_600_000);
  assert.equal(limiter.hit("other").allowed, true, "keys are independent");

  // Walk through the day: 3 per hour until the daily cap of 10.
  let allowed = 3;
  for (let hour = 1; hour < 24; hour++) {
    now += 3_600_000;
    for (let i = 0; i < 3; i++) if (limiter.hit("k").allowed) allowed++;
  }
  assert.equal(allowed, 10);

  // After 24h from the first hits, it frees up again.
  now += 3_600_000 * 2;
  assert.equal(limiter.hit("k").allowed, true);
});

test("rate limiter prune drops stale keys", () => {
  let now = 0;
  const limiter = new SlidingWindowRateLimiter([{ windowMs: 1000, max: 1 }], () => now);
  limiter.hit("a");
  limiter.hit("b");
  assert.equal(limiter.size(), 2);
  now = 5000;
  limiter.prune();
  assert.equal(limiter.size(), 0);
});

test("clientIp prefers first X-Forwarded-For hop", () => {
  const req = (h: Record<string, string>, ip?: string) => ({ header: (n: string) => h[n.toLowerCase()], ip });
  assert.equal(clientIp(req({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }, "10.0.0.1")), "1.2.3.4");
  assert.equal(clientIp(req({}, "5.6.7.8")), "5.6.7.8");
});

test("SMTP config: missing vars -> MailNotConfigured; defaults 465 + from=user", () => {
  assert.throws(() => getSmtpConfig({}), (e: unknown) => e instanceof MailNotConfigured && e.missing.length === 3);
  assert.equal(isMailConfigured({ SMTP_HOST: "smtp.migadu.com", SMTP_USER: "u@zivr.app" }), false);
  const cfg = getSmtpConfig({ SMTP_HOST: "smtp.migadu.com", SMTP_USER: "u@zivr.app", SMTP_PASS: "p" });
  assert.equal(cfg.port, 465);
  assert.equal(cfg.secure, true);
  assert.equal(cfg.from, "u@zivr.app");
  const starttls = getSmtpConfig({ SMTP_HOST: "h", SMTP_USER: "u", SMTP_PASS: "p", SMTP_PORT: "587", SMTP_FROM: "ZIVR <n@zivr.app>" });
  assert.equal(starttls.secure, false);
  assert.equal(starttls.from, "ZIVR <n@zivr.app>");
});

test("recovery email body contains the code and escapes display name", () => {
  const m = buildRecoveryCodeEmail({ code: "abc_DEF-123", displayName: "<b>Jay</b>" });
  assert.ok(m.text.includes("abc_DEF-123"));
  assert.ok(m.html.includes("abc_DEF-123"));
  assert.ok(m.html.includes("&lt;b&gt;Jay&lt;/b&gt;"));
  assert.ok(!m.html.includes("<b>Jay</b>"));
});
