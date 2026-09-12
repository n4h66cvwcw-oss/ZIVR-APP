import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { act, create } from "react-test-renderer";
import { MessagingProvider } from "./MessagingContext";
import {
  emitNewMessage,
  resetServerMock,
  type MockServerMessage,
} from "../test/mocks/ServerContext";
import {
  resolveChatHydration,
  resetStorageMock,
} from "../test/mocks/async-storage";
import {
  notifications,
  resetNotificationMock,
} from "../test/mocks/notifications";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

test("startup replay waits for persisted chat notification settings", async () => {
  resetServerMock();
  resetStorageMock();
  resetNotificationMock();

  let renderer: ReturnType<typeof create>;
  await act(async () => {
    renderer = create(<MessagingProvider><></></MessagingProvider>);
    await flush();
  });

  const replay: MockServerMessage[] = [
    { id: "m-muted", chatId: "muted", senderId: "alex", senderName: "Alex", text: "Muted", createdAt: 1 },
    { id: "m-silent", chatId: "silent", senderId: "sam", senderName: "Sam", text: "Silent", createdAt: 2 },
    { id: "m-audible", chatId: "audible", senderId: "jo", senderName: "Jo", text: "Audible", createdAt: 3 },
  ];

  replay.forEach((message) => emitNewMessage(message, "missed"));
  assert.deepEqual(notifications, [], "replay must remain buffered while chat hydration is paused");

  await act(async () => {
    resolveChatHydration([
      { id: "muted", type: "direct", name: "Muted", participantIds: ["alex"], createdAt: 1, isMuted: true },
      { id: "silent", type: "direct", name: "Silent", participantIds: ["sam"], createdAt: 1, notificationSound: "none" },
      { id: "audible", type: "direct", name: "Audible", participantIds: ["jo"], createdAt: 1, notificationSound: "chime" },
    ]);
    await flush();
    await flush();
  });

  assert.deepEqual(notifications, [{
    title: "Jo",
    body: "Audible",
    sound: "chime",
  }]);

  await act(async () => {
    renderer!.unmount();
  });
});