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
 * Choose the auth token to use when the in-memory token is missing or was just
 * rejected (REST 401). Prefers the app-local token, falls back to the
 * SecureStore recovery identity, and skips a token the server just rejected
 * when a different stored copy exists.
 */
export function pickRehydratedAuthToken(
  localAuthToken: string | null,
  secureIdentity: string | null,
  rejectedToken: string | null = null,
): string | null {
  const secureToken = parseServerIdentity(secureIdentity)?.authToken ?? null;
  const candidates = [localAuthToken, secureToken].filter(
    (token): token is string => typeof token === "string" && token.length > 0,
  );
  if (candidates.length === 0) return null;
  return candidates.find((token) => token !== rejectedToken) ?? candidates[0];
}

export const SESSION_INVALID_MESSAGE =
  "Your session couldn't be verified, so this message wasn't sent. "
  + "Use Recover account with your saved recovery code to restore it. "
  + "Don't sign out or create a new account — your chats stay with this account.";
