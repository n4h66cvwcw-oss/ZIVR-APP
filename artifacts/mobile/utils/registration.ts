export type RegistrationOptions = {
  displayName: string;
  username?: string;
  phone?: string;
  avatar?: string;
  statusMessage?: string;
  preferredLanguage?: string;
};

export function normalizeRegistrationLanguage(primaryLanguage?: string): string | undefined {
  return primaryLanguage?.trim() || undefined;
}

export function buildRegistrationOptions(input: {
  displayName: string;
  username?: string;
  phone?: string;
  avatar?: string;
  statusMessage?: string;
  primaryLanguage?: string;
}): RegistrationOptions {
  return {
    displayName: input.displayName,
    username: input.username,
    phone: input.phone,
    avatar: input.avatar,
    statusMessage: input.statusMessage,
    preferredLanguage: normalizeRegistrationLanguage(input.primaryLanguage),
  };
}

/**
 * Only defined values are sent when a recovered, authenticated account is
 * updated. In particular, an absent local language must not overwrite the
 * existing language on that account's server record.
 */
export function buildRecoveredAccountUpdate(input: RegistrationOptions): RegistrationOptions {
  return {
    displayName: input.displayName,
    ...(input.username !== undefined ? { username: input.username } : {}),
    ...(input.phone !== undefined ? { phone: input.phone } : {}),
    ...(input.avatar !== undefined ? { avatar: input.avatar } : {}),
    ...(input.statusMessage !== undefined ? { statusMessage: input.statusMessage } : {}),
    ...(input.preferredLanguage !== undefined
      ? { preferredLanguage: input.preferredLanguage }
      : {}),
  };
}