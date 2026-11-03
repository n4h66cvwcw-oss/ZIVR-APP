import assert from "node:assert/strict";
import test from "node:test";
import React, { useRef } from "react";
import { act, render } from "@testing-library/react-native/pure";
import { MessagingProvider, useMessaging, type Message } from "./MessagingContext";
import {
  emitMessageReaction,
  emitNewMessage,
  reactionPosts,
  resetServerMock,
  setFetchedMessages,
} from "../test/mocks/ServerContext";
import {
  resetStorageMock,
  resolveChatHydration,
  seedMessages,
} from "../test/mocks/async-storage";
import { notifications, resetNotificationMock } from "../test/mocks/notifications";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

type MessagingApi = ReturnType<typeof useMessaging>;

function renderProvider() {
  const api = { current: null as MessagingApi | null };
  function Harness() {
    const messaging = useMessaging();
    const sink = useRef(api);
    sink.current.current = messaging;
    return null;
  }
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    if (args[0] === "react-test-renderer is deprecated. See https://react.dev/warnings/react-test-renderer") {
      return;
    }
    originalConsoleError(...args);
  };
  try {
    const screen = render(
      <MessagingProvider>
        <Harness />
      </MessagingProvider>,
    );
    return { screen, api };
  } finally {
    console.error = originalConsoleError;
  }
}

async function hydrate() {
  await act(async () => {
    await flush();
    resolveChatHydration([
      {
        id: "server-chat",
        type: "direct",
        name: "Jay Flores",
        participantIds: ["jay", "me"],
        createdAt: 1,
        isServerChat: true,
      },
      {
        id: "local-chat",
        type: "direct",
        name: "Local",
        participantIds: ["sam"],
        createdAt: 1,
      },
    ]);
    await flush();
    await flush();
  });
}

function message(messages: Record<string, Message[]> | undefined, chatId: string, id: string) {
  return messages?.[chatId]?.find((item) => item.id === id);
}

test("server reactions post the server id or localId and apply either id from the fanout", async () => {
  resetServerMock();
  resetStorageMock();
  resetNotificationMock();
  seedMessages({
    "server-chat": [
      { id: "srv-received", chatId: "server-chat", text: "Testing again", senderId: "jay", timestamp: 1 },
      { id: "local-sent", chatId: "server-chat", text: "Hiiii", senderId: "me", timestamp: 2 },
    ],
    "local-chat": [
      { id: "offline-1", chatId: "local-chat", text: "offline", senderId: "me", timestamp: 3 },
    ],
  });

  const { screen, api } = renderProvider();
  await hydrate();

  await act(async () => {
    await api.current?.addReaction("server-chat", "srv-received", "👍");
    await api.current?.addReaction("server-chat", "local-sent", "👍");
    await api.current?.addReaction("local-chat", "offline-1", "👍");
  });

  assert.deepEqual(reactionPosts, [
    { chatId: "server-chat", messageId: "srv-received", emoji: "👍" },
    { chatId: "server-chat", messageId: "local-sent", emoji: "👍" },
  ]);
  assert.deepEqual(message(api.current?.messages, "server-chat", "srv-received")?.reactions, {
    "👍": ["jay", "me"],
  });
  assert.equal(message(api.current?.messages, "server-chat", "local-sent")?.serverMessageId, "srv-for-local-sent");
  assert.deepEqual(message(api.current?.messages, "local-chat", "offline-1")?.reactions, {
    "👍": ["me"],
  });

  await act(async () => {
    emitMessageReaction({
      messageId: "srv-testing",
      clientId: "local-sent",
      chatId: "server-chat",
      emoji: "👍",
      userId: "kristina",
      action: "added",
      reactions: { "👍": ["kristina"] },
    });
    await flush();
  });
  assert.deepEqual(message(api.current?.messages, "server-chat", "local-sent")?.reactions, {
    "👍": ["kristina"],
  });
  assert.equal(message(api.current?.messages, "server-chat", "local-sent")?.serverMessageId, "srv-for-local-sent");

  const before = reactionPosts.length;
  await act(async () => {
    await api.current?.addReaction("server-chat", "local-sent", "👍");
  });
  assert.equal(reactionPosts[before]?.messageId, "srv-for-local-sent");

  await act(async () => {
    screen.unmount();
  });
});

test("own-message echo records the server id without a duplicate bubble", async () => {
  resetServerMock();
  resetStorageMock();
  resetNotificationMock();
  seedMessages({ "server-chat": [] });

  const { screen, api } = renderProvider();
  await hydrate();

  await act(async () => {
    await api.current?.sendMessage("server-chat", "echo-me");
  });
  const sent = api.current?.messages["server-chat"]?.find((item) => item.text === "echo-me");
  assert.ok(sent);

  await act(async () => {
    emitNewMessage({
      id: "srv-echo",
      localId: sent?.id,
      chatId: "server-chat",
      senderId: "me",
      senderName: "Me",
      text: "echo-me",
      createdAt: sent?.timestamp ?? 1,
      reactions: { "👍": ["jay"] },
    }, "live");
    await flush();
  });

  const copies = api.current?.messages["server-chat"]?.filter((item) => item.text === "echo-me") ?? [];
  assert.equal(copies.length, 1);
  assert.equal(copies[0]?.id, sent?.id);
  assert.equal(copies[0]?.serverMessageId, "srv-echo");
  assert.deepEqual(copies[0]?.reactions, { "👍": ["jay"] });
  assert.deepEqual(notifications, []);

  await act(async () => {
    screen.unmount();
  });
});

test("opening a server chat applies history reactions by clientId or server id", async () => {
  resetServerMock();
  resetStorageMock();
  resetNotificationMock();
  seedMessages({
    "server-chat": [
      { id: "local-history", chatId: "server-chat", text: "Testing again", senderId: "me", timestamp: 1 },
      { id: "srv-live", chatId: "server-chat", text: "Hiiii", senderId: "jay", timestamp: 2 },
    ],
  });
  setFetchedMessages([
    {
      id: "srv-history",
      clientId: "local-history",
      chatId: "server-chat",
      senderId: "me",
      text: "Testing again",
      createdAt: 1,
      reactions: { "👍": ["kristina"] },
    },
    {
      id: "srv-live",
      chatId: "server-chat",
      senderId: "jay",
      text: "Hiiii",
      createdAt: 2,
      reactions: { "❤️": ["me"] },
    },
  ]);

  const { screen, api } = renderProvider();
  await hydrate();
  await act(async () => {
    api.current?.setActiveChatId("server-chat");
    await flush();
    await flush();
  });

  assert.deepEqual(message(api.current?.messages, "server-chat", "local-history")?.reactions, {
    "👍": ["kristina"],
  });
  assert.equal(message(api.current?.messages, "server-chat", "local-history")?.serverMessageId, "srv-history");
  assert.deepEqual(message(api.current?.messages, "server-chat", "srv-live")?.reactions, {
    "❤️": ["me"],
  });

  await act(async () => {
    screen.unmount();
  });
});

test("a received server message keeps reactions from the payload", async () => {
  resetServerMock();
  resetStorageMock();
  resetNotificationMock();
  seedMessages({});

  const { screen, api } = renderProvider();
  await hydrate();
  await act(async () => {
    emitNewMessage({
      id: "srv-new",
      chatId: "server-chat",
      senderId: "jay",
      senderName: "Jay",
      text: "Testing again",
      createdAt: 9,
      reactions: { "👍": ["kristina"] },
    }, "live");
    await flush();
  });
  assert.deepEqual(message(api.current?.messages, "server-chat", "srv-new")?.reactions, {
    "👍": ["kristina"],
  });

  await act(async () => {
    screen.unmount();
  });
});
