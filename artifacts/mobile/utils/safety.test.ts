import assert from "node:assert/strict";
import test from "node:test";
import {
  directChatHiddenByBlock,
  messageHiddenForBlocker,
  reportRequestBody,
} from "./safety.ts";

test("direct chats with a blocked participant are hidden only for the blocker", () => {
  const blocked = new Set(["user-b"]);
  assert.equal(directChatHiddenByBlock("direct", ["me", "user-b"], "me", blocked), true);
  assert.equal(directChatHiddenByBlock("direct", ["me", "user-c"], "me", blocked), false);
  assert.equal(directChatHiddenByBlock("group", ["me", "user-b", "user-c"], "me", blocked), false);
  assert.equal(messageHiddenForBlocker("user-b", blocked), true);
  assert.equal(messageHiddenForBlocker("user-c", blocked), false);
});

test("report bodies keep server uuids and drop local ids", () => {
  const userId = "11111111-1111-4111-8111-111111111111";
  const messageId = "22222222-2222-4222-8222-222222222222";
  const body = reportRequestBody({
    reportedUserId: userId,
    messageId,
    chatId: "local-chat",
    reason: "harassment",
    details: "  repeated insults  ",
  });
  assert.deepEqual(body, {
    reportedUserId: userId,
    messageId,
    reason: "harassment",
    details: "repeated insults",
  });
});
