export type SyncableContact = {
  id: string;
  phone?: string;
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
      const normalizedPhone = normalizePhone(contact.phone);
      return !normalizedPhone || !systemPhones.has(normalizedPhone);
    });

  return [...systemContacts, ...unmatchedDeviceContacts] as T[];
}