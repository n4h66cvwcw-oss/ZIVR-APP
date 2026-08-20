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