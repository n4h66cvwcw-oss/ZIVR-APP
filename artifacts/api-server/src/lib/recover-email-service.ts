import { createRecoveryCode } from "./recovery-code";
import { maskEmail, type PhoneLookup } from "./recover-email";

/**
 * Core of POST /users/recover/request-email, dependency-injected for tests.
 * Never throws for "not found" — the route always answers a generic 200.
 */

type Query = <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;

export type RecoverEmailDeps = {
  query: Query;
  isMailConfigured: () => boolean;
  sendRecoveryCodeEmail: (input: {
    to: string;
    code: string;
    displayName?: string | null;
  }) => Promise<unknown>;
  log: {
    info: (obj: object, msg: string) => void;
    warn: (obj: object, msg: string) => void;
    error: (obj: object, msg: string) => void;
  };
};

export type RecoverEmailLookup =
  | { kind: "email"; email: string }
  | { kind: "phone"; phone: PhoneLookup };

export type RecoverEmailOutcome =
  | "sent"
  | "mail_not_configured"
  | "no_match"
  | "ambiguous"
  | "no_email_on_file"
  | "send_failed";

type Row = {
  id: string;
  displayName: string | null;
  email: string | null;
  prevHash: string | null;
  prevAck: boolean | null;
};

const SELECT_COLUMNS = `
  id,
  display_name               AS "displayName",
  email,
  recovery_code_hash         AS "prevHash",
  recovery_code_acknowledged AS "prevAck"
`;

export async function processRecoveryEmailRequest(
  lookup: RecoverEmailLookup,
  deps: RecoverEmailDeps,
): Promise<RecoverEmailOutcome> {
  if (!deps.isMailConfigured()) {
    deps.log.warn({ lookup: lookup.kind }, "recover/request-email: SMTP not configured; request dropped");
    return "mail_not_configured";
  }

  const rows =
    lookup.kind === "email"
      ? await deps.query<Row>(
        `SELECT ${SELECT_COLUMNS}
           FROM vm_users
          WHERE email IS NOT NULL AND lower(email) = $1
          LIMIT 2`,
        [lookup.email],
      )
      : await deps.query<Row>(
        `SELECT ${SELECT_COLUMNS}
           FROM vm_users
          WHERE phone IS NOT NULL
            AND (phone = ANY($1::text[])
                 OR regexp_replace(phone, '[^0-9]', '', 'g') = ANY($2::text[]))
          LIMIT 2`,
        [lookup.phone.exact, lookup.phone.digits],
      );

  if (rows.length === 0) {
    deps.log.info({ lookup: lookup.kind }, "recover/request-email: no matching account");
    return "no_match";
  }
  if (rows.length > 1) {
    deps.log.warn(
      { lookup: lookup.kind, userIds: rows.map((r) => r.id) },
      "recover/request-email: identifier matches multiple accounts; not sending",
    );
    return "ambiguous";
  }
  const user = rows[0]!;
  const to = user.email?.trim();
  if (!to) {
    deps.log.info({ lookup: lookup.kind, userId: user.id }, "recover/request-email: account has no email on file");
    return "no_email_on_file";
  }

  // Mint → persist hash → send. On send failure, compare-and-swap the
  // previous hash back so the user's old code keeps working.
  const recovery = createRecoveryCode();
  await deps.query(
    `UPDATE vm_users
        SET recovery_code_hash = $1,
            recovery_code_acknowledged = false
      WHERE id = $2`,
    [recovery.hash, user.id],
  );

  try {
    await deps.sendRecoveryCodeEmail({ to, code: recovery.code, displayName: user.displayName });
  } catch (error) {
    deps.log.error(
      {
        userId: user.id,
        to: maskEmail(to),
        err: error instanceof Error ? { name: error.name, message: error.message } : String(error),
      },
      "recover/request-email: SMTP send failed; restoring previous recovery code",
    );
    try {
      await deps.query(
        `UPDATE vm_users
            SET recovery_code_hash = $1,
                recovery_code_acknowledged = $2
          WHERE id = $3
            AND recovery_code_hash = $4`,
        [user.prevHash, user.prevAck ?? false, user.id, recovery.hash],
      );
    } catch (restoreError) {
      deps.log.error(
        { userId: user.id, err: restoreError instanceof Error ? restoreError.message : String(restoreError) },
        "recover/request-email: failed to restore previous recovery code",
      );
    }
    return "send_failed";
  }

  deps.log.info(
    { userId: user.id, lookup: lookup.kind, to: maskEmail(to) },
    "recover/request-email: recovery code emailed",
  );
  return "sent";
}
