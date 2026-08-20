export const DEFAULT_PREFERRED_LANGUAGE = "English";

/**
 * Registration accepts an optional language because older clients and account
 * recovery flows may not have a locally persisted preference.
 */
export function normalizePreferredLanguage(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_PREFERRED_LANGUAGE;
  return value.trim() || DEFAULT_PREFERRED_LANGUAGE;
}