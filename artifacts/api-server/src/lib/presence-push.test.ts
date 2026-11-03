import assert from "node:assert/strict";
import test from "node:test";
import {
  PUSH_TOKENS_FOR_CHAT_SQL,
  USER_AWAY_EVENT,
  accountIsOnline,
  foregroundUserIds,
  selectPushTokens,
  type PushMember,
  type PushSelectionContext,
} from "./presence-push.ts";

const TOKEN = "ExponentPushToken[kristina]";
const NOW = 1_700_000_000_000;

function member(overrides: Partial<PushMember> = {}): PushMember {
  return {
    pushToken: TOKEN,
    isOnline: true,
    lastSeen: NOW,
    ...overrides,
  };
}

function ctx(overrides: Partial<PushSelectionContext> = {}): PushSelectionContext {
  return { busHealthy: true, now: NOW, ...overrides };
}

test("user:away is the background presence event", () => {
  assert.equal(USER_AWAY_EVENT, "user:away");
});

test("push token query does not skip online or fresh presence", () => {
  const where = PUSH_TOKENS_FOR_CHAT_SQL.slice(PUSH_TOKENS_FOR_CHAT_SQL.toLowerCase().indexOf("where"));
  assert.match(where, /cm\.user_id != \$2/);
  assert.doesNotMatch(where, /is_online/);
  assert.doesNotMatch(where, /last_seen/);
  assert.doesNotMatch(where, /\$3/);
  assert.doesNotMatch(where, /\$4/);
  assert.match(PUSH_TOKENS_FOR_CHAT_SQL, /u\.push_token/);
});

test("online fresh presence on a healthy bus still gets a push", () => {
  const tokens = selectPushTokens([member({ isOnline: true, lastSeen: NOW })], ctx({ busHealthy: true }));
  assert.deepEqual(tokens, [TOKEN]);
});

test("there is no grace window after last_seen where push is withheld", () => {
  for (const ageMs of [0, 10_000, 45_000, 60_000, 3 * 60 * 1000]) {
    const tokens = selectPushTokens(
      [member({ isOnline: true, lastSeen: NOW - ageMs })],
      ctx({ busHealthy: true, now: NOW }),
    );
    assert.deepEqual(tokens, [TOKEN], `age ${ageMs}`);
  }
});

test("offline, stale, and an unhealthy bus all include the token", () => {
  const offline = selectPushTokens([member({ isOnline: false, lastSeen: NOW })], ctx());
  const stale = selectPushTokens(
    [member({ isOnline: true, lastSeen: NOW - 60 * 60 * 1000 })],
    ctx(),
  );
  const nullSeen = selectPushTokens([member({ isOnline: true, lastSeen: null })], ctx());
  const unhealthy = selectPushTokens(
    [member({ isOnline: true, lastSeen: NOW })],
    ctx({ busHealthy: false }),
  );
  assert.deepEqual(offline, [TOKEN]);
  assert.deepEqual(stale, [TOKEN]);
  assert.deepEqual(nullSeen, [TOKEN]);
  assert.deepEqual(unhealthy, [TOKEN]);
});

test("missing and non-Expo tokens are dropped", () => {
  const tokens = selectPushTokens(
    [
      member({ pushToken: null }),
      member({ pushToken: "" }),
      member({ pushToken: "fcm-token" }),
      member({ pushToken: TOKEN, isOnline: false, lastSeen: 0 }),
    ],
    ctx({ busHealthy: false }),
  );
  assert.deepEqual(tokens, [TOKEN]);
});

test("foreground heartbeat ids ignore away sockets", () => {
  assert.deepEqual(
    foregroundUserIds([
      { userId: "away-user", presence: "away" },
      { userId: "active-user", presence: "active" },
      { userId: "legacy-user" },
      { presence: "active" },
      { userId: "active-user", presence: "active" },
    ]),
    ["active-user", "legacy-user"],
  );
});

test("account stays online only while a foreground socket remains", () => {
  assert.equal(accountIsOnline([]), false);
  assert.equal(accountIsOnline(["away"]), false);
  assert.equal(accountIsOnline(["away", "away"]), false);
  assert.equal(accountIsOnline(["active"]), true);
  assert.equal(accountIsOnline(["away", "active"]), true);
});
