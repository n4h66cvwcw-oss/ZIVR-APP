import assert from "node:assert/strict";
import test from "node:test";
import {
  formatModerationNotice,
  sendModerationNotice,
  setModerationMailerForTests,
  type ModerationNotice,
} from "./mailer.ts";

const notice: ModerationNotice = {
  reportId: "report-1",
  reporterId: "reporter-id",
  reporterHandle: "casey",
  reportedUserId: "reported-id",
  reportedHandle: null,
  messageId: "message-1",
  chatId: "chat-1",
  reason: "spam",
  details: "buy this",
  createdAt: Date.parse("2026-04-01T00:00:00.000Z"),
};

test("moderation notice includes the fields moderators need", () => {
  const mail = formatModerationNotice(notice);
  assert.match(mail.subject, /report-1/);
  for (const field of [
    "reporter-id",
    "casey",
    "reported-id",
    "(no handle)",
    "message-1",
    "chat-1",
    "spam",
    "buy this",
    "2026-04-01T00:00:00.000Z",
    "24 hours",
  ]) {
    assert.match(mail.text, new RegExp(field.replace(/[()]/g, "\\$&")));
  }
});

test("a failing mailer does not reject the caller", async () => {
  let calls = 0;
  setModerationMailerForTests(async () => {
    calls += 1;
    throw new Error("smtp down");
  });
  try {
    sendModerationNotice(notice);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(calls, 1);
  } finally {
    setModerationMailerForTests(null);
  }
});
