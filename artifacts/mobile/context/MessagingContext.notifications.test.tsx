import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { act, create } from "react-test-renderer";
import { MessagingProvider, useMessaging, type Message } from "./MessagingContext";
import {
  emitNewMessage,
  resetServerMock,
  type MockServerMessage,
} from "../test/mocks/ServerContext";
import {
  rejectChatHydration,
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

function MessageObserver({
  onMessages,
}: {
  onMessages: (messages: Record<string, Message[]>) => void;
}) {
  const { messages } = useMessaging();
  onMessages(messages);
  return null;
}

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

test("startup replay survives failed storage hydration without notifying", async () => {
  resetServerMock();
  resetStorageMock();
  resetNotificationMock();

  let observedMessages: Record<string, Message[]> = {};
  let renderer: ReturnType<typeof create>;
  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    await act(async () => {
      renderer = create(
        <MessagingProvider>
          <MessageObserver onMessages={(messages) => { observedMessages = messages; }} />
        </MessagingProvider>
      );
      await flush();
    });

    const replay: MockServerMessage = {
      id: "m-storage-error",
      chatId: "recovered",
      senderId: "alex",
      senderName: "Alex",
      text: "Still here",
      createdAt: 4,
    };

    emitNewMessage(replay, "missed");
    assert.equal(Object.hasOwn(observedMessages, "recovered"), false);
    assert.deepEqual(notifications, []);

    await act(async () => {
      rejectChatHydration();
      await flush();
      await flush();
    });

    assert.deepEqual(
      observedMessages.recovered?.map((message) => message.id),
      ["m-storage-error"],
      "the buffered message must appear exactly once after the startup gate opens"
    );
    assert.deepEqual(
      notifications,
      [],
      "recovery must not notify without hydrated chat notification preferences"
    );

    await act(async () => {
      renderer!.unmount();
    });
  } finally {
    console.error = originalConsoleError;
  }
});