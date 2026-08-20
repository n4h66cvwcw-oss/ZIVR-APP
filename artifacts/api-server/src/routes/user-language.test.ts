import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_PREFERRED_LANGUAGE,
  normalizePreferredLanguage,
} from "./user-language.ts";

test("server preserves a selected language for the registered user", () => {
  assert.equal(normalizePreferredLanguage("es"), "es");
});

test("server defaults safely when registration has no language", () => {
  assert.equal(normalizePreferredLanguage(undefined), DEFAULT_PREFERRED_LANGUAGE);
  assert.equal(normalizePreferredLanguage(""), DEFAULT_PREFERRED_LANGUAGE);
  assert.equal(normalizePreferredLanguage("   "), DEFAULT_PREFERRED_LANGUAGE);
});