import { test } from "node:test";
import assert from "node:assert/strict";
import { mapRecoveryEmailResponse, parseRetryAfterSeconds, recoveryEmailCopy, RECOVERY_EMAIL_SENT_COPY } from "./recovery-email.ts";

test("200 is always generic sent copy", () => {
  assert.equal(mapRecoveryEmailResponse(200), "sent");
  assert.equal(recoveryEmailCopy({ result: "sent" }).text, RECOVERY_EMAIL_SENT_COPY);
});

test("400 codes map case-insensitively, incl. legacy code", () => {
  assert.equal(mapRecoveryEmailResponse(400, "IDENTIFIER_REQUIRED"), "missing_target");
  assert.equal(mapRecoveryEmailResponse(400, "email_or_phone_required"), "missing_target");
  assert.equal(mapRecoveryEmailResponse(400, "invalid_email"), "invalid_email");
  assert.equal(mapRecoveryEmailResponse(400, "INVALID_PHONE"), "invalid_phone");
  assert.equal(mapRecoveryEmailResponse(400), "missing_target");
});

test("429 / 503 / 404", () => {
  assert.equal(mapRecoveryEmailResponse(429, "RATE_LIMITED"), "rate_limited");
  assert.equal(mapRecoveryEmailResponse(429, "rate_limited"), "rate_limited");
  assert.equal(mapRecoveryEmailResponse(503, "email_delivery_unavailable"), "unavailable");
  assert.equal(mapRecoveryEmailResponse(404), "unavailable");
  assert.equal(mapRecoveryEmailResponse(500), "sent");
});

test("retry-after parsing and copy", () => {
  assert.equal(parseRetryAfterSeconds(30, null), 30);
  assert.equal(parseRetryAfterSeconds(undefined, "120"), 120);
  assert.equal(parseRetryAfterSeconds(undefined, "Wed, 21 Oct 2026 07:28:00 GMT"), undefined);
  assert.match(recoveryEmailCopy({ result: "rate_limited", retryAfterSeconds: 30 }).text, /about 30 seconds/);
  assert.match(recoveryEmailCopy({ result: "rate_limited", retryAfterSeconds: 600 }).text, /about 10 minutes/);
  assert.equal(recoveryEmailCopy({ result: "rate_limited" }).text, "Too many tries — try again later.");
  assert.equal(recoveryEmailCopy({ result: "unavailable" }).text, "Email recovery not available yet.");
});
