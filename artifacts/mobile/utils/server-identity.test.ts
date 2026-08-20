import assert from "node:assert/strict";
import test from "node:test";
import { getRecoveredLanguageUpdate } from "./language-sync.ts";
import {
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