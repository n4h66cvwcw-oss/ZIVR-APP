import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import test from "node:test";
import { Pool } from "pg";
import { io, type Socket } from "socket.io-client";

type Users = {
  creatorId: string;
  memberId: string;
  outsiderId: string;
};

const runId = `checkin-socket-${crypto.randomUUID().slice(0, 8)}`;
const schemaName = `checkin_socket_test_${crypto.randomUUID().replaceAll("-", "")}`;
const originalDatabaseUrl = process.env["DATABASE_URL"];
assert.ok(originalDatabaseUrl, "DATABASE_URL is required for check-in socket tests");
const adminPool = new Pool({ connectionString: originalDatabaseUrl });
let dbPool: typeof import("./db.ts").default;
let query: typeof import("./db.ts").query;
let queryOne: typeof import("./db.ts").queryOne;
let signToken: typeof import("./auth.ts").signToken;
let server: http.Server;
let baseUrl = "";
const userIds: string[] = [];
const sockets: Socket[] = [];

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

function once<T>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event, resolve));
}

function waitFor<T>(socket: Socket, event: string, predicate: (value: T) => boolean): Promise<T> {
  return new Promise((resolve) => {
    const handler = (value: T) => {
      if (!predicate(value)) return;
      socket.off(event, handler);
      resolve(value);
    };
    socket.on(event, handler);
  });
}

function emitAck<T>(socket: Socket, event: string, payload: unknown): Promise<T> {
  return new Promise((resolve) => socket.emit(event, payload, resolve));
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

async function createFixture(): Promise<{ users: Users; groupId: string }> {
  const users = {
    creatorId: await createUser("creator"),
    memberId: await createUser("member"),
    outsiderId: await createUser("outsider"),
  };
  const group = await queryOne<{ id: string }>(
    `INSERT INTO vm_checkin_groups (name, creator_id)
     VALUES ($1, $2) RETURNING id`,
    [`${runId}-group`, users.creatorId],
  );
  assert.ok(group);
  await query(
    `INSERT INTO vm_checkin_group_members (group_id, user_id)
     VALUES ($1, $2), ($1, $3)`,
    [group.id, users.creatorId, users.memberId],
  );
  return { users, groupId: group.id };
}

test.before(async () => {
  await adminPool.query(`CREATE SCHEMA "${schemaName}"`);
  const isolatedUrl = new URL(originalDatabaseUrl);
  isolatedUrl.searchParams.set("options", `-c search_path=${schemaName}`);
  process.env["DATABASE_URL"] = isolatedUrl.toString();

  const [appModule, dbModule, authModule, migrateModule, socketModule] = await Promise.all([
    import("../app.ts"),
    import("./db.ts"),
    import("./auth.ts"),
    import("./migrate.ts"),
    import("./socket.ts"),
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

test("Socket.IO check-in broadcast/reply acknowledgements are canonical and authorized", async () => {
  const { users, groupId } = await createFixture();
  const creator = await connectAs(users.creatorId);
  const member = await connectAs(users.memberId);
  const outsider = await connectAs(users.outsiderId);

  const memberBroadcast = once<{
    id: string;
    groupId: string;
    senderId: string;
    replies: Record<string, unknown[]>;
  }>(member, "checkin:new");
  const sendAck = await emitAck<{
    ok: boolean;
    broadcast?: { id: string; groupId: string; senderId: string; replies: Record<string, unknown[]> };
    error?: string;
  }>(creator, "checkin:send", {
    groupId,
    text: "Realtime status?",
    clientId: "socket-broadcast-retry",
  });
  const receivedBroadcast = await memberBroadcast;
  assert.equal(sendAck.ok, true);
  assert.ok(sendAck.broadcast);
  assert.notEqual(sendAck.broadcast.id, "socket-broadcast-retry");
  assert.match(sendAck.broadcast.id, /^[0-9a-f-]{36}$/i);
  assert.equal(receivedBroadcast.id, sendAck.broadcast.id);
  assert.equal(receivedBroadcast.groupId, groupId);
  assert.equal(receivedBroadcast.senderId, users.creatorId);
  assert.deepEqual(receivedBroadcast.replies, {});
  assert.equal("progress" in receivedBroadcast, false);

  const creatorReply = once<{
    broadcastId: string;
    memberId: string;
    text: string;
  }>(creator, "checkin:reply");
  const creatorProgress = waitFor<{ broadcastId: string; total: number; replied: number }>(
    creator,
    "checkin:progress",
    (value) => value.broadcastId === sendAck.broadcast!.id && value.replied === 1,
  );
  const replyAck = await emitAck<{
    ok: boolean;
    reply?: { id: string; broadcastId: string; memberId: string; text: string };
    error?: string;
  }>(member, "checkin:reply", {
    broadcastId: sendAck.broadcast.id,
    text: "Here",
    clientId: "socket-reply-retry",
  });
  const receivedReply = await creatorReply;
  const progress = await creatorProgress;
  assert.equal(replyAck.ok, true);
  assert.deepEqual(receivedReply, replyAck.reply);
  assert.deepEqual(progress, {
    broadcastId: sendAck.broadcast.id,
    total: 1,
    replied: 1,
  });

  const outsiderSend = await emitAck<{ ok: boolean; error?: string }>(outsider, "checkin:send", {
    groupId,
    text: "forged",
    clientId: "outsider-send",
  });
  assert.equal(outsiderSend.ok, false, `outsider send ack: ${JSON.stringify(outsiderSend)}`);
  const outsiderReply = await emitAck<{ ok: boolean; error?: string }>(outsider, "checkin:reply", {
    broadcastId: sendAck.broadcast.id,
    text: "forged",
    clientId: "outsider-reply",
  });
  assert.equal(outsiderReply.ok, false, `outsider reply ack: ${JSON.stringify(outsiderReply)}`);

  let duplicateEvents = 0;
  let duplicateReplies = 0;
  let duplicateProgress = 0;
  member.on("checkin:new", () => { duplicateEvents += 1; });
  creator.on("checkin:reply", () => { duplicateReplies += 1; });
  creator.on("checkin:progress", () => { duplicateProgress += 1; });
  const duplicateSend = await emitAck<{ ok: boolean; broadcast?: { id: string } }>(
    creator,
    "checkin:send",
    { groupId, text: "Realtime status?", clientId: "socket-broadcast-retry" },
  );
  const duplicateReply = await emitAck<{ ok: boolean; reply?: { id: string } }>(
    member,
    "checkin:reply",
    {
      broadcastId: sendAck.broadcast.id,
      text: "Here",
      clientId: "socket-reply-retry",
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(duplicateSend.ok, true);
  assert.equal(duplicateSend.broadcast?.id, sendAck.broadcast.id);
  assert.equal(duplicateReply.ok, true);
  assert.equal(duplicateReply.reply?.id, replyAck.reply?.id);
  assert.equal(duplicateEvents, 0);
  assert.equal(duplicateReplies, 0);
  assert.equal(duplicateProgress, 0);
  const durableCounts = await queryOne<{ broadcasts: number; replies: number }>(
    `SELECT
       (SELECT COUNT(*)::int FROM vm_broadcasts WHERE group_id = $1 AND client_id = $2) AS broadcasts,
       (SELECT COUNT(*)::int FROM vm_checkin_replies WHERE broadcast_id = $3 AND member_id = $4 AND client_id = $5) AS replies`,
    [groupId, "socket-broadcast-retry", sendAck.broadcast.id, users.memberId, "socket-reply-retry"],
  );
  assert.deepEqual(durableCounts, { broadcasts: 1, replies: 1 });

  const restBroadcastEvent = once<{ id: string; groupId: string; senderId: string }>(member, "checkin:new");
  const restResponse = await fetch(`${baseUrl}/api/checkins/groups/${groupId}/broadcasts`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-auth-token": signToken(users.creatorId),
    },
    body: JSON.stringify({ text: "REST live event", clientId: "rest-live-1" }),
  });
  assert.equal(restResponse.status, 201);
  const restBroadcast = (await restResponse.json() as { broadcast: { id: string } }).broadcast;
  const receivedRestBroadcast = await restBroadcastEvent;
  assert.equal(receivedRestBroadcast.id, restBroadcast.id);
  assert.equal(receivedRestBroadcast.groupId, groupId);
  assert.equal(receivedRestBroadcast.senderId, users.creatorId);

  const forged = await connectAs(users.creatorId);
  const forgedError = once<{ message: string }>(forged, "error");
  forged.emit("user:join", users.memberId);
  assert.match((await forgedError).message, /Authentication failed/i);
  const forgedSend = await emitAck<{ ok: boolean; error?: string }>(forged, "checkin:send", {
    groupId,
    text: "forged identity",
    clientId: "forged-identity",
  });
  assert.equal(forgedSend.ok, false);
  await new Promise((resolve) => setTimeout(resolve, 100));
});