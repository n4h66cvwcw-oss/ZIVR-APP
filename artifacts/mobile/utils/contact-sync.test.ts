import assert from "node:assert/strict";
import test from "node:test";
import { mergeSyncedContacts } from "./contact-sync.ts";
import type { CountryCode } from "libphonenumber-js";

type TestContact = {
  id: string;
  name: string;
  phone?: string;
  phoneNumbers?: string[];
  phoneRegion?: CountryCode;
  phoneNumberRegions?: Array<CountryCode | undefined>;
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

test("keeps only the first device contact when normalized phone numbers overlap", () => {
  const firstDeviceContact: TestContact = {
    id: "synced_6",
    name: "First Address Book Entry",
    phone: "+1 (650) 555-0100",
    phoneNumbers: ["+1 (650) 555-0100", "+1 650 555 0101"],
  };
  const duplicateDeviceContact: TestContact = {
    id: "synced_7",
    name: "Duplicate Address Book Entry",
    phone: "16505550101",
  };

  const merged = mergeSyncedContacts([], [
    firstDeviceContact,
    duplicateDeviceContact,
  ]);

  assert.deepEqual(merged, [{ ...firstDeviceContact, hasApp: false }]);
});

test("keeps separate device contacts that have no phone numbers", () => {
  const firstNumberlessContact: TestContact = {
    id: "synced_8",
    name: "First Numberless Contact",
  };
  const secondNumberlessContact: TestContact = {
    id: "synced_9",
    name: "Second Numberless Contact",
    phoneNumbers: [],
  };

  const merged = mergeSyncedContacts([], [
    firstNumberlessContact,
    secondNumberlessContact,
  ]);

  assert.deepEqual(merged, [
    { ...firstNumberlessContact, hasApp: false },
    { ...secondNumberlessContact, hasApp: false },
  ]);
});

test("deduplicates device contacts connected through another duplicate", () => {
  const firstDeviceContact: TestContact = {
    id: "synced_10",
    name: "First Entry",
    phoneNumbers: ["111-111-1111", "222-222-2222"],
  };
  const bridgingDuplicate: TestContact = {
    id: "synced_11",
    name: "Bridging Duplicate",
    phoneNumbers: ["2222222222", "333-333-3333"],
  };
  const laterDuplicate: TestContact = {
    id: "synced_12",
    name: "Later Duplicate",
    phone: "3333333333",
  };

  const merged = mergeSyncedContacts([], [
    firstDeviceContact,
    bridgingDuplicate,
    laterDuplicate,
  ]);

  assert.deepEqual(merged, [{ ...firstDeviceContact, hasApp: false }]);
});

test("registered contacts take priority across all numbers on a device duplicate", () => {
  const registered: TestContact = {
    id: "registered-5",
    name: "Registered Friend",
    phone: "1111111111",
  };
  const matchingDeviceContact: TestContact = {
    id: "synced_13",
    name: "Registered Friend in Address Book",
    phoneNumbers: ["111-111-1111", "222-222-2222"],
  };
  const aliasDeviceContact: TestContact = {
    id: "synced_14",
    name: "Registered Friend Alias",
    phone: "2222222222",
  };

  const merged = mergeSyncedContacts(
    [registered],
    [matchingDeviceContact, aliasDeviceContact],
  );

  assert.deepEqual(merged, [{ ...registered, hasApp: true }]);
});

test("matches a US local device number to the same international number", () => {
  const registered: TestContact = {
    id: "registered-6",
    name: "International Entry",
    phone: "+1 415 555 0123",
  };
  const localDeviceContact: TestContact = {
    id: "synced_15",
    name: "Local Entry",
    phone: "(415) 555-0123",
    phoneRegion: "US",
  };

  const merged = mergeSyncedContacts([registered], [localDeviceContact]);

  assert.deepEqual(merged, [{ ...registered, hasApp: true }]);
});

test("matches a UK local device number when its per-number region is known", () => {
  const registered: TestContact = {
    id: "registered-7",
    name: "International Relative",
    phone: "+44 20 7946 0123",
  };
  const localDeviceContact: TestContact = {
    id: "synced_16",
    name: "Local Relative",
    phoneNumbers: ["020 7946 0123"],
    phoneNumberRegions: ["GB"],
  };

  const merged = mergeSyncedContacts([registered], [localDeviceContact]);

  assert.deepEqual(merged, [{ ...registered, hasApp: true }]);
});

test("does not merge the same local digits from different regions", () => {
  const usContact: TestContact = {
    id: "synced_17",
    name: "US Contact",
    phone: "020 7946 0123",
    phoneRegion: "US",
  };
  const ukContact: TestContact = {
    id: "synced_18",
    name: "UK Contact",
    phone: "020 7946 0123",
    phoneRegion: "GB",
  };

  const merged = mergeSyncedContacts([], [usContact, ukContact]);

  assert.deepEqual(merged, [
    { ...usContact, hasApp: false },
    { ...ukContact, hasApp: false },
  ]);
});

test("does not infer a country code when no region is available", () => {
  const registered: TestContact = {
    id: "registered-8",
    name: "International Entry",
    phone: "+1 415 555 0123",
  };
  const ambiguousLocalContact: TestContact = {
    id: "synced_19",
    name: "Ambiguous Local Entry",
    phone: "415 555 0123",
  };

  const merged = mergeSyncedContacts([registered], [ambiguousLocalContact]);

  assert.deepEqual(merged, [
    { ...registered, hasApp: true },
    { ...ambiguousLocalContact, hasApp: false },
  ]);
});
