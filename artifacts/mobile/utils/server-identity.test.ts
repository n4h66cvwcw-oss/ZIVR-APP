import assert from "node:assert/strict";
import test from "node:test";
import { getRecoveredLanguageUpdate } from "./language-sync.ts";
import {
  pickRehydratedAuthToken,
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
test("rehydrates the auth token from SecureStore when AsyncStorage is empty", () => {
  const secure = serializeServerIdentity({ userId: "u1", authToken: "secure-token" });
  assert.equal(pickRehydratedAuthToken(null, secure), "secure-token");
  assert.equal(pickRehydratedAuthToken("local-token", secure), "local-token");
  assert.equal(pickRehydratedAuthToken(null, null), null);
  assert.equal(pickRehydratedAuthToken(null, "{bad"), null);
});

test("after a 401, prefers a stored token different from the rejected one", () => {
  const secure = serializeServerIdentity({ userId: "u1", authToken: "secure-token" });
  assert.equal(pickRehydratedAuthToken("stale", secure, "stale"), "secure-token");
  // Only the rejected token exists: still returns it so the single retry runs.
  assert.equal(pickRehydratedAuthToken("stale", null, "stale"), "stale");
});
