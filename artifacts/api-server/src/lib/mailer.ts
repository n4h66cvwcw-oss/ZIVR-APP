import net from "node:net";
import tls from "node:tls";

/**
 * Moderation notices.
 *
 * api-server does not import a mail library today. `nodemailer` is only named
 * in build.mjs as an esbuild external placeholder and is not installed.
 * This module sends through the process SMTP settings (SMTP_HOST / SMTP_PORT /
 * SMTP_USER / SMTP_PASS / SMTP_FROM) with Node's net/tls sockets so report
 * creation does not take a new dependency. When SMTP_HOST is unset the notice
 * is logged and not delivered — dev and tests must not send real mail.
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

const DEFAULT_MODERATION_EMAIL = "support@zivrapp.com";

export function moderationInbox(): string {
  const configured = process.env["MODERATION_EMAIL"]?.trim();
  return configured || DEFAULT_MODERATION_EMAIL;
}

export function formatModerationNotice(notice: ModerationNotice): { subject: string; text: string } {
  const handle = (value: string | null) => value?.trim() || "(no handle)";
  const text = [
    "A ZIVR user submitted a content report.",
    "",
    `Report ID: ${notice.reportId}`,
    `Created at: ${new Date(notice.createdAt).toISOString()} (${notice.createdAt})`,
    `Reporter: ${notice.reporterId} / ${handle(notice.reporterHandle)}`,
    `Reported user: ${notice.reportedUserId} / ${handle(notice.reportedHandle)}`,
    `Message ID: ${notice.messageId ?? "(none)"}`,
    `Chat ID: ${notice.chatId ?? "(none)"}`,
    `Reason: ${notice.reason}`,
    `Details: ${notice.details?.trim() || "(none)"}`,
    "",
    "Apple App Store Guideline 1.2 expects this report to be acted on within 24 hours.",
  ].join("\n");
  return {
    subject: `ZIVR content report ${notice.reportId}`,
    text,
  };
}

type MailSender = (notice: ModerationNotice) => Promise<void>;

let senderOverride: MailSender | null = null;

/** Tests inject a fake sender. Production leaves this unset. */
export function setModerationMailerForTests(sender: MailSender | null): void {
  senderOverride = sender;
}

/**
 * Fire-and-forget. Never throws — report creation must succeed even when
 * email delivery fails.
 */
export function sendModerationNotice(notice: ModerationNotice): void {
  const send = senderOverride ?? deliverModerationNotice;
  void send(notice).catch((err: unknown) => {
    console.error("[moderation] failed to email report notice", err);
  });
}

type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  implicitTls: boolean;
};

export function readSmtpConfig(): SmtpConfig | null {
  const host = process.env["SMTP_HOST"]?.trim();
  if (!host) return null;
  const port = Number(process.env["SMTP_PORT"] || 587);
  if (!Number.isFinite(port) || port <= 0) return null;
  const user = process.env["SMTP_USER"]?.trim() ?? "";
  const pass = process.env["SMTP_PASS"] ?? "";
  const from = process.env["SMTP_FROM"]?.trim() || user || "noreply@zivrapp.com";
  const implicitTls = process.env["SMTP_SECURE"] === "1" || port === 465;
  return { host, port, user, pass, from, implicitTls };
}

async function deliverModerationNotice(notice: ModerationNotice): Promise<void> {
  const to = moderationInbox();
  const { subject, text } = formatModerationNotice(notice);
  console.info("[moderation] content report", {
    reportId: notice.reportId,
    reporterId: notice.reporterId,
    reportedUserId: notice.reportedUserId,
    messageId: notice.messageId,
    chatId: notice.chatId,
    reason: notice.reason,
    to,
  });
  const smtp = readSmtpConfig();
  if (!smtp) {
    console.info("[moderation] SMTP_HOST unset; report notice was not emailed");
    return;
  }
  await sendSmtp(smtp, { to, subject, text });
}

type OutgoingMail = { to: string; subject: string; text: string };

class SmtpReader {
  private buffer = "";
  private pending: Array<(code: string) => void> = [];
  private socket: net.Socket;

  constructor(socket: net.Socket) {
    this.socket = socket;
    socket.on("data", (chunk: Buffer | string) => {
      this.buffer += chunk.toString("utf8");
      this.drain();
    });
  }

  private drain(): void {
    let newline = this.buffer.indexOf("\n");
    while (newline >= 0) {
      const line = this.buffer.slice(0, newline).replace(/\r$/, "");
      this.buffer = this.buffer.slice(newline + 1);
      const continued = line.length >= 4 && line[3] === "-";
      if (!continued) {
        const waiter = this.pending.shift();
        waiter?.(line.slice(0, 3));
      }
      newline = this.buffer.indexOf("\n");
    }
  }

  command(line: string | null, expectedPrefix: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`SMTP timeout${line ? ` after ${line.split(" ")[0]}` : ""}`)), 10_000);
      this.pending.push((code) => {
        clearTimeout(timer);
        if (code.startsWith(expectedPrefix)) resolve();
        else reject(new Error(`SMTP ${line ? line.split(" ")[0] : "greeting"} returned ${code}`));
      });
      if (line !== null) this.socket.write(`${line}\r\n`);
    });
  }
}

function connectPlain(host: string, port: number): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port }, () => resolve(socket));
    socket.setTimeout(10_000, () => {
      socket.destroy();
      reject(new Error("SMTP connection timed out"));
    });
    socket.once("error", reject);
  });
}

function connectTls(host: string, port: number, socket?: net.Socket): Promise<tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    const secure = tls.connect({ host, port, servername: host, socket }, () => resolve(secure));
    secure.setTimeout(10_000, () => {
      secure.destroy();
      reject(new Error("SMTP TLS timed out"));
    });
    secure.once("error", reject);
  });
}

async function sendSmtp(cfg: SmtpConfig, mail: OutgoingMail): Promise<void> {
  const plain = cfg.implicitTls ? null : await connectPlain(cfg.host, cfg.port);
  let socket: net.Socket = plain ?? await connectTls(cfg.host, cfg.port);
  let reader = new SmtpReader(socket);
  const close = () => {
    socket.destroy();
  };
  try {
    await reader.command(null, "220");
    await reader.command("EHLO zivr.local", "250");
    if (!cfg.implicitTls) {
      await reader.command("STARTTLS", "220");
      socket.removeAllListeners("data");
      socket = await connectTls(cfg.host, cfg.port, plain ?? undefined);
      reader = new SmtpReader(socket);
      await reader.command("EHLO zivr.local", "250");
    }
    if (cfg.user) {
      await reader.command("AUTH LOGIN", "334");
      await reader.command(Buffer.from(cfg.user).toString("base64"), "334");
      await reader.command(Buffer.from(cfg.pass).toString("base64"), "235");
    }
    await reader.command(`MAIL FROM:<${cfg.from}>`, "250");
    await reader.command(`RCPT TO:<${mail.to}>`, "250");
    await reader.command("DATA", "354");
    const body = [
      `From: ${cfg.from}`,
      `To: ${mail.to}`,
      `Subject: ${mail.subject}`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=utf-8",
      "",
      mail.text.replace(/^\./gm, ".."),
      ".",
    ].join("\r\n");
    await reader.command(body, "250");
    await reader.command("QUIT", "221");
  } finally {
    close();
  }
}
