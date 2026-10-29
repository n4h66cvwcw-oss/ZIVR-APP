export type StoredServerIdentity = {
  userId: string;
  authToken: string;
};

export function serializeServerIdentity(identity: StoredServerIdentity): string {
  return JSON.stringify(identity);
}

export function parseServerIdentity(raw: string | null): StoredServerIdentity | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredServerIdentity>;
    if (
      typeof parsed.userId === "string" &&
      parsed.userId.length > 0 &&
      typeof parsed.authToken === "string" &&
      parsed.authToken.length > 0
    ) {
      return { userId: parsed.userId, authToken: parsed.authToken };
    }
  } catch {
    // A corrupt recovery record is ignored; normal registration remains available.
  }
  return null;
}

/**
 * Prefer the ordinary app-local session, but fall back to the OS-protected
 * recovery copy after an app reinstall or storage reset removes AsyncStorage.
 */
export function resolveServerIdentity(
  localUserId: string | null,
  localAuthToken: string | null,
  secureIdentity: string | null,
): StoredServerIdentity | null {
  if (localUserId && localAuthToken) {
    return { userId: localUserId, authToken: localAuthToken };
  }
  return parseServerIdentity(secureIdentity);
}

/**
 * Token for REST calls. Prefer the in-memory or AsyncStorage copy, and recover
 * from the SecureStore identity blob when that copy is missing.
 */
export function resolveRequestAuthToken(
  memoryToken: string | null | undefined,
  localToken: string | null | undefined,
  secureIdentity: string | null | undefined,
): string | null {
  if (memoryToken) return memoryToken;
  if (localToken) return localToken;
  return parseServerIdentity(secureIdentity ?? null)?.authToken ?? null;
}

export type MessageSendAck = {
  ok?: boolean;
  error?: string;
};

export function isAuthFailureMessage(message: string | null | undefined): boolean {
  if (!message) return false;
  return /invalid or missing auth token|not authenticated|authentication failed/i.test(message);
}

export function isMessageSendAuthFailure(ack: MessageSendAck | null | undefined): boolean {
  return ack?.ok === false && isAuthFailureMessage(ack.error);
}

export type MessageSendFollowUp = "retry-rest" | "account-recovery" | "none";

/**
 * A socket auth failure gets exactly one REST attempt. If that attempt is also
 * an auth failure, stop and send the user to account recovery. Do not register
 * a new account — that would mint a user and orphan the existing chats.
 */
export function messageSendFollowUp(input: {
  ack?: MessageSendAck | null;
  restAttempted: boolean;
  restStatus?: number | null;
  restError?: string | null;
}): MessageSendFollowUp {
  if (!input.restAttempted) {
    return isMessageSendAuthFailure(input.ack) ? "retry-rest" : "none";
  }
  const restAuthFailed = input.restStatus === 401 || isAuthFailureMessage(input.restError);
  return restAuthFailed ? "account-recovery" : "none";
}

export function accountRecoveryPrompt(): { title: string; message: string; confirmLabel: string } {
  return {
    title: "Restore your account",
    message:
      "ZIVR couldn't verify this session. Enter the recovery code you saved to restore this account. Creating a new account would leave your existing chats behind.",
    confirmLabel: "Recover account",
  };
}