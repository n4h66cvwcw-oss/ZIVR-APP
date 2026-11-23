import assert from "node:assert/strict";
import test from "node:test";
import { chatMessagePushData } from "./push.ts";

test("chat message pushes include the chat and message ids", () => {
  assert.deepEqual(chatMessagePushData("chat-1", "msg-1"), {
    type: "chat_message",
    chatId: "chat-1",
    messageId: "msg-1",
  });
});
