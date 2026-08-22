import assert from "node:assert/strict";
import test from "node:test";
import { shouldNotifyForSeverity } from "./content-alert-preferences.ts";

test("all content alerts include low, medium, and high flags", () => {
  assert.equal(shouldNotifyForSeverity("low", "all"), true);
  assert.equal(shouldNotifyForSeverity("medium", "all"), true);
  assert.equal(shouldNotifyForSeverity("high", "all"), true);
});

test("medium alert preference excludes low flags", () => {
  assert.equal(shouldNotifyForSeverity("low", "medium"), false);
  assert.equal(shouldNotifyForSeverity("medium", "medium"), true);
  assert.equal(shouldNotifyForSeverity("high", "medium"), true);
});

test("high alert preference only includes high flags", () => {
  assert.equal(shouldNotifyForSeverity("low", "high"), false);
  assert.equal(shouldNotifyForSeverity("medium", "high"), false);
  assert.equal(shouldNotifyForSeverity("high", "high"), true);
});

test("unknown preference safely defaults to medium-and-above", () => {
  assert.equal(shouldNotifyForSeverity("low", null), false);
  assert.equal(shouldNotifyForSeverity("medium", "unexpected"), true);
});