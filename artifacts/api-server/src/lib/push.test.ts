import assert from "node:assert/strict";
import test from "node:test";
import {
  buildExpoPushMessages,
  logExpoPushResult,
  messagePushData,
  readExpoPushResult,
} from "./push.ts";

test("message pushes carry chatId, messageId, and high priority", () => {
  const [message] = buildExpoPushMessages(
    ["ExponentPushToken[abc]"],
    "Jay",
    "hello",
    "default",
    messagePushData("chat-1", "msg-1"),
  );
  assert.ok(message);
  assert.equal(message.priority, "high");
  assert.equal(message.sound, "default");
  assert.deepEqual(message.data, { sound: "default", chatId: "chat-1", messageId: "msg-1" });
  assert.equal(message.to, "ExponentPushToken[abc]");
  assert.equal("categoryId" in message && message.categoryId, false);
});

test("silent sound omits the Expo sound field and keeps caller data", () => {
  const [message] = buildExpoPushMessages(
    ["ExponentPushToken[abc]"],
    "Reminder",
    "later",
    "none",
    { type: "scheduled_message_approval", chatId: "chat-9" },
    "scheduled-message-approval",
    "high",
  );
  assert.ok(message);
  assert.equal(message.sound, undefined);
  assert.equal(message.categoryId, "scheduled-message-approval");
  assert.equal(message.priority, "high");
  assert.equal(message.data["chatId"], "chat-9");
  assert.equal(message.data["sound"], "none");
});

test("Expo ticket results keep InvalidCredentials visible", () => {
  const receipt = readExpoPushResult(200, {
    data: [
      { status: "ok", id: "ticket-ok" },
      {
        status: "error",
        message: "Unable to retrieve the FCM server key for the experience",
        details: { error: "InvalidCredentials" },
      },
    ],
  });
  assert.equal(receipt.invalidCredentials, true);
  assert.equal(receipt.tickets.length, 2);
  assert.equal(receipt.tickets[1]?.details?.error, "InvalidCredentials");
  assert.equal(receipt.tickets[0]?.id, "ticket-ok");

  const lines: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    lines.push(args.map((arg) => String(arg)).join(" "));
  };
  try {
    logExpoPushResult(receipt);
  } finally {
    console.error = original;
  }
  assert.match(lines.join("\n"), /InvalidCredentials/);
  assert.match(lines.join("\n"), /ticket-ok/);
  assert.doesNotMatch(lines.join("\n"), /ExponentPushToken/);
});

test("request-level Expo errors are retained", () => {
  const receipt = readExpoPushResult(400, {
    errors: [{ code: "PUSH_TOO_MANY_EXPERIENCE_IDS", message: "mixed experience ids" }],
  });
  assert.equal(receipt.httpStatus, 400);
  assert.equal(receipt.tickets.length, 0);
  assert.equal(receipt.requestErrors[0]?.code, "PUSH_TOO_MANY_EXPERIENCE_IDS");
  assert.equal(receipt.invalidCredentials, false);
});

test("a single Expo ticket object is kept, including InvalidCredentials", () => {
  const receipt = readExpoPushResult(200, {
    data: {
      status: "error",
      id: "ticket-single",
      message: "credentials rejected",
      details: { error: "InvalidCredentials" },
    },
  });
  assert.equal(receipt.invalidCredentials, true);
  assert.equal(receipt.tickets.length, 1);
  assert.equal(receipt.tickets[0]?.id, "ticket-single");
});

test("a non-JSON Expo body still records the HTTP status", () => {
  const receipt = readExpoPushResult(502, null);
  assert.equal(receipt.httpStatus, 502);
  assert.deepEqual(receipt.tickets, []);
  assert.equal(receipt.invalidCredentials, false);
});
