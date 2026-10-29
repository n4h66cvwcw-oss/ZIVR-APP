import assert from "node:assert/strict";
import test from "node:test";
import { getRecoveredLanguageUpdate } from "./language-sync.ts";
import {
  accountRecoveryPrompt,
  messageSendFollowUp,
  resolveRequestAuthToken,
  resolveServerIdentity,
  serializeServerIdentity,
} from "./server-identity.ts";

test("restores a signed-in identity and its server language after AsyncStorage is cleared", () => {
  const recovered = resolveServerIdentity(
    null,
    null,
    serializeServerIdentity({
      userId: "existing-account",
      authToken: "signed-token",
    }),
  );

  assert.deepEqual(recovered, {
    userId: "existing-account",
    authToken: "signed-token",
  });
  assert.deepEqual(getRecoveredLanguageUpdate({}, recovered?.userId ?? null, "es"), {
    primaryLanguage: "es",
    primaryLanguageUserId: "existing-account",
  });
});

test("does not use a malformed recovery identity", () => {
  assert.equal(resolveServerIdentity(null, null, "{invalid"), null);
});

test("recovers a REST auth token from the secure identity when AsyncStorage has none", () => {
  const secureIdentity = serializeServerIdentity({
    userId: "existing-account",
    authToken: "signed-token",
  });

  assert.equal(resolveRequestAuthToken(null, null, secureIdentity), "signed-token");
  assert.equal(resolveRequestAuthToken("", null, secureIdentity), "signed-token");
  assert.equal(resolveRequestAuthToken(null, "async-token", secureIdentity), "async-token");
  assert.equal(resolveRequestAuthToken("memory-token", null, secureIdentity), "memory-token");
  assert.equal(resolveRequestAuthToken(null, null, "{invalid"), null);
  assert.equal(resolveRequestAuthToken(null, null, null), null);
});

test("an auth-failed message send retries once over REST, then asks for account recovery", () => {
  assert.equal(
    messageSendFollowUp({
      ack: { ok: false, error: "Invalid or missing auth token" },
      restAttempted: false,
    }),
    "retry-rest",
  );
  assert.equal(
    messageSendFollowUp({
      ack: { ok: false, error: "Not authenticated as this sender" },
      restAttempted: false,
    }),
    "retry-rest",
  );
  assert.equal(
    messageSendFollowUp({
      ack: { ok: false, error: "Waiting for parent approval before you can chat with this contact." },
      restAttempted: false,
    }),
    "none",
  );
  assert.equal(
    messageSendFollowUp({
      restAttempted: true,
      restStatus: 401,
      restError: "Invalid or missing auth token",
    }),
    "account-recovery",
  );
  assert.equal(
    messageSendFollowUp({ restAttempted: true, restStatus: 500, restError: "error" }),
    "none",
  );
  assert.equal(messageSendFollowUp({ ack: { ok: true }, restAttempted: false }), "none");

  const prompt = accountRecoveryPrompt();
  assert.match(prompt.message, /recovery code/i);
  assert.equal(prompt.confirmLabel, "Recover account");
  assert.doesNotMatch(`${prompt.title} ${prompt.message} ${prompt.confirmLabel}`, /sign out|register/i);
});

test("an Android-style reinstall with both stores wiped requires verified recovery", () => {
  // Android removes both AsyncStorage and SecureStore on uninstall. There must
  // be no silent identity fallback; the onboarding recovery-code flow receives
  // the returned server user and applies this language update after verification.
  assert.equal(resolveServerIdentity(null, null, null), null);
  assert.deepEqual(getRecoveredLanguageUpdate({}, "recovered-account", "es"), {
    primaryLanguage: "es",
    primaryLanguageUserId: "recovered-account",
  });
});