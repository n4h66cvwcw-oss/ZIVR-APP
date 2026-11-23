import assert from "node:assert/strict";
import test from "node:test";
import {
  formatModerationNotice,
  readSmtpConfig,
  resetMailerStateForTests,
  sendModerationNotice,
  setMailRetryDelayForTests,
  setTransportFactoryForTests,
  warnIfSmtpUnconfigured,
  type MailTransportOptions,
  type ModerationNotice,
} from "./mailer.ts";

const notice: ModerationNotice = {
  reportId: "report-1",
  reporterId: "reporter-id",
  reporterHandle: "casey\r\nBcc: evil@example.com",
  reportedUserId: "reported-id",
  reportedHandle: null,
  messageId: "message-1",
  chatId: "chat-1",
  reason: "spam",
  details: "buy this",
  createdAt: Date.parse("2026-04-01T00:00:00.000Z"),
};

test.beforeEach(() => {
  resetMailerStateForTests();
  setMailRetryDelayForTests(0);
  delete process.env["SMTP_HOST"];
  delete process.env["SMTP_PORT"];
  delete process.env["SMTP_USER"];
  delete process.env["SMTP_PASS"];
  delete process.env["SMTP_FROM"];
});

test("moderation notice strips header breaks from handles and keeps moderator fields", () => {
  const mail = formatModerationNotice(notice);
  assert.match(mail.subject, /report-1/);
  assert.equal(mail.subject.includes("\n"), false);
  assert.equal(mail.subject.includes("\r"), false);
  assert.match(mail.text, /casey Bcc: evil@example.com/);
  assert.equal(mail.text.includes("\r"), false);
  for (const field of ["reporter-id", "reported-id", "(no handle)", "message-1", "chat-1", "spam", "buy this", "24 hours"]) {
    assert.match(mail.text, new RegExp(field.replace(/[()]/g, "\\$&")));
  }
});

test("nodemailer transport uses requireTLS on 587 and secure on 465", async () => {
  const seen: MailTransportOptions[] = [];
  setTransportFactoryForTests((options) => {
    seen.push(options);
    return { sendMail: async () => ({ accepted: [options.host] }) };
  });

  process.env["SMTP_HOST"] = "smtp.test";
  process.env["SMTP_PORT"] = "587";
  process.env["SMTP_USER"] = "mailer";
  process.env["SMTP_PASS"] = "super-secret-pass";
  process.env["SMTP_FROM"] = "notices@zivrapp.com\r\nBcc: leak@example.com";
  const sent = new Promise<void>((resolve) => {
    const original = console.error;
    console.error = () => {};
    setTransportFactoryForTests((options) => {
      seen.push(options);
      return {
        sendMail: async (mail) => {
          assert.equal(mail.from.includes("\r"), false);
          assert.equal(mail.from.includes("\n"), false);
          assert.equal(mail.to.includes("\n"), false);
          assert.equal(mail.subject.includes("\n"), false);
          assert.equal(JSON.stringify(mail).includes("super-secret-pass"), false);
          resolve();
          return { accepted: [mail.to] };
        },
      };
    });
    sendModerationNotice(notice);
    console.error = original;
  });
  await sent;
  assert.equal(seen[0]?.port, 587);
  assert.equal(seen[0]?.secure, false);
  assert.equal(seen[0]?.requireTLS, true);
  assert.equal(seen[0]?.auth?.user, "mailer");
  assert.equal(JSON.stringify({ host: seen[0]?.host, port: seen[0]?.port }).includes("super-secret-pass"), false);

  seen.length = 0;
  process.env["SMTP_PORT"] = "465";
  await new Promise<void>((resolve) => {
    setTransportFactoryForTests((options) => {
      seen.push(options);
      resolve();
      return { sendMail: async () => ({}) };
    });
    sendModerationNotice(notice);
  });
  assert.equal(seen[0]?.secure, true);
  assert.equal(seen[0]?.requireTLS, false);
  assert.equal(readSmtpConfig()?.secure, true);
});

test("a failing transport is retried and the final log names the report id without credentials", async () => {
  let calls = 0;
  const logs: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    logs.push(args.map((part) => typeof part === "string" ? part : JSON.stringify(part)).join(" "));
  };
  process.env["SMTP_HOST"] = "smtp.test";
  process.env["SMTP_PORT"] = "587";
  process.env["SMTP_USER"] = "mailer";
  process.env["SMTP_PASS"] = "super-secret-pass";
  setTransportFactoryForTests(() => ({
    sendMail: async () => {
      calls += 1;
      const err = new Error("connection refused") as Error & { code?: string; responseCode?: number };
      err.code = "ECONNECTION";
      err.responseCode = 454;
      throw err;
    },
  }));
  try {
    sendModerationNotice(notice);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(calls, 3);
    const failed = logs.find((line) => line.includes("FAILED to email content report"));
    assert.ok(failed);
    assert.match(failed, /report-1/);
    assert.match(failed, /ECONNECTION/);
    assert.match(failed, /454/);
    assert.equal(logs.join("\n").includes("super-secret-pass"), false);
  } finally {
    console.error = original;
  }
});

test("boot warns loudly when SMTP_HOST is unset", () => {
  const warnings: string[] = [];
  const original = console.warn;
  console.warn = (message?: unknown) => {
    warnings.push(String(message));
  };
  try {
    delete process.env["SMTP_HOST"];
    warnIfSmtpUnconfigured();
    warnIfSmtpUnconfigured();
    assert.equal(warnings.length, 1);
    assert.match(warnings[0] ?? "", /WARNING: SMTP_HOST is unset/);
  } finally {
    console.warn = original;
  }
});
