import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import test from "node:test";
import { Pool } from "pg";

const runId = `sp-${crypto.randomUUID().slice(0, 8)}`;
const schemaName = `subprofile_test_${crypto.randomUUID().replaceAll("-", "")}`;
const originalDatabaseUrl = process.env["DATABASE_URL"];
assert.ok(originalDatabaseUrl, "DATABASE_URL is required for sub-profile integration tests");
const adminPool = new Pool({ connectionString: originalDatabaseUrl });

let baseUrl = "";
let server: http.Server;
let app: typeof import("../app.ts").default;
let dbPool: typeof import("../lib/db.ts").default;
let query: typeof import("../lib/db.ts").query;
let queryOne: typeof import("../lib/db.ts").queryOne;
let signToken: typeof import("../lib/auth.ts").signToken;
const userIds: string[] = [];

const TINY_PDF = "data:application/pdf;base64,JVBERi0xLjEKJcKlwrE=";

async function createUser(label: string, accountType = "standard") {
  const uniqueName = `${runId}-${label}-${crypto.randomUUID().slice(0, 4)}`;
  const row = await queryOne<{ id: string }>(
    `INSERT INTO vm_users (display_name, username, account_type, token_claimed)
     VALUES ($1, $2, $3, true) RETURNING id`,
    [uniqueName, uniqueName, accountType],
  );
  assert.ok(row);
  userIds.push(row.id);
  return { id: row.id, name: uniqueName };
}

async function api(method: string, path: string, init: { token?: string; bearer?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers["content-type"] = "application/json";
  if (init.token) headers["x-auth-token"] = init.token;
  if (init.bearer) headers["authorization"] = `Bearer ${init.bearer}`;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await response.text();
  let json: unknown = null;
  if (text) {
    try { json = JSON.parse(text) as unknown; } catch { json = text; }
  }
  return { status: response.status, json, text };
}

test.before(async () => {
  await adminPool.query(`CREATE SCHEMA "${schemaName}"`);
  const isolatedUrl = new URL(originalDatabaseUrl);
  isolatedUrl.searchParams.set("options", `-c search_path=${schemaName}`);
  process.env["DATABASE_URL"] = isolatedUrl.toString();
  process.env["SESSION_SECRET"] ??= "unit-test-session-secret";

  const [appModule, dbModule, authModule, migrateModule] = await Promise.all([
    import("../app.ts"),
    import("../lib/db.ts"),
    import("../lib/auth.ts"),
    import("../lib/migrate.ts"),
  ]);
  app = appModule.default;
  dbPool = dbModule.default;
  query = dbModule.query;
  queryOne = dbModule.queryOne;
  signToken = authModule.signToken;
  await migrateModule.migrate();
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  if (userIds.length) {
    await query(`DELETE FROM vm_users WHERE id = ANY($1::uuid[]) OR owner_user_id = ANY($1::uuid[])`, [userIds]);
  }
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await dbPool.end();
  await adminPool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
  await adminPool.end();
});

test("sub-profiles, agent send, and calendar yes/no", async () => {
  const owner = await createUser("owner");
  const friend = await createUser("friend");
  const child = await createUser("child", "child");
  const outsider = await createUser("outsider");
  await query(`INSERT INTO vm_parent_child (parent_id, child_id) VALUES ($1, $2)`, [owner.id, child.id]);
  const ownerToken = signToken(owner.id);
  const friendToken = signToken(friend.id);
  const childToken = signToken(child.id);

  const kidCreate = await api("POST", "/api/v1/sub-profiles", {
    token: childToken,
    body: { displayName: "Kid bot", profileMode: "persona" },
  });
  assert.equal(kidCreate.status, 403);
  assert.equal((kidCreate.json as { code?: string }).code, "kids");

  const persona = await api("POST", "/api/v1/sub-profiles", {
    token: ownerToken,
    body: { displayName: "Jay Persona", profileMode: "persona" },
  });
  assert.equal(persona.status, 201);
  const personaId = (persona.json as { subProfile: { id: string; profileMode: string; assistantLabel: string } }).subProfile.id;
  assert.equal((persona.json as { subProfile: { profileMode: string } }).subProfile.profileMode, "persona");
  assert.match((persona.json as { subProfile: { assistantLabel: string } }).subProfile.assistantLabel, /assistant/);
  userIds.push(personaId);

  const personaKey = await api("POST", `/api/v1/sub-profiles/${personaId}/keys`, { token: ownerToken, body: {} });
  assert.equal(personaKey.status, 403);

  const direct = await api("POST", "/api/chats/direct", {
    token: ownerToken,
    body: { myUserId: owner.id, theirUserId: friend.id },
  });
  assert.equal(direct.status, 200);
  const chatId = (direct.json as { chatId: string }).chatId;

  const personaSend = await api("POST", `/api/v1/sub-profiles/${personaId}/messages`, {
    token: ownerToken,
    body: { chatId, text: "from the persona", clientId: `persona-${runId}` },
  });
  assert.equal(personaSend.status, 200);
  assert.equal((personaSend.json as { message: { senderId: string } }).message.senderId, personaId);

  const upgraded = await api("POST", `/api/v1/sub-profiles/${personaId}/upgrade`, {
    token: ownerToken,
    body: { provider: "claude" },
  });
  assert.equal(upgraded.status, 200);
  assert.equal((upgraded.json as { subProfile: { profileMode: string; provider: string } }).subProfile.profileMode, "agent");

  const minted = await api("POST", `/api/v1/sub-profiles/${personaId}/keys`, { token: ownerToken, body: {} });
  assert.equal(minted.status, 201);
  const apiKey = (minted.json as { key: string; credential: { id: string; scopes: string[] } }).key;
  assert.equal(apiKey.startsWith("zivr_agent_"), true);
  assert.ok((minted.json as { credential: { scopes: string[] } }).credential.scopes.includes("calendar:propose"));
  assert.ok((minted.json as { credential: { scopes: string[] } }).credential.scopes.includes("calendar:read"));
  const listed = await api("GET", `/api/v1/sub-profiles/${personaId}/keys`, { token: ownerToken });
  assert.equal(listed.status, 200);
  assert.equal(JSON.stringify(listed.json).includes(apiKey), false);

  const exchanged = await api("POST", "/api/v1/agent/token", { body: { apiKey } });
  assert.equal(exchanged.status, 200);
  const accessToken = (exchanged.json as { accessToken: string; agentUserId: string }).accessToken;
  assert.equal((exchanged.json as { agentUserId: string }).agentUserId, personaId);

  const sessionAsAgent = await api("POST", "/api/v1/sub-profiles", {
    token: accessToken,
    body: { displayName: "nested", profileMode: "agent" },
  });
  assert.equal(sessionAsAgent.status, 401);

  const cold = await api("POST", "/api/v1/agent/messages", {
    bearer: accessToken,
    body: { chatId, text: "too soon", clientId: `cold-${runId}` },
  });
  assert.equal(cold.status, 403);

  const group = await api("POST", "/api/chats/group", {
    token: ownerToken,
    body: { myUserId: owner.id, name: "nope", memberIds: [personaId, friend.id] },
  });
  assert.equal(group.status, 403);

  const added = await api("POST", `/api/v1/sub-profiles/${personaId}/chats/${chatId}`, { token: ownerToken });
  assert.equal(added.status, 200);

  const sent = await api("POST", "/api/v1/agent/messages", {
    bearer: accessToken,
    body: { chatId, text: "hello from the agent", clientId: `send-${runId}`, media: { kind: "file", dataUrl: TINY_PDF, fileName: "note.pdf" } },
  });
  assert.equal(sent.status, 200);
  const sentMessage = (sent.json as { message: { senderId: string; type: string } }).message;
  assert.equal(sentMessage.senderId, personaId);
  assert.equal(sentMessage.type, "file");

  const video = await api("POST", "/api/v1/agent/messages", {
    bearer: accessToken,
    body: { chatId, text: "", clientId: `video-${runId}`, media: { kind: "file", dataUrl: "data:video/mp4;base64,AAAA" } },
  });
  assert.equal(video.status, 400);

  const handle = `ag${runId.replaceAll("-", "").slice(0, 12)}`;
  const renamed = await api("PATCH", `/api/v1/sub-profiles/${personaId}`, {
    token: ownerToken,
    body: { username: handle },
  });
  assert.equal(renamed.status, 200);
  const found = await api("GET", `/api/users/find?username=${encodeURIComponent(handle)}`);
  const foundUsers = (found.json as { users: Array<{ id: string }> }).users;
  assert.equal(foundUsers.some((user) => user.id === personaId), false);
  const byPhone = await api("GET", "/api/users/find?q=" + encodeURIComponent("Jay Persona"));
  assert.equal((byPhone.json as { users: Array<{ id: string }> }).users.some((user) => user.id === personaId), false);

  const humanDm = await api("POST", "/api/chats/direct", {
    token: friendToken,
    body: { myUserId: friend.id, theirUserId: personaId },
  });
  assert.equal(humanDm.status, 200);
  const childDm = await api("POST", "/api/chats/direct", {
    token: childToken,
    body: { myUserId: child.id, theirUserId: personaId },
  });
  assert.equal(childDm.status, 403);

  const kidChat = await api("POST", "/api/chats/direct", {
    token: ownerToken,
    body: { myUserId: owner.id, theirUserId: child.id },
  });
  assert.equal(kidChat.status, 200);
  const kidChatId = (kidChat.json as { chatId: string }).chatId;
  const kidAdd = await api("POST", `/api/v1/sub-profiles/${personaId}/chats/${kidChatId}`, { token: ownerToken });
  assert.equal(kidAdd.status, 403);
  assert.equal((kidAdd.json as { code?: string }).code, "kids");

  await query(`UPDATE vm_chats SET is_e2e = true WHERE id = $1`, [chatId]);
  const e2eSend = await api("POST", "/api/v1/agent/messages", {
    bearer: accessToken,
    body: { chatId, text: "secret", clientId: `e2e-${runId}` },
  });
  assert.equal(e2eSend.status, 403);
  assert.equal((e2eSend.json as { code?: string }).code, "e2e");

  const open = await api("POST", "/api/chats/direct", {
    token: ownerToken,
    body: { myUserId: owner.id, theirUserId: outsider.id },
  });
  assert.equal(open.status, 200);
  const openChatId = (open.json as { chatId: string }).chatId;
  assert.equal((await api("POST", `/api/v1/sub-profiles/${personaId}/chats/${openChatId}`, { token: ownerToken })).status, 200);

  const startsAt = Date.now() + 60 * 60 * 1000;
  const endsAt = startsAt + 30 * 60 * 1000;
  const proposed = await api("POST", "/api/v1/agent/calendar/proposals", {
    bearer: accessToken,
    body: { chatId: openChatId, title: "Lunch with Jay", startsAt, endsAt, note: "downtown", clientId: `cal-${runId}` },
  });
  assert.equal(proposed.status, 201);
  const proposal = (proposed.json as { proposal: { id: string; status: string; approval: string }; message: { type: string; text: string } }).proposal;
  const proposalMessage = (proposed.json as { message: { type: string; text: string; media?: { approval?: string; votes?: unknown } } }).message;
  assert.equal(proposal.status, "pending");
  assert.equal(proposal.approval, "owner_or_admin");
  assert.equal(proposalMessage.type, "calendar_proposal");
  assert.equal(proposalMessage.media?.approval, "owner_or_admin");
  assert.equal(proposalMessage.media?.votes, undefined);
  assert.match(proposalMessage.text, /Yes adds this/);

  const stranger = await api("POST", `/api/v1/calendar/proposals/${proposal.id}/respond`, {
    token: friendToken,
    body: { decision: "yes" },
  });
  assert.equal(stranger.status, 403);

  const yes = await api("POST", `/api/v1/calendar/proposals/${proposal.id}/respond`, {
    token: ownerToken,
    body: { decision: "yes" },
  });
  assert.equal(yes.status, 200);
  const yesBody = yes.json as { proposal: { status: string }; calendarWrite: string; role: string; todo?: string };
  assert.equal(yesBody.proposal.status, "approved");
  assert.equal(yesBody.role, "owner");
  assert.equal(yesBody.calendarWrite, "pending_oauth");
  assert.match(yesBody.todo ?? "", /OAuth/);
  const decision = await queryOne<{ text: string }>(
    `SELECT text FROM vm_messages WHERE chat_id = $1 AND client_id = $2`,
    [openChatId, `proposal-decision:${proposal.id}`],
  );
  assert.match(decision?.text ?? "", /approved/);
  assert.match(decision?.text ?? "", /main calendar/);

  const again = await api("POST", `/api/v1/calendar/proposals/${proposal.id}/respond`, {
    token: ownerToken,
    body: { decision: "no" },
  });
  assert.equal(again.status, 409);

  await query(`UPDATE vm_chats SET created_by = $2 WHERE id = $1`, [openChatId, friend.id]);
  const second = await api("POST", "/api/v1/agent/calendar/proposals", {
    bearer: accessToken,
    body: { chatId: openChatId, title: "Skip this", startsAt, endsAt, clientId: `cal2-${runId}` },
  });
  assert.equal(second.status, 201);
  const secondId = (second.json as { proposal: { id: string } }).proposal.id;
  const no = await api("POST", `/api/v1/calendar/proposals/${secondId}/respond`, {
    token: friendToken,
    body: { decision: "no" },
  });
  assert.equal(no.status, 200);
  assert.equal((no.json as { proposal: { status: string }; role: string }).proposal.status, "declined");
  assert.equal((no.json as { role: string }).role, "admin");
  const dismissed = await queryOne<{ text: string }>(
    `SELECT text FROM vm_messages WHERE client_id = $1`,
    [`proposal-decision:${secondId}`],
  );
  assert.match(dismissed?.text ?? "", /dismissed/);

  const previous = process.env["AGENT_CALENDAR_PROPOSE"];
  process.env["AGENT_CALENDAR_PROPOSE"] = "0";
  const disabled = await api("POST", "/api/v1/agent/calendar/proposals", {
    bearer: accessToken,
    body: { chatId: openChatId, title: "Off", startsAt, endsAt, clientId: `cal3-${runId}` },
  });
  if (previous == null) delete process.env["AGENT_CALENDAR_PROPOSE"];
  else process.env["AGENT_CALENDAR_PROPOSE"] = previous;
  assert.equal(disabled.status, 403);
  assert.equal((disabled.json as { code?: string }).code, "feature_disabled");

  const busy = await api("GET", "/api/v1/agent/calendar/free-busy", { bearer: accessToken });
  assert.equal(busy.status, 200);
  assert.equal((busy.json as { stub?: boolean }).stub, true);
  assert.deepEqual((busy.json as { busy: unknown[] }).busy, []);

  const hook = await api("PUT", `/api/v1/sub-profiles/${personaId}/webhook`, {
    token: ownerToken,
    body: { url: "https://example.com/zivr-hook" },
  });
  assert.equal(hook.status, 200);
  assert.equal(typeof (hook.json as { webhook: { secret: string } }).webhook.secret, "string");

  const paused = await api("PATCH", `/api/v1/sub-profiles/${personaId}`, {
    token: ownerToken,
    body: { status: "paused" },
  });
  assert.equal(paused.status, 200);
  const pausedToken = await api("POST", "/api/v1/agent/token", { body: { apiKey } });
  assert.equal(pausedToken.status, 403);
});
