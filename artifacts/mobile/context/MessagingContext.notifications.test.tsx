import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { act, render } from "@testing-library/react-native/pure";
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
  clearedChatIds,
  notifications,
  resetNotificationMock,
  seedDeliveredMessageIds,
} from "../test/mocks/notifications";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

function renderProvider(children?: React.ReactNode) {
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    if (args[0] === "react-test-renderer is deprecated. See https://react.dev/warnings/react-test-renderer") {
      return;
    }
    originalConsoleError(...args);
  };

  try {
    return render(<MessagingProvider>{children}</MessagingProvider>);
  } finally {
    console.error = originalConsoleError;
  }
}

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

  const screen = renderProvider(<></>);
  await act(async () => {
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
    data: {
      type: "chat_message",
      chatId: "audible",
      messageId: "m-audible",
      messageIds: ["m-audible"],
    },
  }]);

  await act(async () => {
    screen.unmount();
  });
});

test("missed catch-up skips the open chat and messages already delivered by push", async () => {
  resetServerMock();
  resetStorageMock();
  resetNotificationMock();
  seedDeliveredMessageIds(["m-remote"]);

  const api = { current: null as { setActiveChatId: (id: string | null) => void } | null };
  function Harness() {
    const { setActiveChatId } = useMessaging();
    api.current = { setActiveChatId };
    return null;
  }

  const screen = renderProvider(<Harness />);
  await act(async () => {
    await flush();
    api.current?.setActiveChatId("open-chat");
  });

  const replay: MockServerMessage[] = [
    { id: "m-open-1", chatId: "open-chat", senderId: "alex", senderName: "Alex", text: "On screen", createdAt: 1 },
    { id: "m-open-2", chatId: "open-chat", senderId: "alex", senderName: "Alex", text: "Still here", createdAt: 2 },
    { id: "m-remote", chatId: "alex-chat", senderId: "alex", senderName: "Alex", text: "Already pushed", createdAt: 3 },
    { id: "m-2", chatId: "alex-chat", senderId: "alex", senderName: "Alex", text: "Second", createdAt: 4 },
    { id: "m-3", chatId: "alex-chat", senderId: "alex", senderName: "Alex", text: "Third", createdAt: 5 },
  ];
  replay.forEach((message) => emitNewMessage(message, "missed"));

  await act(async () => {
    resolveChatHydration([
      { id: "open-chat", type: "direct", name: "Open", participantIds: ["alex"], createdAt: 1 },
      { id: "alex-chat", type: "direct", name: "Alex", participantIds: ["alex"], createdAt: 1 },
    ]);
    await flush();
    await flush();
    await flush();
  });

  assert.deepEqual(notifications, [{
    title: "2 new messages from Alex",
    body: "Third",
    sound: "default",
    data: {
      type: "chat_message",
      chatId: "alex-chat",
      messageId: "m-3",
      messageIds: ["m-2", "m-3"],
    },
  }]);
  assert.deepEqual(clearedChatIds, ["open-chat"]);

  await act(async () => {
    screen.unmount();
  });
});

test("startup replay survives failed storage hydration without notifying", async () => {
  resetServerMock();
  resetStorageMock();
  resetNotificationMock();

  let observedMessages: Record<string, Message[]> = {};
  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    const screen = renderProvider(
      <MessageObserver onMessages={(messages) => { observedMessages = messages; }} />
    );
    await act(async () => {
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
      screen.unmount();
    });
  } finally {
    console.error = originalConsoleError;
  }
});