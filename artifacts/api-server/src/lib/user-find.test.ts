import assert from "node:assert/strict";
import test from "node:test";
import {
  phoneLookupCandidates,
  storedPhoneMatchesLookup,
} from "./phone-number";
import { planUserFind } from "./user-find";

const E164 = "+14155550100";
const NATIONAL = "4155550100";

test("E.164 phone query matches a legacy national stored phone", () => {
  const lookup = phoneLookupCandidates(E164);
  assert.ok(lookup);
  assert.ok(lookup.exact.includes(E164), "raw query");
  assert.ok(lookup.digits.includes("14155550100"), "digit-only");
  assert.ok(lookup.digits.includes(NATIONAL), "US national digits");
  assert.ok(lookup.exact.includes(E164));

  for (const stored of [
    E164,
    NATIONAL,
    "14155550100",
    "(415) 555-0100",
    "+1 415-555-0100",
  ]) {
    assert.equal(storedPhoneMatchesLookup(stored, lookup), true, stored);
  }
  assert.equal(storedPhoneMatchesLookup("4155550101", lookup), false);
  assert.equal(storedPhoneMatchesLookup(null, lookup), false);
  assert.equal(storedPhoneMatchesLookup("", lookup), false);
});

test("legacy national query matches an E.164 stored phone", () => {
  const lookup = phoneLookupCandidates(NATIONAL);
  assert.ok(lookup);
  assert.ok(lookup.exact.includes(NATIONAL));
  assert.ok(lookup.exact.includes(E164));
  assert.equal(storedPhoneMatchesLookup(E164, lookup), true);
  assert.equal(storedPhoneMatchesLookup("(415) 555-0100", lookup), true);
});

test("formatted and space-padded queries still reach the national row", () => {
  const formatted = phoneLookupCandidates("(415) 555-0100");
  assert.ok(formatted);
  assert.ok(formatted.exact.includes("(415) 555-0100"));
  assert.equal(storedPhoneMatchesLookup(NATIONAL, formatted), true);
  assert.equal(storedPhoneMatchesLookup(E164, formatted), true);

  const padded = phoneLookupCandidates(" +14155550100 ");
  assert.ok(padded);
  assert.ok(padded.exact.includes(" +14155550100 "), "raw query is kept");
  assert.ok(padded.exact.includes(E164));
  assert.equal(storedPhoneMatchesLookup(NATIONAL, padded), true);

  // A query string where '+' was decoded as a space still matches national storage.
  const plusLost = phoneLookupCandidates(" 14155550100");
  assert.ok(plusLost);
  assert.equal(storedPhoneMatchesLookup(NATIONAL, plusLost), true);
  assert.equal(storedPhoneMatchesLookup(E164, plusLost), true);
});

test("non-US E.164 does not collapse to a US national number", () => {
  const lookup = phoneLookupCandidates("+442079460958");
  assert.ok(lookup);
  assert.ok(lookup.exact.includes("+442079460958"));
  assert.ok(lookup.digits.includes("442079460958"));
  assert.equal(lookup.digits.includes("2079460958"), false);
  assert.equal(storedPhoneMatchesLookup(NATIONAL, lookup), false);
  assert.equal(storedPhoneMatchesLookup("020 7946 0958", lookup), false);
});

test("explicit country code still parses a national number", () => {
  const lookup = phoneLookupCandidates("020 7946 0958", "GB");
  assert.ok(lookup);
  assert.ok(lookup.exact.includes("+442079460958"));
  assert.equal(storedPhoneMatchesLookup("+442079460958", lookup), true);
  assert.equal(storedPhoneMatchesLookup("02079460958", lookup), true);
});

test("unparseable phone queries stay on exact match", () => {
  assert.equal(phoneLookupCandidates("12"), null);
  assert.equal(phoneLookupCandidates(""), null);
  assert.equal(phoneLookupCandidates(undefined), null);
  assert.equal(phoneLookupCandidates("1".repeat(16)), null);

  const plan = planUserFind({ phone: "12", username: "someone" });
  assert.deepEqual(plan, { kind: "phone-exact", phone: "12" });
});

test("username and q plans are unchanged and lose to phone", () => {
  assert.deepEqual(planUserFind({ username: "Designed" }), {
    kind: "username",
    pattern: "Designed%",
  });
  assert.deepEqual(planUserFind({ q: "Kris" }), {
    kind: "q",
    pattern: "%Kris%",
  });
  assert.deepEqual(planUserFind({}), { kind: "none" });
  assert.deepEqual(planUserFind({ phone: "", username: "ada" }), {
    kind: "username",
    pattern: "ada%",
  });
  assert.deepEqual(planUserFind({ username: "", q: "ada" }), {
    kind: "q",
    pattern: "%ada%",
  });

  const phonePlan = planUserFind({ phone: E164, username: "other", q: "nope" });
  assert.equal(phonePlan.kind, "phone");
  if (phonePlan.kind !== "phone") return;
  assert.equal(storedPhoneMatchesLookup(NATIONAL, phonePlan.lookup), true);
  assert.equal(storedPhoneMatchesLookup(E164, phonePlan.lookup), true);
});
