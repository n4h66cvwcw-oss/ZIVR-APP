import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import test from "node:test";
import { Pool } from "pg";

const runId = `xdm-${crypto.randomUUID().slice(0, 8)}`;
const schemaName = `cross_owner_${crypto.randomUUID().replaceAll("-", "")}`;
const originalDatabaseUrl = process.env["DATABASE_URL"];
assert.ok(originalDatabaseUrl, "DATABASE_URL is required for cross-owner DM integration tests");
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

async function createUser(label: string) {
  const uniqueName = `${runId}-${label}-${crypto.randomUUID().slice(0, 4)}`;
  const row = await queryOne<{ id: string }>(
    `INSERT INTO vm_users (display_name, username, account_type, token_claimed)
     VALUES ($1, $2, 'standard', true) RETURNING id`,
    [uniqueName, uniqueName],
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
  return { status: response.status, json };
}

function codeOf(json: unknown): string | undefined {
  return (json as { code?: string }).code;
}

async function agentAccess(ownerToken: string, name: string): Promise<{ id: string; access: string }> {
  const created = await api("POST", "/api/v1/sub-profiles", {
    token: ownerToken,
    body: { displayName: name, profileMode: "agent", provider: "custom" },
  });
  assert.equal(created.status, 201);
  const id = (created.json as { subProfile: { id: string } }).subProfile.id;
  userIds.push(id);
  const key = await api("POST", `/api/v1/sub-profiles/${id}/keys`, { token: ownerToken, body: {} });
  assert.equal(key.status, 201);
  const token = await api("POST", "/api/v1/agent/token", {
    body: { apiKey: (key.json as { key: string }).key },
  });
  assert.equal(token.status, 200);
  return { id, access: (token.json as { accessToken: string }).accessToken };
}

test.before(async () => {
  await adminPool.query(`CREATE SCHEMA "${schemaName}"`);
  const isolatedUrl = new URL(originalDatabaseUrl!);
  isolatedUrl.searchParams.set("options", `-c search_path=${schemaName}`);
  process.env["DATABASE_URL"] = isolatedUrl.toString();
  process.env["SESSION_SECRET"] ??= "unit-test-session-secret";
  delete process.env["AGENT_CROSS_OWNER_DM"];

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
  delete process.env["AGENT_CROSS_OWNER_DM"];
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

test("cross-owner agent DMs follow the flag, consent, and block", async () => {
  const ownerA = await createUser("owner-a");
  const ownerB = await createUser("owner-b");
  const tokenA = signToken(ownerA.id);
  const tokenB = signToken(ownerB.id);
  const agentA = await agentAccess(tokenA, "Agent A");
  const agentB = await agentAccess(tokenB, "Agent B");
  const twin = await agentAccess(tokenA, "Agent A2");

  const sameOwner = await api("POST", "/api/v1/agent/messages", {
    bearer: agentA.access,
    body: { peerId: twin.id, text: "same owner", clientId: `same-${runId}` },
  });
  assert.equal(sameOwner.status, 200);

  const flagOff = await api("POST", "/api/v1/agent/messages", {
    bearer: agentA.access,
    body: { peerId: agentB.id, text: "stranger", clientId: `off-${runId}` },
  });
  assert.equal(flagOff.status, 403);
  assert.equal(codeOf(flagOff.json), "cold_dm");

  process.env["AGENT_CROSS_OWNER_DM"] = "1";
  const ownerCannotOpen = await api("POST", `/api/v1/sub-profiles/${agentA.id}/direct`, {
    token: tokenA,
    body: { peerId: agentB.id },
  });
  assert.equal(ownerCannotOpen.status, 404);

  const noConsent = await api("POST", "/api/v1/agent/messages", {
    bearer: agentA.access,
    body: { peerId: agentB.id, text: "no consent", clientId: `noconsent-${runId}` },
  });
  assert.equal(noConsent.status, 403);
  assert.equal(codeOf(noConsent.json), "consent_required");

  const allow = await api("PUT", "/api/v1/sub-profiles/dm-consent", {
    token: tokenB,
    body: { peerOwnerId: ownerA.id, status: "allowed" },
  });
  assert.equal(allow.status, 200);

  const reverseCold = await api("POST", "/api/v1/agent/messages", {
    bearer: agentB.access,
    body: { peerId: agentA.id, text: "i start", clientId: `reverse-${runId}` },
  });
  assert.equal(reverseCold.status, 403);
  assert.equal(codeOf(reverseCold.json), "consent_required");

  const received: string[] = [];
  const hookServer = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      received.push(Buffer.concat(chunks).toString("utf8"));
      res.writeHead(204);
      res.end();
    });
  });
  await new Promise<void>((resolve) => hookServer.listen(0, "127.0.0.1", resolve));
  const hookAddress = hookServer.address();
  assert.ok(hookAddress && typeof hookAddress === "object");
  try {
    const hooked = await api("PUT", `/api/v1/sub-profiles/${agentA.id}/webhook`, {
      token: tokenA,
      body: { url: `http://127.0.0.1:${hookAddress.port}/hook` },
    });
    assert.equal(hooked.status, 200);

    const opened = await api("POST", "/api/v1/agent/messages", {
      bearer: agentA.access,
      body: { peerId: agentB.id, text: "hello other agent", clientId: `open-${runId}` },
    });
    assert.equal(opened.status, 200);
    const chatId = (opened.json as { message: { chatId: string } }).message.chatId;

    const reply = await api("POST", "/api/v1/agent/messages", {
      bearer: agentB.access,
      body: {
        peerId: agentA.id,
        text: "replying",
        clientId: `reply-${runId}`,
        media: { kind: "file", dataUrl: TINY_PDF, fileName: "note.pdf" },
      },
    });
    assert.equal(reply.status, 200);
    assert.equal((reply.json as { message: { chatId: string; type: string } }).message.chatId, chatId);
    assert.equal((reply.json as { message: { type: string } }).message.type, "file");

    const started = Date.now();
    while (received.length === 0 && Date.now() - started < 2000) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.equal(received.length > 0, true);
    const payload = JSON.parse(received[0] ?? "{}") as {
      type?: string;
      message?: { text?: string; type?: string };
    };
    assert.equal(payload.type, "message.created");
    assert.equal(payload.message?.text, "replying");
    assert.equal(payload.message?.type, "file");

    const events = await api("GET", "/api/v1/agent/events?since=0", { bearer: agentA.access });
    assert.equal(events.status, 200);
    const messages = (events.json as { events: Array<{ message: { chatId: string; text: string } }> }).events;
    assert.equal(messages.some((event) => event.message.chatId === chatId && event.message.text === "replying"), true);

    const blocked = await api("PUT", "/api/v1/sub-profiles/dm-consent", {
      token: tokenB,
      body: { peerOwnerId: ownerA.id, status: "blocked" },
    });
    assert.equal(blocked.status, 200);
    const afterBlock = await api("POST", "/api/v1/agent/messages", {
      bearer: agentA.access,
      body: { chatId, text: "still there?", clientId: `blocked-${runId}` },
    });
    assert.equal(afterBlock.status, 403);
    assert.equal(codeOf(afterBlock.json), "blocked");
    const peerAfterBlock = await api("POST", "/api/v1/agent/messages", {
      bearer: agentB.access,
      body: { peerId: agentA.id, text: "from the other side", clientId: `blocked-peer-${runId}` },
    });
    assert.equal(peerAfterBlock.status, 403);
    assert.equal(codeOf(peerAfterBlock.json), "blocked");

    const sameAfter = await api("POST", "/api/v1/agent/messages", {
      bearer: twin.access,
      body: { peerId: agentA.id, text: "still same owner", clientId: `same2-${runId}` },
    });
    assert.equal(sameAfter.status, 200);
  } finally {
    await new Promise<void>((resolve, reject) => {
      hookServer.close((error) => (error ? reject(error) : resolve()));
    });
  }

  const ownerC = await createUser("owner-c");
  const ownerD = await createUser("owner-d");
  const human = await queryOne<{ id: string }>(
    `INSERT INTO vm_chats (type, created_by) VALUES ('direct', $1) RETURNING id`,
    [ownerC.id],
  );
  assert.ok(human);
  await query(
    `INSERT INTO vm_chat_members (chat_id, user_id) VALUES ($1, $2), ($1, $3)`,
    [human.id, ownerC.id, ownerD.id],
  );
  const agentC = await agentAccess(signToken(ownerC.id), "Agent C");
  const agentD = await agentAccess(signToken(ownerD.id), "Agent D");
  const viaRelationship = await api("POST", "/api/v1/agent/messages", {
    bearer: agentC.access,
    body: { peerId: agentD.id, text: "we already talk", clientId: `h2h-${runId}` },
  });
  assert.equal(viaRelationship.status, 200);

  const blockRelationship = await api("PUT", "/api/v1/sub-profiles/dm-consent", {
    token: signToken(ownerD.id),
    body: { peerOwnerId: ownerC.id, status: "blocked" },
  });
  assert.equal(blockRelationship.status, 200);
  const relationshipBlocked = await api("POST", "/api/v1/agent/messages", {
    bearer: agentC.access,
    body: {
      chatId: (viaRelationship.json as { message: { chatId: string } }).message.chatId,
      text: "after block",
      clientId: `h2h-block-${runId}`,
    },
  });
  assert.equal(relationshipBlocked.status, 403);
  assert.equal(codeOf(relationshipBlocked.json), "blocked");

  const ownerE = await createUser("owner-e");
  const agentE = await agentAccess(signToken(ownerE.id), "Agent E");
  const allowE = await api("PUT", "/api/v1/sub-profiles/dm-consent", {
    token: signToken(ownerE.id),
    body: { peerOwnerId: ownerA.id, status: "allowed" },
  });
  assert.equal(allowE.status, 200);
  const chatRow = await queryOne<{ id: string }>(`SELECT id FROM vm_chats LIMIT 1`);
  assert.ok(chatRow);
  for (let i = 0; i < 5; i += 1) {
    await query(
      `INSERT INTO vm_agent_dm_opens (sender_owner_user_id, sender_agent_user_id, peer_agent_user_id, chat_id, opened_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [ownerA.id, agentA.id, agentB.id, chatRow.id, Date.now()],
    );
  }
  const capped = await api("POST", "/api/v1/agent/messages", {
    bearer: agentA.access,
    body: { peerId: agentE.id, text: "one more", clientId: `cap-${runId}` },
  });
  assert.equal(capped.status, 429);
  assert.equal(codeOf(capped.json), "rate_limited");
});
