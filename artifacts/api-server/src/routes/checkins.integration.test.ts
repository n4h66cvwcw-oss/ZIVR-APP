import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import test from "node:test";
import { Pool } from "pg";

type Fixture = {
  creatorId: string;
  memberOneId: string;
  memberTwoId: string;
  outsiderId: string;
};

const runId = `checkin-${crypto.randomUUID().slice(0, 8)}`;
const schemaName = `checkin_test_${crypto.randomUUID().replaceAll("-", "")}`;
const originalDatabaseUrl = process.env["DATABASE_URL"];
assert.ok(originalDatabaseUrl, "DATABASE_URL is required for check-in integration tests");
const adminPool = new Pool({ connectionString: originalDatabaseUrl });
let baseUrl = "";
let server: http.Server;
let dbPool: typeof import("../lib/db.ts").default;
let query: typeof import("../lib/db.ts").query;
let queryOne: typeof import("../lib/db.ts").queryOne;
let signToken: typeof import("../lib/auth.ts").signToken;
let userIds: string[] = [];

async function createUser(label: string) {
  const name = `${runId}-${label}-${crypto.randomUUID().slice(0, 4)}`;
  const row = await queryOne<{ id: string }>(
    `INSERT INTO vm_users (display_name, username) VALUES ($1, $2) RETURNING id`,
    [name, name],
  );
  assert.ok(row);
  userIds.push(row.id);
  return row.id;
}

async function api(method: string, path: string, userId: string, body?: Record<string, unknown>) {
  return fetch(`${baseUrl}/api/checkins${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-auth-token": signToken(userId),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function fixture(): Promise<Fixture> {
  return {
    creatorId: await createUser("creator"),
    memberOneId: await createUser("member-one"),
    memberTwoId: await createUser("member-two"),
    outsiderId: await createUser("outsider"),
  };
}

test.before(async () => {
  await adminPool.query(`CREATE SCHEMA "${schemaName}"`);
  const isolatedUrl = new URL(originalDatabaseUrl);
  isolatedUrl.searchParams.set("options", `-c search_path=${schemaName}`);
  process.env["DATABASE_URL"] = isolatedUrl.toString();

  const [appModule, dbModule, authModule, migrateModule] = await Promise.all([
    import("../app.ts"),
    import("../lib/db.ts"),
    import("../lib/auth.ts"),
    import("../lib/migrate.ts"),
  ]);
  dbPool = dbModule.default;
  query = dbModule.query;
  queryOne = dbModule.queryOne;
  signToken = authModule.signToken;
  await migrateModule.migrate();

  server = http.createServer(appModule.default);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  if (userIds.length) await query(`DELETE FROM vm_users WHERE id = ANY($1::uuid[])`, [userIds]);
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await dbPool.end();
  await adminPool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
  await adminPool.end();
});

test("check-in REST authorization, idempotency, privacy, and progress", async () => {
  const users = await fixture();
  const groupResponse = await api("POST", "/groups", users.creatorId, {
    name: `${runId}-group`,
    memberIds: [users.memberOneId, users.memberTwoId],
    anonymous: true,
  });
  assert.equal(groupResponse.status, 201);
  const group = (await groupResponse.json() as { group: { id: string } }).group;

  assert.equal((await api("GET", `/groups/${group.id}`, users.outsiderId)).status, 403);
  assert.equal(
    (await api("POST", `/groups/${group.id}/broadcasts`, users.memberOneId, { text: "not allowed" })).status,
    403,
  );

  const firstBroadcast = await api("POST", `/groups/${group.id}/broadcasts`, users.creatorId, {
    text: "status?",
    clientId: "broadcast-retry-1",
  });
  assert.equal(firstBroadcast.status, 201);
  const first = (await firstBroadcast.json() as { broadcast: { id: string } }).broadcast;
  const duplicateBroadcast = await api("POST", `/groups/${group.id}/broadcasts`, users.creatorId, {
    text: "status?",
    clientId: "broadcast-retry-1",
  });
  assert.equal(duplicateBroadcast.status, 200);
  assert.equal(
    (await duplicateBroadcast.json() as { broadcast: { id: string } }).broadcast.id,
    first.id,
  );
  const broadcastCount = await queryOne<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM vm_broadcasts WHERE id = $1`, [first.id],
  );
  assert.equal(broadcastCount?.count, 1);

  assert.equal((await api("GET", `/broadcasts/${first.id}`, users.outsiderId)).status, 403);
  assert.equal((await api("POST", `/broadcasts/${first.id}/replies`, users.outsiderId, { text: "outsider" })).status, 403);
  assert.equal((await api("POST", `/broadcasts/${first.id}/replies`, users.creatorId, { text: "creator" })).status, 403);

  const memberOneReply = await api("POST", `/broadcasts/${first.id}/replies`, users.memberOneId, {
    text: "here",
    clientId: "reply-retry-1",
  });
  assert.equal(memberOneReply.status, 201);
  const duplicateReply = await api("POST", `/broadcasts/${first.id}/replies`, users.memberOneId, {
    text: "here",
    clientId: "reply-retry-1",
  });
  assert.equal(duplicateReply.status, 200);
  const replyCount = await queryOne<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM vm_checkin_replies WHERE broadcast_id = $1 AND member_id = $2`,
    [first.id, users.memberOneId],
  );
  assert.equal(replyCount?.count, 1);

  // A second legitimate reply from the same member must not count as a
  // second distinct responder.
  const secondMemberOneReply = await api("POST", `/broadcasts/${first.id}/replies`, users.memberOneId, {
    text: "still here",
    clientId: "reply-retry-2",
  });
  assert.equal(secondMemberOneReply.status, 201);
  const oneMemberProgress = await api("GET", `/broadcasts/${first.id}`, users.creatorId);
  assert.deepEqual(
    (await oneMemberProgress.json() as { broadcast: { progress: { total: number; replied: number } } }).broadcast.progress,
    { total: 2, replied: 1 },
  );

  const memberTwoReply = await api("POST", `/broadcasts/${first.id}/replies`, users.memberTwoId, { text: "also here" });
  assert.equal(memberTwoReply.status, 201);

  const creatorView = await api("GET", `/broadcasts/${first.id}`, users.creatorId);
  const creatorBroadcast = (await creatorView.json() as {
    broadcast: { replies: Record<string, unknown[]>; progress: { total: number; replied: number } };
  }).broadcast;
  assert.equal(Object.keys(creatorBroadcast.replies).length, 2);
  assert.deepEqual(creatorBroadcast.progress, { total: 2, replied: 2 });

  const memberView = await api("GET", `/broadcasts/${first.id}`, users.memberOneId);
  const memberBroadcast = (await memberView.json() as {
    broadcast: { replies: Record<string, unknown[]> };
  }).broadcast;
  assert.deepEqual(Object.keys(memberBroadcast.replies), [users.memberOneId]);
  assert.equal(memberBroadcast.replies[users.memberTwoId], undefined);
});