export type InviteableContact = {
  id: string;
  name: string;
  phone?: string;
  hasApp?: boolean;
};

export function getInviteContacts<T extends InviteableContact>(
  contacts: T[],
  search: string,
): { phoneContacts: T[]; filteredContacts: T[] } {
  const phoneContacts = contacts.filter(
    (contact) => contact.id !== "me" && Boolean(contact.phone) && contact.hasApp !== true,
  );
  const normalizedSearch = search.toLowerCase();
  const filteredContacts = phoneContacts.filter((contact) =>
    contact.name.toLowerCase().includes(normalizedSearch),
  );

  return { phoneContacts, filteredContacts };
}

export function getInviteEmptyMessage(phoneContactCount: number): string {
  return phoneContactCount === 0
    ? "All your contacts with a phone number are already on ZIVR!"
    : "No matching contacts";
}