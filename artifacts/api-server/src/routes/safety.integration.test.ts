import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import test from "node:test";
import { Pool } from "pg";
import { io, type Socket } from "socket.io-client";

process.env["SESSION_SECRET"] ??= "safety-test-secret";
delete process.env["SMTP_HOST"];

type ReportRow = {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  message_id: string | null;
  chat_id: string | null;
  reason: string;
  details: string | null;
  status: string;
};

const runId = `safety-${crypto.randomUUID().slice(0, 8)}`;
const schemaName = `safety_test_${crypto.randomUUID().replaceAll("-", "")}`;
const originalDatabaseUrl = process.env["DATABASE_URL"];
assert.ok(originalDatabaseUrl, "DATABASE_URL is required for safety integration tests");
const adminPool = new Pool({ connectionString: originalDatabaseUrl });

let baseUrl = "";
let server: http.Server;
let dbPool: typeof import("../lib/db.ts").default;
let query: typeof import("../lib/db.ts").query;
let queryOne: typeof import("../lib/db.ts").queryOne;
let signToken: typeof import("../lib/auth.ts").signToken;
let setModerationMailerForTests: typeof import("../lib/mailer.ts").setModerationMailerForTests;
let dispatchDueMessages: typeof import("./scheduled-messages.ts").dispatchDueMessages;
const notices: Array<{ reportId: string; reason: string; reporterId: string; reportedUserId: string }> = [];
let mailerShouldThrow = false;
const userIds: string[] = [];
const sockets: Socket[] = [];

async function createUser(label: string, flags?: { admin?: boolean; banned?: boolean }) {
  const name = `${runId}-${label}-${crypto.randomUUID().slice(0, 4)}`;
  const row = await queryOne<{ id: string }>(
    `INSERT INTO vm_users (display_name, username, is_admin, banned)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [name, name, flags?.admin === true, flags?.banned === true],
  );
  assert.ok(row);
  userIds.push(row.id);
  return { id: row.id, handle: name };
}

function api(method: string, path: string, userId?: string, body?: Record<string, unknown>) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(userId ? { "x-auth-token": signToken(userId) } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function once<T>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for ${event}`)), 5_000);
    socket.once(event, (value: T) => {
      clearTimeout(timer);
      resolve(value);
    });
  });
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
  assert.equal((await joined).userId, userId);
  return socket;
}

test.before(async () => {
  await adminPool.query(`CREATE SCHEMA "${schemaName}"`);
  const isolatedUrl = new URL(originalDatabaseUrl);
  isolatedUrl.searchParams.set("options", `-c search_path=${schemaName}`);
  process.env["DATABASE_URL"] = isolatedUrl.toString();

  const [appModule, dbModule, authModule, migrateModule, socketModule, mailerModule, scheduledModule] = await Promise.all([
    import("../app.ts"),
    import("../lib/db.ts"),
    import("../lib/auth.ts"),
    import("../lib/migrate.ts"),
    import("../lib/socket.ts"),
    import("../lib/mailer.ts"),
    import("./scheduled-messages.ts"),
  ]);
  dbPool = dbModule.default;
  query = dbModule.query;
  queryOne = dbModule.queryOne;
  signToken = authModule.signToken;
  setModerationMailerForTests = mailerModule.setModerationMailerForTests;
  dispatchDueMessages = scheduledModule.dispatchDueMessages;
  setModerationMailerForTests(async (notice) => {
    notices.push({
      reportId: notice.reportId,
      reason: notice.reason,
      reporterId: notice.reporterId,
      reportedUserId: notice.reportedUserId,
    });
    if (mailerShouldThrow) throw new Error("smtp down");
  });
  await migrateModule.migrate();
  server = http.createServer(appModule.default);
  socketModule.attachSocket(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  setModerationMailerForTests?.(null);
  sockets.forEach((socket) => socket.disconnect());
  if (userIds.length) await query(`DELETE FROM vm_users WHERE id = ANY($1::uuid[])`, [userIds]);
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await dbPool.end();
  await adminPool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
  await adminPool.end();
});

test("report, block, and admin moderation", async (t) => {
  const reporter = await createUser("reporter");
  const reported = await createUser("reported");
  const outsider = await createUser("outsider");
  const admin = await createUser("admin", { admin: true });

  await t.test("reports persist and email without failing when the mailer throws", async () => {
    const chat = await queryOne<{ id: string }>(
      `INSERT INTO vm_chats (type, created_by) VALUES ('direct', $1) RETURNING id`,
      [reporter.id],
    );
    assert.ok(chat);
    await query(
      `INSERT INTO vm_chat_members (chat_id, user_id) VALUES ($1, $2), ($1, $3)`,
      [chat.id, reporter.id, reported.id],
    );
    const message = await queryOne<{ id: string }>(
      `INSERT INTO vm_messages (chat_id, sender_id, text, created_at)
       VALUES ($1, $2, 'spam link', $3) RETURNING id`,
      [chat.id, reported.id, Date.now()],
    );
    assert.ok(message);

    assert.equal((await api("POST", "/api/reports", undefined, {
      reportedUserId: reported.id,
      reason: "spam",
    })).status, 401);

    mailerShouldThrow = true;
    const created = await api("POST", "/api/reports", reporter.id, {
      reportedUserId: reported.id,
      messageId: message.id,
      chatId: chat.id,
      reason: "spam",
      details: "unsolicited link",
    });
    assert.equal(created.status, 201);
    const body = await created.json() as { report: { id: string; status: string } };
    assert.equal(body.report.status, "open");
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(notices.at(-1)?.reportId, body.report.id);
    assert.equal(notices.at(-1)?.reason, "spam");
    const row = await queryOne<ReportRow>(
      `SELECT id, reporter_id, reported_user_id, message_id, chat_id, reason, details, status
         FROM content_reports WHERE id = $1`,
      [body.report.id],
    );
    assert.equal(row?.reporter_id, reporter.id);
    assert.equal(row?.reported_user_id, reported.id);
    assert.equal(row?.message_id, message.id);
    assert.equal(row?.details, "unsolicited link");
    mailerShouldThrow = false;

    const patched = await api("PATCH", `/api/admin/reports/${body.report.id}`, admin.id, { status: "actioned" });
    assert.equal(patched.status, 200);
    assert.equal((await queryOne<{ status: string }>(`SELECT status FROM content_reports WHERE id = $1`, [body.report.id]))?.status, "actioned");
    assert.equal((await api("PATCH", `/api/admin/reports/${body.report.id}`, reporter.id, { status: "resolved" })).status, 403);
  });

  await t.test("blocks are private, mutual for 1:1 delivery, and filtered in history", async () => {
    const blocked = await api("POST", "/api/blocks", reporter.id, { userId: reported.id });
    assert.equal(blocked.status, 200);
    assert.equal((await api("POST", "/api/blocks", reporter.id, { userId: reporter.id })).status, 400);

    const listed = await api("GET", "/api/blocks", reporter.id);
    assert.equal(listed.status, 200);
    const listBody = await listed.json() as { blocks: Array<{ userId: string }> };
    assert.deepEqual(listBody.blocks.map((row) => row.userId), [reported.id]);
    assert.equal((await api("GET", "/api/blocks", reported.id)).status, 200);
    assert.deepEqual(((await (await api("GET", "/api/blocks", reported.id)).json()) as { blocks: unknown[] }).blocks, []);

    const refused = await api("POST", "/api/chats/direct", reported.id, {
      myUserId: reported.id,
      theirUserId: reporter.id,
    });
    assert.equal(refused.status, 403);
    const refusedBody = await refused.json() as { error: string; approval?: string };
    assert.equal(refusedBody.error, "can't message this user");
    assert.equal(refusedBody.approval, undefined);

    const direct = await queryOne<{ id: string }>(
      `SELECT c.id FROM vm_chats c
         JOIN vm_chat_members a ON a.chat_id = c.id AND a.user_id = $1
         JOIN vm_chat_members b ON b.chat_id = c.id AND b.user_id = $2
        WHERE c.type = 'direct' LIMIT 1`,
      [reporter.id, reported.id],
    );
    assert.ok(direct);
    const reporterView = await api("GET", `/api/chats/${direct.id}/messages`, reporter.id);
    const reporterMessages = ((await reporterView.json()) as { messages: Array<{ senderId: string }> }).messages;
    assert.equal(reporterMessages.some((message) => message.senderId === reported.id), false);

    const group = await queryOne<{ id: string }>(
      `INSERT INTO vm_chats (type, name, created_by) VALUES ('group', 'safety', $1) RETURNING id`,
      [outsider.id],
    );
    assert.ok(group);
    await query(
      `INSERT INTO vm_chat_members (chat_id, user_id) VALUES ($1, $2), ($1, $3), ($1, $4)`,
      [group.id, reporter.id, reported.id, outsider.id],
    );
    await query(
      `INSERT INTO vm_messages (chat_id, sender_id, text, created_at) VALUES ($1, $2, 'group spam', $3)`,
      [group.id, reported.id, Date.now()],
    );
    const hidden = ((await (await api("GET", `/api/chats/${group.id}/messages`, reporter.id)).json()) as {
      messages: Array<{ text: string; hidden?: boolean }>;
    }).messages;
    assert.equal(hidden[0]?.hidden, true);
    assert.equal(hidden[0]?.text, "");
    const visible = ((await (await api("GET", `/api/chats/${group.id}/messages`, outsider.id)).json()) as {
      messages: Array<{ text: string; hidden?: boolean }>;
    }).messages;
    assert.equal(visible[0]?.text, "group spam");
    assert.equal(visible[0]?.hidden, undefined);

    const chats = ((await (await api("GET", `/api/chats/user/${reporter.id}`, reporter.id)).json()) as {
      chats: Array<{ id: string }>;
    }).chats;
    assert.equal(chats.some((chat) => chat.id === direct.id), false);

    const sender = await connectAs(reported.id);
    const blocker = await connectAs(reporter.id);
    const outsiderSocket = await connectAs(outsider.id);
    const hiddenEvent = once<{ messageId: string; senderId: string }>(blocker, "message:hidden");
    const delivered = once<{ text: string }>(outsiderSocket, "message:new");
    sender.emit("message:send", {
      chatId: group.id,
      senderId: reported.id,
      text: "live group",
      localId: "local-group",
    });
    assert.equal((await hiddenEvent).senderId, reported.id);
    assert.equal((await delivered).text, "live group");

    const refusal = once<{ status: string; message: string }>(sender, "message:blocked");
    sender.emit("message:send", {
      chatId: direct.id,
      senderId: reported.id,
      text: "should not land",
      localId: "local-direct",
    });
    const refusedSend = await refusal;
    assert.equal(refusedSend.status, "user_block");
    assert.equal(refusedSend.message, "can't message this user");
    const stored = await queryOne<{ id: string }>(
      `SELECT id FROM vm_messages WHERE chat_id = $1 AND text = 'should not land'`,
      [direct.id],
    );
    assert.equal(stored, null);

    const scheduledFor = Date.now() + 60_000;
    const refusedSchedule = await api("POST", "/api/scheduled-messages", reported.id, {
      chatId: direct.id,
      text: "send later",
      scheduledFor,
    });
    assert.equal(refusedSchedule.status, 403);
    assert.equal(((await refusedSchedule.json()) as { error: string }).error, "can't message this user");

    const due = await queryOne<{ id: string }>(
      `INSERT INTO vm_scheduled_messages
         (sender_id, chat_id, text, scheduled_for, status, created_at, updated_at)
       VALUES ($1, $2, 'overdue', $3, 'pending', $3, $3)
       RETURNING id`,
      [reported.id, direct.id, Date.now() - 1000],
    );
    assert.ok(due);
    await dispatchDueMessages({ senderId: reported.id });
    const failed = await queryOne<{ status: string; failure_reason: string | null }>(
      `SELECT status, failure_reason FROM vm_scheduled_messages WHERE id = $1`,
      [due.id],
    );
    assert.equal(failed?.status, "failed");
    assert.equal(failed?.failure_reason, "can't message this user");
    assert.equal((await queryOne(
      `SELECT id FROM vm_messages WHERE chat_id = $1 AND text = 'overdue'`,
      [direct.id],
    )), null);

    const groupDue = await queryOne<{ id: string }>(
      `INSERT INTO vm_scheduled_messages
         (sender_id, chat_id, text, scheduled_for, status, created_at, updated_at)
       VALUES ($1, $2, 'group overdue', $3, 'pending', $3, $3)
       RETURNING id`,
      [reported.id, group.id, Date.now() - 1000],
    );
    assert.ok(groupDue);
    const scheduledHidden = once<{ senderId: string }>(blocker, "message:hidden");
    const scheduledDelivered = once<{ text: string }>(outsiderSocket, "message:new");
    await dispatchDueMessages({ senderId: reported.id });
    assert.equal((await scheduledHidden).senderId, reported.id);
    assert.equal((await scheduledDelivered).text, "group overdue");

    assert.equal((await api("DELETE", `/api/blocks/${reported.id}`, reporter.id)).status, 204);
  });

  await t.test("admins can ban users and remove messages", async () => {
    const target = await createUser("target");
    assert.equal((await api("POST", `/api/admin/users/${target.id}/ban`, outsider.id)).status, 403);
    const banned = await api("POST", `/api/admin/users/${target.id}/ban`, admin.id);
    assert.equal(banned.status, 200);
    assert.equal((await api("GET", "/api/blocks", target.id)).status, 403);

    const socket = io(baseUrl, {
      path: "/api/socket.io",
      transports: ["websocket"],
      auth: { token: signToken(target.id) },
      autoConnect: false,
    });
    sockets.push(socket);
    socket.connect();
    await once<void>(socket, "connect");
    const error = once<{ message: string }>(socket, "error");
    socket.emit("user:join", target.id);
    assert.match((await error).message, /suspended/);

    const message = await queryOne<{ id: string; chat_id: string }>(
      `INSERT INTO vm_messages (chat_id, sender_id, text, created_at)
       SELECT id, $1, 'remove me', $2 FROM vm_chats LIMIT 1
       RETURNING id, chat_id`,
      [target.id, Date.now()],
    );
    assert.ok(message);
    const member = await connectAs(reporter.id);
    await query(
      `INSERT INTO vm_chat_members (chat_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [message.chat_id, reporter.id],
    );
    member.emit("chat:join", message.chat_id);
    const removed = once<{ messageId: string }>(member, "message:removed");
    const deleted = await api("DELETE", `/api/admin/messages/${message.id}`, admin.id);
    assert.equal(deleted.status, 200);
    assert.equal((await removed).messageId, message.id);
    const history = ((await (await api("GET", `/api/chats/${message.chat_id}/messages`, reporter.id)).json()) as {
      messages: Array<{ id: string }>;
    }).messages;
    assert.equal(history.some((row) => row.id === message.id), false);
  });
});
