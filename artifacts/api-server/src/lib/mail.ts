import nodemailer, { type Transporter } from "nodemailer";
import { buildRecoveryCodeEmail, getSmtpConfig, type SmtpConfig } from "./mail-config";

export { MailNotConfigured, isMailConfigured } from "./mail-config";

let cached: { key: string; transporter: Transporter } | null = null;

function transporterFor(config: SmtpConfig): Transporter {
  const key = `${config.host}:${config.port}:${config.secure}:${config.user}`;
  if (cached?.key === key) return cached.transporter;
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: !config.secure,
    auth: { user: config.user, pass: config.pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  cached = { key, transporter };
  return transporter;
}

/**
 * Email a plaintext recovery code. Throws MailNotConfigured when SMTP_* are
 * missing (checked before connecting); rethrows transport errors otherwise.
 */
export async function sendRecoveryCodeEmail({
  to,
  code,
  displayName,
}: {
  to: string;
  code: string;
  displayName?: string | null;
}): Promise<{ messageId: string }> {
  const config = getSmtpConfig();
  const message = buildRecoveryCodeEmail({ code, displayName });
  const info = await transporterFor(config).sendMail({
    from: config.from,
    to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
  return { messageId: info.messageId };
}
