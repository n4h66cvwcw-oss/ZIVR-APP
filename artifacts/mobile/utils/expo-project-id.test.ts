import assert from "node:assert/strict";
import test from "node:test";
import { LOCKED_EAS_PROJECT_ID, resolveExpoProjectId } from "./expo-project-id.ts";

const REAL_ID = "635c1471-d522-4ada-8309-2a5faa6fd6f4";

test("prefers the EAS manifest project id", () => {
  assert.equal(resolveExpoProjectId(REAL_ID, "other-project"), REAL_ID);
});

test("uses app.json extra.eas.projectId when the manifest has none", () => {
  assert.equal(resolveExpoProjectId(undefined, REAL_ID), REAL_ID);
  assert.equal(resolveExpoProjectId(null, REAL_ID), REAL_ID);
});

test("skips the YOUR_EAS_PROJECT_ID placeholder and blank values", () => {
  assert.equal(
    resolveExpoProjectId("YOUR_EAS_PROJECT_ID", "  ", REAL_ID),
    REAL_ID,
  );
  assert.equal(resolveExpoProjectId("YOUR_EAS_PROJECT_ID", ""), LOCKED_EAS_PROJECT_ID);
});

test("falls back to the locked EAS project id", () => {
  assert.equal(resolveExpoProjectId(undefined, null), LOCKED_EAS_PROJECT_ID);
  assert.equal(LOCKED_EAS_PROJECT_ID, REAL_ID);
});
