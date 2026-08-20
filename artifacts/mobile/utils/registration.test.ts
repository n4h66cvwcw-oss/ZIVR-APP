import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRecoveredAccountUpdate,
  buildRegistrationOptions,
} from "./registration.ts";

test("onboarding registration keeps a pre-set primary language", () => {
  const request = buildRegistrationOptions({
    displayName: "Maria",
    primaryLanguage: "es",
  });

  assert.equal(request.preferredLanguage, "es");
});

test("onboarding leaves an undefined language for the server default", () => {
  const request = buildRegistrationOptions({
    displayName: "Alex",
    primaryLanguage: undefined,
  });

  assert.equal(request.preferredLanguage, undefined);
});

test("recovered accounts do not overwrite their server language when local storage is empty", () => {
  const update = buildRecoveredAccountUpdate(
    buildRegistrationOptions({
      displayName: "Alex",
      primaryLanguage: undefined,
    }),
  );

  assert.equal("preferredLanguage" in update, false);
});