import assert from "node:assert/strict";
import test from "node:test";
import { mergeSyncedContacts } from "./contact-sync.ts";

type TestContact = {
  id: string;
  name: string;
  phone?: string;
  phoneNumbers?: string[];
  hasApp?: boolean;
};

test("keeps the registered entry when its formatted phone matches an unformatted device phone", () => {
  const registered: TestContact = {
    id: "registered-1",
    name: "Registered Friend",
    phone: "+1 (415) 555-0123",
  };
  const deviceDuplicate: TestContact = {
    id: "synced_1",
    name: "Phone Address Book Friend",
    phone: "14155550123",
  };

  const merged = mergeSyncedContacts([registered], [deviceDuplicate]);

  assert.deepEqual(merged, [{ ...registered, hasApp: true }]);
});

test("keeps the registered entry when its unformatted phone matches a formatted device phone", () => {
  const registered: TestContact = {
    id: "registered-2",
    name: "Registered Relative",
    phone: "442079460123",
  };
  const deviceDuplicate: TestContact = {
    id: "synced_2",
    name: "Phone Address Book Relative",
    phone: "+44 20 7946 0123",
  };

  const merged = mergeSyncedContacts([registered], [deviceDuplicate]);

  assert.deepEqual(merged, [{ ...registered, hasApp: true }]);
});

test("retains unmatched device contacts and marks them as not registered", () => {
  const registered: TestContact = {
    id: "registered-3",
    name: "ZIVR User",
    phone: "+1 212 555 0100",
  };
  const unmatchedDeviceContact: TestContact = {
    id: "synced_3",
    name: "Invite Candidate",
    phone: "(646) 555-0199",
  };

  const merged = mergeSyncedContacts([registered], [unmatchedDeviceContact]);

  assert.deepEqual(merged, [
    { ...registered, hasApp: true },
    { ...unmatchedDeviceContact, hasApp: false },
  ]);
});

test("keeps the registered entry when a later device phone number matches", () => {
  const registered: TestContact = {
    id: "registered-4",
    name: "Registered Parent",
    phone: "+1 415 555 0123",
  };
  const deviceDuplicate: TestContact = {
    id: "synced_4",
    name: "Address Book Parent",
    phone: "+1 650 555 0199",
    phoneNumbers: ["+1 650 555 0199", "1 (415) 555-0123"],
  };

  const merged = mergeSyncedContacts([registered], [deviceDuplicate]);

  assert.deepEqual(merged, [{ ...registered, hasApp: true }]);
});

test("retains the first useful phone number for an unmatched device contact", () => {
  const deviceContact: TestContact = {
    id: "synced_5",
    name: "Invite Candidate",
    phone: "+1 650 555 0100",
    phoneNumbers: ["+1 650 555 0100", "+1 650 555 0101"],
  };

  const merged = mergeSyncedContacts([], [deviceContact]);

  assert.deepEqual(merged, [{ ...deviceContact, hasApp: false }]);
  assert.equal(merged[0].phone, "+1 650 555 0100");
});
