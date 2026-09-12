import {
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

export type SyncableContact = {
  id: string;
  phone?: string;
  phoneNumbers?: string[];
  phoneRegion?: CountryCode;
  phoneNumberRegions?: Array<CountryCode | undefined>;
  hasApp?: boolean;
};

function phoneMatchKeys(
  phone?: string,
  region?: CountryCode,
): string[] {
  if (!phone) return [];

  const parsed = parsePhoneNumberFromString(phone, region);
  const digits = phone.replace(/\D/g, "");
  const isExplicitInternational = phone.trim().startsWith("+");

  if (region && !isExplicitInternational) {
    return parsed ? [parsed.number] : [];
  }

  return [
    ...(digits ? [digits] : []),
    ...(parsed ? [parsed.number] : []),
  ];
}

function normalizedPhones(contact: SyncableContact): string[] {
  const phones = contact.phoneNumbers ?? [contact.phone];
  const regions = contact.phoneNumberRegions ?? [contact.phoneRegion];

  return phones.flatMap((phone, index) =>
    phoneMatchKeys(phone, regions[index]),
  );
}

export function mergeSyncedContacts<T extends SyncableContact>(
  existingContacts: T[],
  deviceContacts: T[],
): T[] {
  const systemContacts = existingContacts
    .filter((contact) => !contact.id.startsWith("synced_"))
    .map((contact) => ({ ...contact, hasApp: true }));

  const systemPhones = new Set(
    systemContacts.flatMap(normalizedPhones),
  );

  const claimedPhones = new Set(systemPhones);
  const unmatchedDeviceContacts = deviceContacts
    .map((contact) => ({ ...contact, hasApp: false }))
    .filter((contact) => {
      const phones = normalizedPhones(contact);
      const isDuplicate = phones.some((phone) =>
        claimedPhones.has(phone),
      );

      phones.forEach((phone) => claimedPhones.add(phone));
      return !isDuplicate;
    });

  return [...systemContacts, ...unmatchedDeviceContacts] as T[];
}