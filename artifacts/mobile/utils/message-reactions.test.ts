import assert from "node:assert/strict";
import test from "node:test";
import {
  applyReactionSnapshot,
  hasServerMessage,
  linkServerMessageId,
  localFieldsFromServerMessage,
  reactionPostId,
  toggleReaction,
} from "./message-reactions.ts";

type Bubble = {
  id: string;
  text?: string;
  localId?: string;
  serverMessageId?: string;
  reactions?: Record<string, string[]>;
};

test("optimistic toggle adds then removes the same emoji for one user", () => {
  const added = toggleReaction({ "❤️": ["sam"] }, "me", "👍");
  assert.deepEqual(added, { "❤️": ["sam"], "👍": ["me"] });
  const removed = toggleReaction(added, "me", "👍");
  assert.deepEqual(removed, { "❤️": ["sam"], "👍": [] });
  assert.deepEqual(toggleReaction(undefined, "me", "👍")["👍"], ["me"]);
});

test("inbound snapshot matches server uuid or sender localId and does not toggle twice", () => {
  const messages = {
    chat: [
      { id: "local-jay", text: "Testing again" },
      { id: "srv-kristina", text: "Hiiii" },
    ],
  };
  const once = applyReactionSnapshot(
    messages,
    "chat",
    "srv-testing",
    { "👍": ["kristina"] },
    "local-jay",
  );
  assert.deepEqual(once.chat[0], {
    id: "local-jay",
    localId: "local-jay",
    text: "Testing again",
    serverMessageId: "srv-testing",
    reactions: { "👍": ["kristina"] },
  });
  assert.equal(once.chat[1], messages.chat[1]);

  const twice = applyReactionSnapshot(
    once,
    "chat",
    "srv-testing",
    { "👍": ["kristina"] },
    "local-jay",
  );
  assert.equal(twice, once);

  const onRecipient = applyReactionSnapshot<Bubble>(
    { chat: [{ id: "srv-testing", text: "Testing again" }] },
    "chat",
    "srv-testing",
    { "👍": ["kristina"] },
    "local-jay",
  );
  assert.deepEqual(onRecipient.chat[0].reactions, { "👍": ["kristina"] });
  assert.equal(onRecipient.chat[0].serverMessageId, undefined);

  const byLocalField = applyReactionSnapshot<Bubble>(
    { chat: [{ id: "srv-kept", localId: "local-jay", text: "Testing again" }] },
    "chat",
    "srv-testing",
    { "👍": ["kristina"] },
    "local-jay",
  );
  assert.deepEqual(byLocalField.chat[0].reactions, { "👍": ["kristina"] });
  assert.equal(byLocalField.chat[0].id, "srv-kept");
});

test("hasServerMessage finds either id and the post prefers the server uuid", () => {
  const messages = {
    chat: [{ id: "local-1", serverMessageId: "srv-1" }, { id: "srv-2" }],
  };
  assert.equal(hasServerMessage(messages, "chat", "srv-1", "local-1"), true);
  assert.equal(hasServerMessage(messages, "chat", "srv-2"), true);
  assert.equal(hasServerMessage(messages, "chat", "missing", "nope"), false);
  assert.equal(reactionPostId(messages.chat[0], "local-1"), "srv-1");
  assert.equal(reactionPostId({ id: "local-only" }, "local-only"), "local-only");
  assert.equal(reactionPostId(undefined, "fallback"), "fallback");
});

test("echo link stores the server id without dropping existing reactions when none arrive", () => {
  const linked = linkServerMessageId(
    { chat: [{ id: "local-1", reactions: { "👍": ["me"] } }] },
    "chat",
    "local-1",
    "srv-1",
  );
  assert.deepEqual(linked.chat[0], {
    id: "local-1",
    localId: "local-1",
    serverMessageId: "srv-1",
    reactions: { "👍": ["me"] },
  });
  assert.equal(linkServerMessageId(linked, "chat", "local-1", "srv-1"), linked);
});

test("server message hydration keeps the reactions map", () => {
  assert.deepEqual(
    localFieldsFromServerMessage({
      id: "srv-1",
      chatId: "chat",
      text: "Testing again",
      senderId: "jay",
      createdAt: 4,
      reactions: { "👍": ["kristina"] },
    }),
    {
      id: "srv-1",
      chatId: "chat",
      text: "Testing again",
      senderId: "jay",
      timestamp: 4,
      read: false,
      reactions: { "👍": ["kristina"] },
    },
  );
});
