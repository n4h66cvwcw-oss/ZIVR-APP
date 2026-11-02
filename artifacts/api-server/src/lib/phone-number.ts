import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

/**
 * E.164 normalization used by recover-email phone lookup.
 * The live server already had this helper; the public tree did not, so this
 * is the same contract: `{ phone, phoneCountryCode }` → `+E164` or null.
 */
export function normalizePhoneNumber(input: {
  phone?: string | null;
  phoneCountryCode?: string | null;
}): string | null {
  const phone = input.phone?.trim();
  if (!phone) return null;

  const region = input.phoneCountryCode?.trim().toUpperCase();
  const country = region && /^[A-Z]{2}$/.test(region) ? (region as CountryCode) : undefined;
  try {
    const parsed = parsePhoneNumberFromString(phone, country);
    if (!parsed?.isValid()) return null;
    return parsed.number;
  } catch {
    return null;
  }
}
