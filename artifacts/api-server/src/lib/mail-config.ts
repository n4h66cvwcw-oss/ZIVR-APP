/**
 * SMTP config for transactional mail (Migadu). No nodemailer import here so
 * route/service code and tests can check configuration without the transport.
 *
 * Env (Replit Secrets):
 *   SMTP_HOST   e.g. smtp.migadu.com            (required)
 *   SMTP_PORT   default 465 (implicit TLS); 587 = STARTTLS
 *   SMTP_USER   full mailbox, e.g. noreply@zivr.app (required)
 *   SMTP_PASS   mailbox password                (required)
 *   SMTP_FROM   default SMTP_USER; may be "ZIVR <noreply@zivr.app>"
 *   SMTP_SECURE optional "true"/"false" override (default: port === 465)
 */
export class MailNotConfigured extends Error {
  readonly missing: string[];
  constructor(missing: string[]) {
    super(`SMTP not configured; missing ${missing.join(", ")}`);
    this.name = "MailNotConfigured";
    this.missing = missing;
  }
}

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

type Env = Record<string, string | undefined>;

export function getSmtpConfig(env: Env = process.env): SmtpConfig {
  const host = env["SMTP_HOST"]?.trim();
  const user = env["SMTP_USER"]?.trim();
  const pass = env["SMTP_PASS"];
  const missing: string[] = [];
  if (!host) missing.push("SMTP_HOST");
  if (!user) missing.push("SMTP_USER");
  if (!pass) missing.push("SMTP_PASS");
  if (missing.length > 0) throw new MailNotConfigured(missing);

  const rawPort = env["SMTP_PORT"]?.trim();
  const port = rawPort ? Number(rawPort) : 465;
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new MailNotConfigured(["SMTP_PORT (invalid)"]);
  }
  const secureOverride = env["SMTP_SECURE"]?.trim().toLowerCase();
  const secure =
    secureOverride === "true" ? true : secureOverride === "false" ? false : port === 465;

  return {
    host: host!,
    port,
    secure,
    user: user!,
    pass: pass!,
    from: env["SMTP_FROM"]?.trim() || user!,
  };
}

export function isMailConfigured(env: Env = process.env): boolean {
  try {
    getSmtpConfig(env);
    return true;
  } catch {
    return false;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildRecoveryCodeEmail({
  code,
  displayName,
}: {
  code: string;
  displayName?: string | null;
}): { subject: string; text: string; html: string } {
  const name = displayName?.trim();
  const greeting = name ? `Hi ${name},` : "Hi,";
  const subject = "Your ZIVR recovery code";
  const text = [
    greeting,
    "",
    "Here is your new ZIVR recovery code:",
    "",
    code,
    "",
    "To restore your account: open ZIVR, tap Recover account → Restore, and paste this code.",
    "Your previous recovery code no longer works. Save this one somewhere safe.",
    "",
    "If you did not request this, you can ignore this email. Only someone with access to this inbox can use the code.",
    "",
    "— ZIVR",
  ].join("\n");
  const html = `<!doctype html>
<html><body style="font-family:-apple-system,Segoe UI,sans-serif;color:#111;line-height:1.5">
<p>${escapeHtml(greeting)}</p>
<p>Here is your new ZIVR recovery code:</p>
<p style="font-family:ui-monospace,Menlo,monospace;font-size:20px;letter-spacing:1px;background:#f3f0ff;padding:12px 16px;border-radius:8px;display:inline-block">${escapeHtml(code)}</p>
<p>To restore your account: open ZIVR, tap <b>Recover account → Restore</b>, and paste this code.</p>
<p>Your previous recovery code no longer works. Save this one somewhere safe.</p>
<p style="color:#666">If you did not request this, you can ignore this email. Only someone with access to this inbox can use the code.</p>
<p>— ZIVR</p>
</body></html>`;
  return { subject, text, html };
}
