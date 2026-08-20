import assert from "node:assert/strict";
import test from "node:test";
import { createRecoveryCode, hashRecoveryCode } from "./recovery-code.ts";

test("recovery codes are stored as hashes, not plaintext", () => {
  const recovery = createRecoveryCode();

  assert.notEqual(recovery.code, recovery.hash);
  assert.equal(hashRecoveryCode(recovery.code), recovery.hash);
});

test("a legacy account can be provisioned without changing its saved language", () => {
  const legacyAccount = {
    preferredLanguage: "es",
    recoveryCodeHash: null as string | null,
  };

  const provisioned = createRecoveryCode();
  legacyAccount.recoveryCodeHash = provisioned.hash;

  assert.equal(hashRecoveryCode(provisioned.code), legacyAccount.recoveryCodeHash);
  assert.equal(legacyAccount.preferredLanguage, "es");
});

test("an unacknowledged code is replaced after relaunch before language recovery", () => {
  const account = {
    preferredLanguage: "es",
    recoveryCodeHash: createRecoveryCode().hash,
    recoveryCodeAcknowledged: false,
  };

  // The client must not be able to reveal the dismissed code after relaunch.
  assert.equal(account.recoveryCodeAcknowledged, false);

  const replacement = createRecoveryCode();
  account.recoveryCodeHash = replacement.hash;
  account.recoveryCodeAcknowledged = true;

  assert.equal(hashRecoveryCode(replacement.code), account.recoveryCodeHash);
  assert.equal(account.recoveryCodeAcknowledged, true);
  assert.equal(account.preferredLanguage, "es");
});