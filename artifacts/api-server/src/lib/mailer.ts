import nodemailer from "nodemailer";

/**
 * Moderation notices via nodemailer.
 * SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM.
 * Port 465 uses implicit TLS (`secure`). Port 587 requires STARTTLS (`requireTLS`).
 * Credentials and AUTH payloads are never logged.
 */

export type ModerationNotice = {
  reportId: string;
  reporterId: string;
  reporterHandle: string | null;
  reportedUserId: string;
  reportedHandle: string | null;
  messageId: string | null;
  chatId: string | null;
  reason: string;
  details: string | null;
  createdAt: number;
};

export type MailTransportOptions = {
  host: string;
  port: number;
  secure: boolean;
  requireTLS: boolean;
  auth?: { user: string; pass: string };
};

type OutgoingMail = { from: string; to: string; subject: string; text: string };

type MailTransport = {
  sendMail: (mail: OutgoingMail) => Promise<unknown>;
};

const DEFAULT_MODERATION_EMAIL = "support@zivrapp.com";
const MAX_ATTEMPTS = 3;

let bootWarned = false;
let retryDelayMs = 400;

export function stripHeaderBreaks(value: string): string {
  return value.replace(/[\r\n]+/g, " ").replace(/[ \t]{2,}/g, " ").trim();
}

export function moderationInbox(): string {
  const configured = process.env["MODERATION_EMAIL"]?.trim();
  return stripHeaderBreaks(configured || DEFAULT_MODERATION_EMAIL);
}

export function formatModerationNotice(notice: ModerationNotice): { subject: string; text: string } {
  const handle = (value: string | null) => {
    const clean = value ? stripHeaderBreaks(value) : "";
    return clean || "(no handle)";
  };
  const details = notice.details?.replace(/\r/g, "").trim() || "(none)";
  const text = [
    "A ZIVR user submitted a content report.",
    "",
    `Report ID: ${stripHeaderBreaks(notice.reportId)}`,
    `Created at: ${new Date(notice.createdAt).toISOString()} (${notice.createdAt})`,
    `Reporter: ${stripHeaderBreaks(notice.reporterId)} / ${handle(notice.reporterHandle)}`,
    `Reported user: ${stripHeaderBreaks(notice.reportedUserId)} / ${handle(notice.reportedHandle)}`,
    `Message ID: ${notice.messageId ? stripHeaderBreaks(notice.messageId) : "(none)"}`,
    `Chat ID: ${notice.chatId ? stripHeaderBreaks(notice.chatId) : "(none)"}`,
    `Reason: ${stripHeaderBreaks(notice.reason)}`,
    `Details: ${details}`,
    "",
    "Apple App Store Guideline 1.2 expects this report to be acted on within 24 hours.",
  ].join("\n");
  return {
    subject: stripHeaderBreaks(`ZIVR content report ${notice.reportId}`),
    text,
  };
}

export function readSmtpConfig(): MailTransportOptions | null {
  const host = process.env["SMTP_HOST"]?.trim();
  if (!host) return null;
  const port = Number(process.env["SMTP_PORT"] || 587);
  if (!Number.isFinite(port) || port <= 0) return null;
  const user = process.env["SMTP_USER"]?.trim() ?? "";
  const pass = process.env["SMTP_PASS"] ?? "";
  const secure = port === 465;
  return {
    host: stripHeaderBreaks(host),
    port,
    secure,
    requireTLS: port === 587,
    ...(user ? { auth: { user: stripHeaderBreaks(user), pass } } : {}),
  };
}

export function warnIfSmtpUnconfigured(): void {
  if (bootWarned || process.env["SMTP_HOST"]?.trim()) return;
  bootWarned = true;
  console.warn(
    "[moderation] WARNING: SMTP_HOST is unset. Content reports will be saved but NOT emailed to moderators. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM before production traffic.",
  );
}

export function resetMailerStateForTests(): void {
  bootWarned = false;
  retryDelayMs = 0;
  senderOverride = null;
  transportFactory = defaultTransportFactory;
}

export function setMailRetryDelayForTests(ms: number): void {
  retryDelayMs = ms;
}

function defaultTransportFactory(options: MailTransportOptions): MailTransport {
  return nodemailer.createTransport(options);
}

let transportFactory = defaultTransportFactory;

/** Tests supply a fake nodemailer transport. Production uses nodemailer.createTransport. */
export function setTransportFactoryForTests(
  factory: ((options: MailTransportOptions) => MailTransport) | null,
): void {
  transportFactory = factory ?? defaultTransportFactory;
}

type MailSender = (notice: ModerationNotice) => Promise<void>;
let senderOverride: MailSender | null = null;

/** Integration tests replace the whole send. Leave unset in production. */
export function setModerationMailerForTests(sender: MailSender | null): void {
  senderOverride = sender;
}

function mailErrorFields(err: unknown): { code?: string; responseCode?: number; message?: string } {
  const value = err && typeof err === "object" ? err as { code?: unknown; responseCode?: unknown; message?: unknown } : {};
  return {
    ...(typeof value.code === "string" ? { code: value.code } : {}),
    ...(typeof value.responseCode === "number" ? { responseCode: value.responseCode } : {}),
    ...(typeof value.message === "string" ? { message: value.message } : {}),
  };
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function deliverOnce(notice: ModerationNotice): Promise<void> {
  const smtp = readSmtpConfig();
  const to = moderationInbox();
  const from = stripHeaderBreaks(process.env["SMTP_FROM"]?.trim() || smtp?.auth?.user || "noreply@zivrapp.com");
  const { subject, text } = formatModerationNotice(notice);
  if (!smtp) {
    console.error(`[moderation] report ${notice.reportId} was not emailed because SMTP_HOST is unset`);
    return;
  }
  const transport = transportFactory(smtp);
  await transport.sendMail({ from, to, subject, text });
}

async function deliverWithRetry(notice: ModerationNotice): Promise<void> {
  let last: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await deliverOnce(notice);
      return;
    } catch (err) {
      last = err;
      console.error("[moderation] email attempt failed", {
        reportId: notice.reportId,
        attempt,
        ...mailErrorFields(err),
      });
      if (attempt < MAX_ATTEMPTS) await sleep(retryDelayMs * attempt);
    }
  }
  console.error("[moderation] FAILED to email content report after final attempt", {
    reportId: notice.reportId,
    attempts: MAX_ATTEMPTS,
    ...mailErrorFields(last),
  });
}

/**
 * Fire-and-forget. Never throws — report creation must succeed even when
 * email delivery fails.
 */
export function sendModerationNotice(notice: ModerationNotice): void {
  const send = senderOverride ?? deliverWithRetry;
  void send(notice).catch((err: unknown) => {
    console.error("[moderation] FAILED to email content report", {
      reportId: notice.reportId,
      ...mailErrorFields(err),
    });
  });
}
