import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLiveMessageNotification,
  buildMissedMessageNotifications,
} from "./notification-policy.ts";

const chat = (id: string, options: { isMuted?: boolean; notificationSound?: string } = {}) => ({
  id,
  ...options,
});

const message = (
  chatId: string,
  id: string,
  text: string,
  senderName = "Alex",
) => ({
  chatId,
  senderId: id,
  senderName,
  text,
});

test("missed replay groups multiple messages in one chat into one summary", () => {
  const requests = buildMissedMessageNotifications(
    [
      message("chat-1", "alex", "First"),
      message("chat-1", "alex", "Second"),
      message("chat-1", "alex", "Latest"),
    ],
    [chat("chat-1")],
  );

  assert.deepEqual(requests, [{
    title: "3 new messages from Alex",
    body: "Latest",
    sound: "default",
  }]);
});

test("missed replay creates one summary for each affected chat", () => {
  const requests = buildMissedMessageNotifications(
    [
      message("chat-1", "alex", "Chat one"),
      message("chat-2", "sam", "Chat two", "Sam"),
      message("chat-1", "alex", "Another chat one"),
    ],
    [chat("chat-1"), chat("chat-2", { notificationSound: "chime" })],
  );

  assert.deepEqual(requests, [
    {
      title: "2 new messages from Alex",
      body: "Another chat one",
      sound: "default",
    },
    {
      title: "Sam",
      body: "Chat two",
      sound: "chime",
    },
  ]);
});

test("missed replay uses a generic summary when multiple senders share a chat", () => {
  const requests = buildMissedMessageNotifications(
    [
      message("chat-1", "alex", "From Alex", "Alex"),
      message("chat-1", "sam", "From Sam", "Sam"),
    ],
    [chat("chat-1")],
  );

  assert.equal(requests[0]?.title, "2 new messages");
});

test("live messages remain individual notifications", () => {
  const first = buildLiveMessageNotification(message("chat-1", "alex", "First"), chat("chat-1"));
  const second = buildLiveMessageNotification(message("chat-1", "alex", "Second"), chat("chat-1"));

  assert.deepEqual([first, second], [
    { title: "Alex", body: "First", sound: "default" },
    { title: "Alex", body: "Second", sound: "default" },
  ]);
});

test("muted and silent chats schedule no notifications", () => {
  const missed = buildMissedMessageNotifications(
    [
      message("muted", "alex", "Muted"),
      message("silent", "alex", "Silent"),
    ],
    [
      chat("muted", { isMuted: true }),
      chat("silent", { notificationSound: "none" }),
    ],
  );
  const mutedLive = buildLiveMessageNotification(
    message("muted", "alex", "Muted live"),
    chat("muted", { isMuted: true }),
  );
  const silentLive = buildLiveMessageNotification(
    message("silent", "alex", "Silent live"),
    chat("silent", { notificationSound: "none" }),
  );

  assert.deepEqual(missed, []);
  assert.equal(mutedLive, null);
  assert.equal(silentLive, null);
});