export type SyncableContact = {
  id: string;
  phone?: string;
  phoneNumbers?: string[];
  hasApp?: boolean;
};

function normalizePhone(phone?: string): string | undefined {
  const normalized = phone?.replace(/\D/g, "");
  return normalized || undefined;
}

export function mergeSyncedContacts<T extends SyncableContact>(
  existingContacts: T[],
  deviceContacts: T[],
): T[] {
  const systemContacts = existingContacts
    .filter((contact) => !contact.id.startsWith("synced_"))
    .map((contact) => ({ ...contact, hasApp: true }));

  const systemPhones = new Set(
    systemContacts.map((contact) => normalizePhone(contact.phone)).filter(Boolean),
  );

  const unmatchedDeviceContacts = deviceContacts
    .map((contact) => ({ ...contact, hasApp: false }))
    .filter((contact) => {
      const normalizedPhones = (contact.phoneNumbers ?? [contact.phone])
        .map(normalizePhone)
        .filter((phone): phone is string => Boolean(phone));
      return !normalizedPhones.some((phone) => systemPhones.has(phone));
    });

  return [...systemContacts, ...unmatchedDeviceContacts] as T[];
}