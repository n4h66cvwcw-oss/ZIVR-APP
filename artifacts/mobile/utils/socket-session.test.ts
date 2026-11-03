import assert from "node:assert/strict";
import test from "node:test";
import {
  DEVICE_CLOCK_SKEW_MARGIN_MS,
  MAX_CATCH_UP_LOOKBACK_MS,
  advanceLastSeen,
  computeJoinSince,
  isJoinAuthError,
  joinPayload,
  shouldForceReconnect,
} from "./socket-session.ts";

const NOW = 1_800_000_000_000;

const base = { lastCaughtUpAt: null, lastSeenMessageAt: null, lastDisconnectAt: null, lastBackgroundAt: null, now: NOW };

test("since anchors on the last acknowledged catch-up, minus skew margin", () => {
  assert.equal(
    computeJoinSince({ ...base, lastCaughtUpAt: NOW - 90_000, lastSeenMessageAt: NOW - 1000 }),
    NOW - 90_000 - DEVICE_CLOCK_SKEW_MARGIN_MS,
  );
});

test("a later live message never moves since past a dropped one", () => {
  // A dropped at NOW-80s; B delivered live at NOW-10s; caught up at NOW-90s.
  const since = computeJoinSince({ ...base, lastCaughtUpAt: NOW - 90_000, lastSeenMessageAt: NOW - 10_000 })!;
  assert.ok(since < NOW - 80_000);
});

test("without a catch-up anchor: last seen, then device gap markers", () => {
  assert.equal(computeJoinSince({ ...base, lastSeenMessageAt: NOW - 5000 }), NOW - 5000);
  assert.equal(
    computeJoinSince({ ...base, lastDisconnectAt: NOW - 10_000, lastBackgroundAt: NOW - 30_000 }),
    NOW - 30_000 - DEVICE_CLOCK_SKEW_MARGIN_MS,
  );
});

test("since is undefined with no anchor and is clamped to the lookback floor", () => {
  assert.equal(computeJoinSince(base), undefined);
  assert.equal(computeJoinSince({ ...base, lastSeenMessageAt: 1 }), NOW - MAX_CATCH_UP_LOOKBACK_MS);
});

test("join auth errors are recognised; other server errors are not", () => {
  assert.equal(isJoinAuthError({ message: "Authentication failed — invalid or missing token" }), true);
  assert.equal(isJoinAuthError({ message: "Not authenticated as this sender" }), true);
  assert.equal(isJoinAuthError({ message: "Not a member of this chat" }), false);
  assert.equal(isJoinAuthError(undefined), false);
});

test("last seen only moves forward", () => {
  assert.equal(advanceLastSeen(null, NOW), NOW);
  assert.equal(advanceLastSeen(NOW, NOW - 1), NOW);
  assert.equal(advanceLastSeen(NOW, "nope"), NOW);
  assert.equal(advanceLastSeen(NOW, String(NOW + 5)), NOW + 5);
});

test("force reconnect after a long background; payload keeps legacy shape", () => {
  assert.equal(shouldForceReconnect(null, NOW), false);
  assert.equal(shouldForceReconnect(NOW - 5000, NOW), false);
  assert.equal(shouldForceReconnect(NOW - 60_000, NOW), true);
  assert.equal(joinPayload("u1", undefined), "u1");
  assert.deepEqual(joinPayload("u1", 42), { userId: "u1", since: 42 });
});
