import assert from "node:assert/strict";
import test from "node:test";
import { composerMirrorText, nextComposerHeight } from "./composer-height.ts";

test("mirror text appends a space after a trailing newline and keeps one line when empty", () => {
  assert.equal(composerMirrorText(""), " ");
  assert.equal(composerMirrorText("hello"), "hello");
  assert.equal(composerMirrorText("hello\n"), "hello\n ");
  assert.equal(composerMirrorText("hello\n\n"), "hello\n\n ");
});

test("empty text resets to a single line and a measured mirror height is clamped", () => {
  assert.equal(nextComposerHeight({
    textLength: 0,
    measured: 88,
    min: 22,
    max: 110,
    previous: 88,
  }), 22);
  assert.equal(nextComposerHeight({
    textLength: 12,
    measured: 67.2,
    min: 22,
    max: 110,
    previous: 22,
  }), 68);
  assert.equal(nextComposerHeight({
    textLength: 40,
    measured: 180,
    min: 22,
    max: 110,
    previous: 22,
  }), 110);
  assert.equal(nextComposerHeight({
    textLength: 4,
    measured: Number.NaN,
    min: 22,
    max: 110,
    previous: 44,
  }), 44);
});
