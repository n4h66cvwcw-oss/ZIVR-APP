import assert from "node:assert/strict";
import test from "node:test";
import {
  mergeCheckinBroadcast,
  mergeCheckinBroadcasts,
  migrateLegacyCheckins,
  shouldMarkCheckinRepliesRead,
} from "./checkin-state.ts";

const broadcast = (id: string, timestamp: number, replies: Record<string, any[]> = {}, progress?: { total: number; replied: number }) => ({
  id,
  timestamp,
  replies,
  ...(progress ? { progress } : {}),
});

test("check-in merge keeps newer canonical fields and monotonically merges replies/progress", () => {
  const current = broadcast("b1", 20, {
    member: [{ id: "r2", timestamp: 20, text: "new" }],
  }, { total: 2, replied: 2 });
  const stale = broadcast("b1", 10, {
    member: [{ id: "r1", timestamp: 10, text: "old" }],
  }, { total: 2, replied: 1 });
  const merged = mergeCheckinBroadcast(current, stale);
  assert.equal(merged.timestamp, 20);
  assert.deepEqual(merged.replies.member.map((reply) => reply.id), ["r1", "r2"]);
  assert.deepEqual(merged.progress, { total: 2, replied: 2 });
});

test("check-in snapshot merge deduplicates by canonical broadcast ID", () => {
  const merged = mergeCheckinBroadcasts(
    [broadcast("b1", 30), broadcast("local", 10)],
    [broadcast("b1", 20), broadcast("b2", 40)],
  );
  assert.deepEqual(merged.map((item) => item.id), ["b2", "b1", "local"]);
});

test("legacy migration only moves explicitly owned server records", () => {
  const migrated = migrateLegacyCheckins(
    [
      { id: "server", isServerGroup: true, creatorId: "account-a" },
      { id: "local", isServerGroup: false, creatorId: "account-a" },
      { id: "other", isServerGroup: true, creatorId: "account-b" },
    ] as Array<{ id: string; isServerGroup: boolean; creatorId: string }>,
    [
      { id: "server-b", isServerBroadcast: true, senderId: "account-a" },
      { id: "simulated", isServerBroadcast: false, senderId: "account-a" },
    ] as Array<{ id: string; isServerBroadcast: boolean; senderId: string }>,
    "account-a",
  );
  assert.deepEqual(migrated.groups.map((item) => item.id), ["server"]);
  assert.deepEqual(migrated.broadcasts.map((item) => item.id), ["server-b"]);
  assert.deepEqual(migrated.legacyGroups.map((item) => item.id), ["local", "other"]);
  assert.deepEqual(migrated.legacyBroadcasts.map((item) => item.id), ["simulated"]);
});

test("read decision skips already-read replies and allows unread creator replies", () => {
  const alreadyRead = {
    isServerBroadcast: true,
    senderId: "creator",
    replies: { member: [{ id: "r1", timestamp: 1, read: true }] },
  };
  assert.equal(shouldMarkCheckinRepliesRead(alreadyRead, "creator"), false);
  assert.equal(shouldMarkCheckinRepliesRead({
    ...alreadyRead,
    replies: { member: [{ id: "r1", timestamp: 1, read: false }] },
  }, "creator"), true);
  assert.equal(shouldMarkCheckinRepliesRead(alreadyRead, "member"), false);
});