import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLiveMessageNotification,
  buildMissedMessageNotifications,
  consumeChatNotificationRoute,
  partitionPresentedNotifications,
} from "./notification-policy.ts";

const chat = (id: string, options: { isMuted?: boolean; notificationSound?: string } = {}) => ({
  id,
  ...options,
});

const message = (
  chatId: string,
  senderId: string,
  text: string,
  senderName = "Alex",
  messageId?: string,
) => ({
  chatId,
  senderId,
  senderName,
  text,
  ...(messageId ? { messageId } : {}),
});

const data = (chatId: string, messageIds: string[] = []) => ({
  type: "chat_message" as const,
  chatId,
  messageIds,
  ...(messageIds.length > 0 ? { messageId: messageIds[messageIds.length - 1] } : {}),
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
    data: data("chat-1"),
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
      data: data("chat-1"),
    },
    {
      title: "Sam",
      body: "Chat two",
      sound: "chime",
      data: data("chat-2"),
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
    { title: "Alex", body: "First", sound: "default", data: data("chat-1") },
    { title: "Alex", body: "Second", sound: "default", data: data("chat-1") },
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

test("startup replay uses chat settings loaded after messages arrive", () => {
  const replay = [
    message("muted", "alex", "Muted during startup"),
    message("silent", "sam", "Silent during startup", "Sam"),
    message("audible", "jo", "Audible during startup", "Jo"),
  ];

  // This mirrors startup ordering: replay messages are buffered first, then
  // notification policy runs against the newly hydrated settings snapshot.
  const hydratedChats = [
    chat("muted", { isMuted: true }),
    chat("silent", { notificationSound: "none" }),
    chat("audible", { notificationSound: "chime" }),
  ];

  assert.deepEqual(buildMissedMessageNotifications(replay, hydratedChats), [{
    title: "Jo",
    body: "Audible during startup",
    sound: "chime",
    data: data("audible"),
  }]);
});

test("missed catch-up drops remote-delivered messages and the open chat", () => {
  const requests = buildMissedMessageNotifications(
    [
      message("open", "alex", "On screen", "Alex", "m-open"),
      message("chat-1", "alex", "Already pushed", "Alex", "m-pushed"),
      message("chat-1", "alex", "Second", "Alex", "m-2"),
      message("chat-1", "alex", "Third", "Alex", "m-3"),
    ],
    [chat("open"), chat("chat-1")],
    { activeChatId: "open", deliveredMessageIds: new Set(["m-pushed"]) },
  );

  assert.deepEqual(requests, [{
    title: "2 new messages from Alex",
    body: "Third",
    sound: "default",
    data: data("chat-1", ["m-2", "m-3"]),
  }]);
});

test("a chat whose messages were all pushed schedules nothing", () => {
  const requests = buildMissedMessageNotifications(
    [message("chat-1", "alex", "Pushed", "Alex", "m-1")],
    [chat("chat-1")],
    { deliveredMessageIds: new Set(["m-1"]) },
  );

  assert.deepEqual(requests, []);
});

test("live notification carries the chat id for tap routing", () => {
  const request = buildLiveMessageNotification(
    message("chat-9", "alex", "Hello", "Alex", "m-9"),
    chat("chat-9"),
  );

  assert.equal(request?.data.chatId, "chat-9");
  assert.equal(request?.data.messageId, "m-9");
  assert.deepEqual(request?.data.messageIds, ["m-9"]);
});

test("notification taps open the chat and ignore missing or unrelated payloads", () => {
  const handled = new Set<string>();

  assert.equal(
    consumeChatNotificationRoute("r1", { chatId: "chat-1", messageId: "m1" }, handled),
    "/chat/chat-1",
  );
  assert.equal(
    consumeChatNotificationRoute("r1", { chatId: "chat-1", messageId: "m1" }, handled),
    null,
  );
  assert.equal(consumeChatNotificationRoute("r2", {}, handled), null);
  assert.equal(consumeChatNotificationRoute("r3", { chatId: "" }, handled), null);
  assert.equal(consumeChatNotificationRoute("r4", { type: "not-a-chat" }, handled), null);
  assert.equal(
    consumeChatNotificationRoute(
      "r5",
      { type: "scheduled_message_approval", chatId: "chat-9", scheduledMessageId: "s1" },
      handled,
    ),
    null,
  );
  assert.equal(
    consumeChatNotificationRoute("r6", { type: "chat_message", chatId: "chat-5", messageId: "m5" }, handled),
    "/chat/chat-5",
  );
  assert.equal(handled.has("r2"), false);
  assert.equal(handled.has("r5"), false);
});

test("opening a chat dismisses only that chat's message notifications", () => {
  assert.deepEqual(
    partitionPresentedNotifications(
      [
        { identifier: "a", data: { chatId: "chat-1", messageId: "m1" } },
        { identifier: "b", data: { type: "chat_message", chatId: "chat-2", messageId: "m2" } },
        { identifier: "c", data: { type: "scheduled_message_approval", chatId: "chat-1", scheduledMessageId: "s1" } },
        { identifier: "d", data: {} },
      ],
      "chat-1",
    ),
    { dismissIds: ["a"], remainingBadgeCount: 1 },
  );
});