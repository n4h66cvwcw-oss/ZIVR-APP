import assert from "node:assert/strict";
import test from "node:test";
import { AGENT_FIND_EXCLUSION } from "./user-find.ts";
import {
  calendarProposeEnabled,
  canDecideProposal,
  chatAllowsAgent,
  nextProposalStatus,
  ownerMayCreateSubProfile,
  proposalDecisionText,
  proposalSummary,
  rateLimitDecision,
  AGENT_MESSAGES_PER_DAY,
  AGENT_MESSAGES_PER_MINUTE,
  AGENT_MEDIA_PER_DAY,
} from "./agent-policy.ts";
import { calendarProposalCard } from "./message-content.ts";

const owner = "11111111-1111-4111-8111-111111111111";
const admin = "22222222-2222-4222-8222-222222222222";
const member = "33333333-3333-4333-8333-333333333333";

test("calendar propose is on unless the flag explicitly disables it", () => {
  assert.equal(calendarProposeEnabled({}), true);
  assert.equal(calendarProposeEnabled({ AGENT_CALENDAR_PROPOSE: "" }), true);
  assert.equal(calendarProposeEnabled({ AGENT_CALENDAR_PROPOSE: "1" }), true);
  assert.equal(calendarProposeEnabled({ AGENT_CALENDAR_PROPOSE: "true" }), true);
  assert.equal(calendarProposeEnabled({ AGENT_CALENDAR_PROPOSE: "0" }), false);
  assert.equal(calendarProposeEnabled({ AGENT_CALENDAR_PROPOSE: "false" }), false);
  assert.equal(calendarProposeEnabled({ AGENT_CALENDAR_PROPOSE: "off" }), false);
});

test("yes and no are a single owner or chat-admin tap, not a tally", () => {
  assert.deepEqual(canDecideProposal({
    callerId: owner,
    callerAccountType: "standard",
    callerSupervised: false,
    ownerUserId: owner,
    chatCreatedBy: admin,
  }), { ok: true, role: "owner" });
  assert.deepEqual(canDecideProposal({
    callerId: admin,
    callerAccountType: "parent",
    callerSupervised: false,
    ownerUserId: owner,
    chatCreatedBy: admin,
  }), { ok: true, role: "admin" });

  const stranger = canDecideProposal({
    callerId: member,
    callerAccountType: "standard",
    callerSupervised: false,
    ownerUserId: owner,
    chatCreatedBy: admin,
  });
  assert.equal(stranger.ok, false);

  const agent = canDecideProposal({
    callerId: owner,
    callerAccountType: "agent",
    callerSupervised: false,
    ownerUserId: owner,
    chatCreatedBy: admin,
  });
  assert.equal(agent.ok, false);

  const child = canDecideProposal({
    callerId: admin,
    callerAccountType: "child",
    callerSupervised: true,
    ownerUserId: owner,
    chatCreatedBy: admin,
  });
  assert.equal(child.ok, false);

  const yes = nextProposalStatus("pending", "yes");
  const no = nextProposalStatus("pending", "no");
  assert.equal(yes.ok, true);
  assert.equal(no.ok, true);
  if (yes.ok) assert.equal(yes.status, "approved");
  if (no.ok) assert.equal(no.status, "declined");
  const flip = nextProposalStatus("approved", "no");
  assert.equal(flip.ok, false);
  const same = nextProposalStatus("declined", "no");
  assert.equal(same.ok, true);
  if (same.ok) assert.equal(same.idempotent, true);
});

test("proposal cards do not carry a vote tally", () => {
  const card = calendarProposalCard({
    proposalId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    title: "Lunch",
    startsAt: 1_800_000_000_000,
    endsAt: 1_800_003_600_000,
    status: "pending",
    note: "near the office",
  });
  assert.equal(card.approval, "owner_or_admin");
  assert.equal(card.kind, "calendar_proposal");
  const json = JSON.stringify(card);
  assert.equal(json.includes("votes"), false);
  assert.equal(json.includes("quorum"), false);
  assert.equal(json.includes("tally"), false);
  assert.match(proposalSummary("Lunch", card.startsAt, card.endsAt), /Yes adds this/);
  assert.match(proposalDecisionText({
    decision: "no",
    title: "Lunch",
    actorName: "Jay",
    calendarWrite: "dismissed",
  }), /dismissed/);
  assert.match(proposalDecisionText({
    decision: "yes",
    title: "Lunch",
    actorName: "Jay",
    calendarWrite: "pending_oauth",
  }), /main calendar/);
});

test("kids cannot own agents and agents stay out of e2e and kid chats", () => {
  assert.equal(ownerMayCreateSubProfile({ accountType: "child", supervised: true }).ok, false);
  assert.equal(ownerMayCreateSubProfile({ accountType: "standard", supervised: true }).ok, false);
  assert.equal(ownerMayCreateSubProfile({ accountType: "agent", supervised: false }).ok, false);
  assert.equal(ownerMayCreateSubProfile({ accountType: "parent", supervised: false }).ok, true);
  assert.equal(chatAllowsAgent({ isE2e: true, hasE2eMessage: false, hasChild: false }).ok, false);
  assert.equal(chatAllowsAgent({ isE2e: false, hasE2eMessage: true, hasChild: false }).ok, false);
  assert.equal(chatAllowsAgent({ isE2e: false, hasE2eMessage: false, hasChild: true }).ok, false);
  assert.equal(chatAllowsAgent({ isE2e: false, hasE2eMessage: false, hasChild: false }).ok, true);
});

test("rate limits use the v1 caps", () => {
  const now = Date.UTC(2026, 10, 3, 12, 0, 0);
  assert.equal(rateLimitDecision({
    sentLastMinute: AGENT_MESSAGES_PER_MINUTE,
    sentToday: 0,
    mediaToday: 0,
    isMedia: false,
    now,
  }).ok, false);
  const daily = rateLimitDecision({
    sentLastMinute: 0,
    sentToday: AGENT_MESSAGES_PER_DAY,
    mediaToday: 0,
    isMedia: false,
    now,
  });
  assert.equal(daily.ok, false);
  if (!daily.ok) assert.ok((daily.retryAfter ?? 0) > 0);
  assert.equal(rateLimitDecision({
    sentLastMinute: 0,
    sentToday: 1,
    mediaToday: AGENT_MEDIA_PER_DAY,
    isMedia: true,
    now,
  }).ok, false);
  assert.equal(rateLimitDecision({
    sentLastMinute: 0,
    sentToday: 1,
    mediaToday: AGENT_MEDIA_PER_DAY,
    isMedia: false,
    now,
  }).ok, true);
});

test("public find queries exclude agent accounts", () => {
  assert.equal(AGENT_FIND_EXCLUSION, "COALESCE(account_type, '') <> 'agent'");
});
