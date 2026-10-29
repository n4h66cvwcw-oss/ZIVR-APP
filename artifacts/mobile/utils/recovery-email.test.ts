import assert from "node:assert/strict";
import test from "node:test";
import {
  RECOVERY_EMAIL_SENT_MESSAGE,
  recoveryEmailProfileUpdate,
  recoveryEmailRequestBody,
} from "./recovery-email.ts";

test("request-email body sends a normalized email and never a code", () => {
  assert.deepEqual(recoveryEmailRequestBody({ email: "  Ada@Example.com " }), {
    email: "ada@example.com",
  });
  const body = recoveryEmailRequestBody({ email: "ada@example.com" });
  assert.equal(body && "recoveryCode" in body, false);
  assert.equal(body && "code" in body, false);
});

test("request-email body omits a blank phone and rejects a bad email", () => {
  assert.deepEqual(recoveryEmailRequestBody({ email: "ada@example.com", phone: "  " }), {
    email: "ada@example.com",
  });
  assert.equal(recoveryEmailRequestBody({ email: "not-an-email" }), null);
  assert.equal(recoveryEmailRequestBody({}), null);
});

test("phone-only request stays available for a later SMS path", () => {
  assert.deepEqual(recoveryEmailRequestBody({ phone: " +15551212 " }), {
    phone: "+15551212",
  });
});

test("profile update matches the existing user patch field name", () => {
  assert.deepEqual(recoveryEmailProfileUpdate("  Me@Mail.com "), { email: "me@mail.com" });
  assert.equal(recoveryEmailProfileUpdate("   "), null);
  assert.equal(recoveryEmailProfileUpdate("me@"), null);
});

test("inbox guidance does not reveal a code", () => {
  assert.equal(
    RECOVERY_EMAIL_SENT_MESSAGE,
    "Check your inbox and spam, then enter the code below.",
  );
  assert.equal(/\b\d{4,}\b/.test(RECOVERY_EMAIL_SENT_MESSAGE), false);
});
