/** Shown after a public email-code request. The server never returns the code. */
export const RECOVERY_EMAIL_SENT_MESSAGE =
  "Check your inbox and spam, then enter the code below.";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type RecoveryEmailRequest = {
  email?: string;
  phone?: string;
};

/**
 * Body for `POST /users/recover/request-email`. Email is collected now;
 * phone is accepted so SMS can be added later without changing the call.
 * Returns null when nothing usable was provided, or when a supplied email
 * is not a single address. Never includes a recovery code.
 */
export function recoveryEmailRequestBody(input: {
  email?: string;
  phone?: string;
}): RecoveryEmailRequest | null {
  const email = input.email?.trim().toLowerCase() ?? "";
  const phone = input.phone?.trim() ?? "";
  if (email && !EMAIL_PATTERN.test(email)) return null;
  if (!email && !phone) return null;
  return {
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
  };
}

/** Value for the authenticated profile update. Blank input is left unchanged. */
export function recoveryEmailProfileUpdate(email: string): { email: string } | null {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  if (!EMAIL_PATTERN.test(normalized)) return null;
  return { email: normalized };
}
