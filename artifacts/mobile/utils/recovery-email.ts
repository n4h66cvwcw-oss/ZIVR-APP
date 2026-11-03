/**
 * Pure helpers for POST /users/recover/request-email (Ironman contract, TF27).
 * Anti-enumeration: "sent" means "request accepted", never "an account exists".
 * Server returns 200 {ok:true} even when SMTP is missing (it simply does not mint).
 */
export type RecoveryEmailRequestResult =
  | "sent"
  | "missing_target"
  | "invalid_email"
  | "invalid_phone"
  | "rate_limited"
  | "unavailable"
  | "network_error";

export type RecoveryEmailOutcome = {
  result: RecoveryEmailRequestResult;
  /** Seconds to wait before retrying (429 only), from JSON `retryAfterSeconds` or `Retry-After`. */
  retryAfterSeconds?: number;
};

/** Parse a retry hint from JSON `retryAfterSeconds` (preferred) or a `Retry-After` header (seconds). */
export function parseRetryAfterSeconds(bodyValue: unknown, header?: string | null): number | undefined {
  const fromBody = typeof bodyValue === "number" ? bodyValue : typeof bodyValue === "string" ? Number(bodyValue) : NaN;
  if (Number.isFinite(fromBody) && fromBody > 0) return Math.ceil(fromBody);
  if (header && /^\s*\d+\s*$/.test(header)) {
    const n = Number(header.trim());
    if (n > 0) return n;
  }
  return undefined;
}

/** Map the request-email HTTP response to a client outcome. Error codes match case-insensitively. */
export function mapRecoveryEmailResponse(status: number, errorCode?: string): RecoveryEmailRequestResult {
  const code = (errorCode ?? "").trim().toUpperCase();
  if (status >= 200 && status < 300) return "sent";
  if (status === 429 || code === "RATE_LIMITED") return "rate_limited";
  if (status === 503 || code === "EMAIL_DELIVERY_UNAVAILABLE") return "unavailable";
  if (code === "INVALID_EMAIL") return "invalid_email";
  if (code === "INVALID_PHONE") return "invalid_phone";
  if (code === "IDENTIFIER_REQUIRED" || code === "EMAIL_OR_PHONE_REQUIRED" || status === 400) return "missing_target";
  // Endpoint not deployed yet on this server.
  if (status === 404) return "unavailable";
  // Any other soft failure: generic copy (no enumeration).
  return "sent";
}

export const RECOVERY_EMAIL_SENT_COPY =
  "If an account matches, check your inbox and spam, then enter the code below.";

/** User-facing copy for an outcome (exported for tests). */
export function recoveryEmailCopy(outcome: RecoveryEmailOutcome): { text: string; isError: boolean } {
  switch (outcome.result) {
    case "sent":
      return { text: RECOVERY_EMAIL_SENT_COPY, isError: false };
    case "missing_target":
      return { text: "Enter the email or phone number on your account.", isError: true };
    case "invalid_email":
      return { text: "That email address doesn't look right. Check it and try again.", isError: true };
    case "invalid_phone":
      return { text: "That phone number doesn't look right. Include your country code and try again.", isError: true };
    case "rate_limited": {
      const s = outcome.retryAfterSeconds;
      if (s && s > 0) {
        const wait = s < 90 ? `${s} second${s === 1 ? "" : "s"}` : `${Math.ceil(s / 60)} minutes`;
        return { text: `Too many tries — try again in about ${wait}.`, isError: true };
      }
      return { text: "Too many tries — try again later.", isError: true };
    }
    case "unavailable":
      return { text: "Email recovery not available yet.", isError: true };
    default:
      return { text: "Couldn't reach ZIVR. Check your connection and try again.", isError: true };
  }
}
