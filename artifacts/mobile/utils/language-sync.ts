export type LanguageSyncProfile = {
  primaryLanguage?: string;
  primaryLanguageUserId?: string;
};

export type LanguageSyncUpdate = Pick<
  LanguageSyncProfile,
  "primaryLanguage" | "primaryLanguageUserId"
>;

/**
 * A device profile belongs to one active server identity at a time. Before an
 * authenticated account handoff, discard its cached language so the next
 * account is always hydrated from its own server record.
 */
export function clearCachedLanguageForIdentitySwitch(): LanguageSyncUpdate {
  return {
    primaryLanguage: undefined,
    primaryLanguageUserId: undefined,
  };
}

/**
 * Resolves a server language only when the active account changes or a
 * recovered profile has no local language. A local choice already associated
 * with the active account always wins to avoid overwriting an unsynced choice.
 */
export function getRecoveredLanguageUpdate(
  profile: LanguageSyncProfile,
  serverUserId: string | null,
  serverLanguage?: string,
): LanguageSyncUpdate | null {
  if (!serverUserId || !serverLanguage) return null;

  if (profile.primaryLanguageUserId === serverUserId && profile.primaryLanguage) {
    return null;
  }

  // Existing profiles from before identity ownership was tracked contain a
  // local language but no owner. Preserve that intentional local setting and
  // associate it with the identity that is currently active.
  if (profile.primaryLanguage && !profile.primaryLanguageUserId) {
    return { primaryLanguageUserId: serverUserId };
  }

  return {
    primaryLanguage: serverLanguage,
    primaryLanguageUserId: serverUserId,
  };
}