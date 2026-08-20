import assert from "node:assert/strict";
import test from "node:test";
import {
  clearCachedLanguageForIdentitySwitch,
  getRecoveredLanguageUpdate,
} from "./language-sync.ts";

test("restores the server language after account recovery clears the local profile", () => {
  const update = getRecoveredLanguageUpdate({}, "recovered-child", "es");

  assert.deepEqual(update, {
    primaryLanguage: "es",
    primaryLanguageUserId: "recovered-child",
  });
});

test("uses the recovered child's language instead of the prior parent language", () => {
  const update = getRecoveredLanguageUpdate(
    { primaryLanguage: "fr", primaryLanguageUserId: "parent-account" },
    "recovered-child",
    "es",
  );

  assert.deepEqual(update, {
    primaryLanguage: "es",
    primaryLanguageUserId: "recovered-child",
  });
});

test("restores a child language after switching from a legacy parent profile without an owner", () => {
  const legacyParentProfile = { primaryLanguage: "fr" };
  const update = getRecoveredLanguageUpdate(
    { ...legacyParentProfile, ...clearCachedLanguageForIdentitySwitch() },
    "recovered-child",
    "es",
  );

  assert.deepEqual(update, {
    primaryLanguage: "es",
    primaryLanguageUserId: "recovered-child",
  });
});

test("does not replace an intentional local choice for the same account", () => {
  const update = getRecoveredLanguageUpdate(
    { primaryLanguage: "es", primaryLanguageUserId: "account-1" },
    "account-1",
    "fr",
  );

  assert.equal(update, null);
});

test("restores a missing language even when a cached account marker remains", () => {
  const update = getRecoveredLanguageUpdate(
    { primaryLanguageUserId: "account-1" },
    "account-1",
    "es",
  );

  assert.deepEqual(update, {
    primaryLanguage: "es",
    primaryLanguageUserId: "account-1",
  });
});