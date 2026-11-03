import assert from "node:assert/strict";
import test from "node:test";
import {
  historyReactions,
  parseReactionEmoji,
  pickReactionMessage,
  toggleReaction,
} from "./reactions.ts";

const PICKER = ["❤️", "😂", "😮", "😢", "🎉", "👍"];

test("picker emoji and common sequences are accepted", () => {
  for (const emoji of [...PICKER, "👍🏽", "👨‍👩‍👧‍👦", "🇺🇸", "1️⃣", "‼️"]) {
    const parsed = parseReactionEmoji(emoji);
    assert.equal(parsed.ok, true, emoji);
    if (parsed.ok) assert.equal(parsed.emoji, emoji);
  }
});

test("non-emoji and over-long reaction strings are rejected", () => {
  for (const value of ["", " ", "hello", "a👍", "123", 1, null, undefined, {}]) {
    const parsed = parseReactionEmoji(value);
    assert.equal(parsed.ok, false);
  }
  const tooLong = parseReactionEmoji("👍".repeat(33));
  assert.equal(tooLong.ok, false);
  if (!tooLong.ok) assert.equal(tooLong.error, "emoji must be 1–32 characters");
  const word = parseReactionEmoji("hello");
  assert.equal(word.ok, false);
  if (!word.ok) assert.equal(word.error, "emoji must be an emoji");
  const missing = parseReactionEmoji(undefined);
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.error, "emoji is required");
});

test("toggle adds, stacks peers, and removes the emoji key when the last user leaves", () => {
  const first = toggleReaction({}, "👍", "user-a");
  assert.equal(first.action, "added");
  assert.deepEqual(first.reactions, { "👍": ["user-a"] });

  const second = toggleReaction({ "❤️": ["user-b"], "👍": ["user-a"] }, "👍", "user-b");
  assert.equal(second.action, "added");
  assert.deepEqual(second.reactions, { "❤️": ["user-b"], "👍": ["user-a", "user-b"] });

  const removed = toggleReaction(second.reactions, "👍", "user-a");
  assert.equal(removed.action, "removed");
  assert.deepEqual(removed.reactions, { "❤️": ["user-b"], "👍": ["user-b"] });

  const cleared = toggleReaction(removed.reactions, "👍", "user-b");
  assert.equal(cleared.action, "removed");
  assert.deepEqual(cleared.reactions, { "❤️": ["user-b"] });
  assert.equal(historyReactions(cleared.reactions)?.["❤️"]?.[0], "user-b");
  assert.equal(historyReactions({}), undefined);
  assert.equal(historyReactions(null), undefined);
});

test("message lookup prefers the server id, then the actor's own client id", () => {
  const serverId = "11111111-1111-4111-8111-111111111111";
  const otherId = "22222222-2222-4222-8222-222222222222";
  const rows = [
    { id: serverId, sender_id: "user-a", client_id: "local-a" },
    { id: otherId, sender_id: "user-b", client_id: "local-a" },
  ];
  const byServer = pickReactionMessage(rows, serverId.toUpperCase(), "user-b");
  const bySender = pickReactionMessage(rows, "local-a", "user-a");
  const byPeer = pickReactionMessage(rows, "local-a", "user-b");
  assert.ok(byServer && byServer !== "ambiguous");
  assert.equal(byServer.id, serverId);
  assert.ok(bySender && bySender !== "ambiguous");
  assert.equal(bySender.id, serverId);
  assert.ok(byPeer && byPeer !== "ambiguous");
  assert.equal(byPeer.id, otherId);
  assert.equal(pickReactionMessage(rows, "local-a", "user-c"), "ambiguous");
  assert.equal(pickReactionMessage(rows, "missing", "user-a"), null);
});
