import {
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

/**
 * E.164 normalization shared by phone lookup.
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
  const country =
    region && /^[A-Z]{2}$/.test(region) ? (region as CountryCode) : undefined;
  try {
    const parsed = parsePhoneNumberFromString(phone, country);
    if (!parsed?.isValid()) return null;
    return parsed.number;
  } catch {
    return null;
  }
}

export type PhoneLookup = {
  /** Canonical key used for rate limiting (digits, US 10-digit promoted to 1XXXXXXXXXX). */
  key: string;
  /** Exact `phone` column values to match (raw query, digit-only, E.164, legacy shapes). */
  exact: string[];
  /** Digit-only forms to match against regexp_replace(phone, '[^0-9]', '', 'g'). */
  digits: string[];
};

/**
 * Build every plausible stored shape for a phone query so a row stored as
 * E.164 or as a legacy national form of the same number both match.
 * `+14155550100`, `14155550100`, `4155550100`, and `(415) 555-0100` share
 * one candidate set. Includes the raw query string, its digit-only form,
 * and E.164 when libphonenumber can parse it. A bare 10-digit number
 * defaults to US when that parse is valid. Returns null when the digit
 * count is outside 7–15; callers that must still exact-match should fall
 * back to the raw string.
 */
export function phoneLookupCandidates(
  rawPhone: unknown,
  phoneCountryCode?: unknown,
): PhoneLookup | null {
  if (typeof rawPhone !== "string") return null;
  const trimmed = rawPhone.trim();
  const onlyDigits = trimmed.replace(/\D/g, "");
  if (onlyDigits.length < 7 || onlyDigits.length > 15) return null;

  const country =
    typeof phoneCountryCode === "string" && phoneCountryCode.trim()
      ? phoneCountryCode.trim().toUpperCase()
      : "US";

  const digits = new Set<string>([onlyDigits]);
  if (onlyDigits.length === 10) digits.add(`1${onlyDigits}`);
  if (onlyDigits.length === 11 && onlyDigits.startsWith("1"))
    digits.add(onlyDigits.slice(1));

  let e164: string | null = null;
  try {
    e164 =
      normalizePhoneNumber({ phone: trimmed, phoneCountryCode: country }) ??
      null;
  } catch {
    e164 = null;
  }
  if (!e164 && trimmed.startsWith("+")) {
    try {
      // "+<cc>…" parses without a matching region hint.
      e164 =
        normalizePhoneNumber({ phone: trimmed, phoneCountryCode: "US" }) ??
        null;
    } catch {
      e164 = null;
    }
  }
  if (e164) digits.add(e164.replace(/\D/g, ""));

  const exact = new Set<string>();
  if (e164) exact.add(e164);
  exact.add(rawPhone);
  exact.add(trimmed);
  for (const d of digits) {
    exact.add(d);
    exact.add(`+${d}`);
  }

  const key = e164
    ? e164.replace(/\D/g, "")
    : onlyDigits.length === 10
      ? `1${onlyDigits}`
      : onlyDigits;

  return { key, exact: [...exact], digits: [...digits] };
}

/**
 * Same predicate as the find / recover-email SQL:
 * `phone = ANY(exact)` OR digits-only `phone` is in `digits`.
 */
export function storedPhoneMatchesLookup(
  storedPhone: string | null | undefined,
  lookup: PhoneLookup,
): boolean {
  if (typeof storedPhone !== "string" || storedPhone.length === 0) return false;
  if (lookup.exact.includes(storedPhone)) return true;
  const digits = storedPhone.replace(/[^0-9]/g, "");
  return digits.length > 0 && lookup.digits.includes(digits);
}
