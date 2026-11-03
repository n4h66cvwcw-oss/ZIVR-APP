import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import test from "node:test";
import { Pool } from "pg";
import { io, type Socket } from "socket.io-client";

const runId = `react-${crypto.randomUUID().slice(0, 8)}`;
const schemaName = `react_test_${crypto.randomUUID().replaceAll("-", "")}`;
const originalDatabaseUrl = process.env["DATABASE_URL"];
assert.ok(originalDatabaseUrl, "DATABASE_URL is required for reaction integration tests");
const adminPool = new Pool({ connectionString: originalDatabaseUrl });
let baseUrl = "";
let server: http.Server;
let dbPool: typeof import("../lib/db.ts").default;
let query: typeof import("../lib/db.ts").query;
let queryOne: typeof import("../lib/db.ts").queryOne;
let signToken: typeof import("../lib/auth.ts").signToken;
const userIds: string[] = [];
const sockets: Socket[] = [];

type ReactionBody = {
  messageId: string;
  chatId: string;
  emoji: string;
  userId: string;
  action: "added" | "removed";
  reactions: Record<string, string[]>;
  clientId: string | null;
};

async function createUser(label: string): Promise<string> {
  const name = `${runId}-${label}-${crypto.randomUUID().slice(0, 4)}`;
  const row = await queryOne<{ id: string }>(
    `INSERT INTO vm_users (display_name, username) VALUES ($1, $2) RETURNING id`,
    [name, name],
  );
  assert.ok(row);
  userIds.push(row.id);
  return row.id;
}

async function react(
  userId: string | null,
  chatId: string,
  messageId: string,
  body: unknown,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const response = await fetch(
    `${baseUrl}/api/chats/${chatId}/messages/${encodeURIComponent(messageId)}/reactions`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(userId ? { "x-auth-token": signToken(userId) } : {}),
      },
      body: JSON.stringify(body),
    },
  );
  const json = await response.json() as Record<string, unknown>;
  return { status: response.status, json };
}

async function history(userId: string, chatId: string) {
  const response = await fetch(`${baseUrl}/api/chats/${chatId}/messages`, {
    headers: { "x-auth-token": signToken(userId) },
  });
  assert.equal(response.status, 200);
  return response.json() as Promise<{ messages: Array<{ id: string; localId?: string; reactions?: Record<string, string[]> }> }>;
}

function once<T>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event, resolve));
}

async function connectAs(userId: string): Promise<Socket> {
  const socket = io(baseUrl, {
    path: "/api/socket.io",
    transports: ["websocket"],
    auth: { token: signToken(userId) },
    autoConnect: false,
  });
  sockets.push(socket);
  socket.connect();
  await once<void>(socket, "connect");
  const joined = once<{ userId: string }>(socket, "user:joined");
  socket.emit("user:join", userId);
  const data = await joined;
  assert.equal(data.userId, userId);
  return socket;
}

test.before(async () => {
  await adminPool.query(`CREATE SCHEMA "${schemaName}"`);
  const isolatedUrl = new URL(originalDatabaseUrl);
  isolatedUrl.searchParams.set("options", `-c search_path=${schemaName}`);
  process.env["DATABASE_URL"] = isolatedUrl.toString();

  const [appModule, dbModule, authModule, migrateModule, socketModule] = await Promise.all([
    import("../app.ts"),
    import("../lib/db.ts"),
    import("../lib/auth.ts"),
    import("../lib/migrate.ts"),
    import("../lib/socket.ts"),
  ]);
  dbPool = dbModule.default;
  query = dbModule.query;
  queryOne = dbModule.queryOne;
  signToken = authModule.signToken;
  await migrateModule.migrate();

  server = http.createServer(appModule.default);
  socketModule.attachSocket(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  sockets.forEach((socket) => socket.disconnect());
  if (userIds.length) await query(`DELETE FROM vm_users WHERE id = ANY($1::uuid[])`, [userIds]);
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await dbPool.end();
  await adminPool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
  await adminPool.end();
});

test("reaction toggle persists, fans out, and comes back on history", async () => {
  const senderId = await createUser("sender");
  const peerId = await createUser("peer");
  const outsiderId = await createUser("outsider");
  const thirdId = await createUser("third");

  const chat = await queryOne<{ id: string }>(
    `INSERT INTO vm_chats (type, created_by) VALUES ('direct', $1) RETURNING id`,
    [senderId],
  );
  assert.ok(chat);
  await query(
    `INSERT INTO vm_chat_members (chat_id, user_id) VALUES ($1, $2), ($1, $3)`,
    [chat.id, senderId, peerId],
  );
  const message = await queryOne<{ id: string }>(
    `INSERT INTO vm_messages (chat_id, sender_id, client_id, text, type, created_at)
     VALUES ($1, $2, $3, 'hello', 'text', $4) RETURNING id`,
    [chat.id, senderId, "local-sender-1", Date.now()],
  );
  assert.ok(message);

  const before = await history(peerId, chat.id);
  assert.equal(before.messages.length, 1);
  assert.equal(before.messages[0]?.localId, "local-sender-1");
  assert.equal("reactions" in (before.messages[0] ?? {}), false);

  const peer = await connectAs(peerId);
  const outsider = await connectAs(outsiderId);
  const outsiderEvents: unknown[] = [];
  outsider.on("message:reaction", (payload) => outsiderEvents.push(payload));
  const peerEvent = once<ReactionBody>(peer, "message:reaction");

  const added = await react(senderId, chat.id, "local-sender-1", { emoji: "👍" });
  assert.equal(added.status, 200);
  const addedBody = added.json as ReactionBody;
  assert.equal(addedBody.messageId, message.id);
  assert.equal(addedBody.chatId, chat.id);
  assert.equal(addedBody.emoji, "👍");
  assert.equal(addedBody.userId, senderId);
  assert.equal(addedBody.action, "added");
  assert.equal(addedBody.clientId, "local-sender-1");
  assert.deepEqual(addedBody.reactions, { "👍": [senderId] });

  const fanout = await peerEvent;
  assert.deepEqual(fanout, addedBody);
  assert.equal(outsiderEvents.length, 0);

  const upper = await react(peerId, chat.id, message.id.toUpperCase(), { emoji: "👍" });
  assert.equal(upper.status, 200);
  assert.equal((upper.json as ReactionBody).action, "added");
  assert.deepEqual((upper.json as ReactionBody).reactions["👍"], [senderId, peerId]);

  const seen = await history(peerId, chat.id);
  assert.deepEqual(seen.messages[0]?.reactions, { "👍": [senderId, peerId] });

  const removed = await react(senderId, chat.id, message.id, { emoji: "👍" });
  assert.equal(removed.status, 200);
  assert.equal((removed.json as ReactionBody).action, "removed");
  assert.deepEqual((removed.json as ReactionBody).reactions, { "👍": [peerId] });

  const heart = await react(senderId, chat.id, message.id, { emoji: "❤️" });
  assert.equal(heart.status, 200);
  assert.deepEqual((heart.json as ReactionBody).reactions, { "👍": [peerId], "❤️": [senderId] });

  const stamped = await queryOne<{ created_at: string }>(
    `SELECT created_at FROM vm_messages WHERE id = $1`,
    [message.id],
  );
  assert.ok(stamped);
  const catchup = io(baseUrl, {
    path: "/api/socket.io",
    transports: ["websocket"],
    auth: { token: signToken(peerId) },
    autoConnect: false,
  });
  sockets.push(catchup);
  catchup.connect();
  await once<void>(catchup, "connect");
  const missedPromise = once<{ messages: Array<{ id: string; reactions?: Record<string, string[]> }> }>(
    catchup,
    "missed_messages",
  );
  catchup.emit("user:join", { userId: peerId, since: Number(stamped.created_at) - 1 });
  const missed = await missedPromise;
  const caught = missed.messages.find((item) => item.id === message.id);
  assert.ok(caught);
  assert.deepEqual(caught.reactions, { "👍": [peerId], "❤️": [senderId] });

  assert.equal((await react(null, chat.id, message.id, { emoji: "👍" })).status, 401);
  const forbidden = await react(outsiderId, chat.id, message.id, { emoji: "👍" });
  assert.equal(forbidden.status, 403);
  assert.equal(forbidden.json["code"], "not_member");
  const badEmoji = await react(senderId, chat.id, message.id, { emoji: "hello" });
  assert.equal(badEmoji.status, 400);
  assert.equal(badEmoji.json["code"], "invalid");
  const missing = await react(senderId, chat.id, crypto.randomUUID(), { emoji: "👍" });
  assert.equal(missing.status, 404);

  const otherChat = await queryOne<{ id: string }>(
    `INSERT INTO vm_chats (type, created_by) VALUES ('direct', $1) RETURNING id`,
    [senderId],
  );
  assert.ok(otherChat);
  await query(
    `INSERT INTO vm_chat_members (chat_id, user_id) VALUES ($1, $2), ($1, $3)`,
    [otherChat.id, senderId, peerId],
  );
  const foreign = await react(peerId, otherChat.id, message.id, { emoji: "👍" });
  assert.equal(foreign.status, 404);

  const bare = await queryOne<{ id: string }>(
    `INSERT INTO vm_messages (chat_id, sender_id, text, type, created_at)
     VALUES ($1, $2, 'no client id', 'text', $3) RETURNING id`,
    [chat.id, senderId, Date.now()],
  );
  assert.ok(bare);
  const bareReaction = await react(peerId, chat.id, bare.id, { emoji: "🎉" });
  assert.equal(bareReaction.status, 200);
  assert.equal((bareReaction.json as ReactionBody).clientId, null);
  assert.equal((bareReaction.json as ReactionBody).messageId, bare.id);

  const group = await queryOne<{ id: string }>(
    `INSERT INTO vm_chats (type, created_by) VALUES ('group', $1) RETURNING id`,
    [senderId],
  );
  assert.ok(group);
  await query(
    `INSERT INTO vm_chat_members (chat_id, user_id) VALUES ($1, $2), ($1, $3), ($1, $4)`,
    [group.id, senderId, peerId, thirdId],
  );
  await query(
    `INSERT INTO vm_messages (chat_id, sender_id, client_id, text, type, created_at)
     VALUES ($1, $2, 'shared-local', 'a', 'text', $4),
            ($1, $3, 'shared-local', 'b', 'text', $5)`,
    [group.id, senderId, peerId, Date.now(), Date.now() + 1],
  );
  const ambiguous = await react(thirdId, group.id, "shared-local", { emoji: "😂" });
  assert.equal(ambiguous.status, 409);
  assert.equal(ambiguous.json["code"], "ambiguous");
  const own = await react(senderId, group.id, "shared-local", { emoji: "😂" });
  assert.equal(own.status, 200);
  const ownRow = await queryOne<{ text: string; reactions: { "😂": string[] } }>(
    `SELECT text, reactions FROM vm_messages WHERE chat_id = $1 AND sender_id = $2 AND client_id = 'shared-local'`,
    [group.id, senderId],
  );
  assert.equal(ownRow?.text, "a");
  assert.deepEqual(ownRow?.reactions["😂"], [senderId]);

  const parallelMessage = await queryOne<{ id: string }>(
    `INSERT INTO vm_messages (chat_id, sender_id, client_id, text, type, created_at)
     VALUES ($1, $2, 'parallel-1', 'race', 'text', $3) RETURNING id`,
    [chat.id, senderId, Date.now()],
  );
  assert.ok(parallelMessage);
  const [left, right] = await Promise.all([
    react(senderId, chat.id, parallelMessage.id, { emoji: "👍" }),
    react(peerId, chat.id, parallelMessage.id, { emoji: "❤️" }),
  ]);
  assert.equal(left.status, 200);
  assert.equal(right.status, 200);
  const raced = await queryOne<{ reactions: Record<string, string[]> }>(
    `SELECT reactions FROM vm_messages WHERE id = $1`,
    [parallelMessage.id],
  );
  assert.deepEqual(raced?.reactions["👍"], [senderId]);
  assert.deepEqual(raced?.reactions["❤️"], [peerId]);
});
