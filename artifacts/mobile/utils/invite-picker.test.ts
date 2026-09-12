import assert from "node:assert/strict";
import test from "node:test";
import {
  getInviteContacts,
  getInviteEmptyMessage,
  type InviteableContact,
} from "./invite-picker.ts";

test("excludes existing ZIVR users while keeping inviteable phone contacts", () => {
  const contacts: InviteableContact[] = [
    { id: "me", name: "Me", phone: "+1 555 0000", hasApp: false },
    { id: "existing", name: "Existing User", phone: "+1 555 0001", hasApp: true },
    { id: "not-registered", name: "New Contact", phone: "+1 555 0002", hasApp: false },
    { id: "unknown", name: "Unknown Contact", phone: "+1 555 0003" },
    { id: "no-phone", name: "Email Only", hasApp: false },
  ];

  const { phoneContacts, filteredContacts } = getInviteContacts(contacts, "");

  assert.deepEqual(
    phoneContacts.map((contact) => contact.id),
    ["not-registered", "unknown"],
  );
  assert.deepEqual(filteredContacts, phoneContacts);
});

test("shows the all-on-ZIVR empty state when no phone contact can be invited", () => {
  const contacts: InviteableContact[] = [
    { id: "existing", name: "Existing User", phone: "+1 555 0001", hasApp: true },
    { id: "no-phone", name: "Email Only", hasApp: false },
  ];

  const { phoneContacts, filteredContacts } = getInviteContacts(contacts, "");

  assert.equal(phoneContacts.length, 0);
  assert.equal(filteredContacts.length, 0);
  assert.equal(
    getInviteEmptyMessage(phoneContacts.length),
    "All your contacts with a phone number are already on ZIVR!",
  );
});

test("shows the no-match empty state when search hides inviteable contacts", () => {
  const contacts: InviteableContact[] = [
    { id: "inviteable", name: "Invite Candidate", phone: "+1 555 0002" },
  ];

  const { phoneContacts, filteredContacts } = getInviteContacts(contacts, "missing");

  assert.equal(phoneContacts.length, 1);
  assert.equal(filteredContacts.length, 0);
  assert.equal(getInviteEmptyMessage(phoneContacts.length), "No matching contacts");
});