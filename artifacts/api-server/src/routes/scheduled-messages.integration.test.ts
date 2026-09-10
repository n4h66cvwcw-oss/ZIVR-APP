import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import test from "node:test";
import { Pool } from "pg";

type Fixture = {
  senderId: string;
  recipientId: string;
  outsiderId: string;
  chatId: string;
};

type Scheduled = {
  id: string;
  text: string;
  status: "pending" | "sending" | "sent" | "cancelled" | "failed";
  sent_message_id: string | null;
  failure_reason: string | null;
};

const runId = `sm-${crypto.randomUUID().slice(0, 8)}`;
const schemaName = `scheduled_test_${crypto.randomUUID().replaceAll("-", "")}`;
const originalDatabaseUrl = process.env["DATABASE_URL"];
assert.ok(originalDatabaseUrl, "DATABASE_URL is required for scheduled-message integration tests");
const adminPool = new Pool({ connectionString: originalDatabaseUrl });
let baseUrl = "";
let server: http.Server;
let app: typeof import("../app.ts").default;
let dbPool: typeof import("../lib/db.ts").default;
let query: typeof import("../lib/db.ts").query;
let queryOne: typeof import("../lib/db.ts").queryOne;
let signToken: typeof import("../lib/auth.ts").signToken;
let dispatchDueMessages: typeof import("./scheduled-messages.ts").dispatchDueMessages;
const userIds: string[] = [];
const chatIds: string[] = [];

async function createUser(label: string, accountType = "standard") {
  const uniqueName = `${runId}-${label}-${crypto.randomUUID().slice(0, 4)}`;
  const row = await queryOne<{ id: string }>(
    `INSERT INTO vm_users (display_name, username, account_type)
     VALUES ($1, $2, $3) RETURNING id`,
    [uniqueName, uniqueName, accountType],
  );
  assert.ok(row);
  userIds.push(row.id);
  return row.id;
}

async function createFixture(): Promise<Fixture> {
  const senderId = await createUser("sender");
  const recipientId = await createUser("recipient");
  const outsiderId = await createUser("outsider");
  const chat = await queryOne<{ id: string }>(
    `INSERT INTO vm_chats (type, name, created_by)
     VALUES ('direct', $1, $2) RETURNING id`,
    [`${runId}-chat`, senderId],
  );
  assert.ok(chat);
  chatIds.push(chat.id);
  await query(
    `INSERT INTO vm_chat_members (chat_id, user_id)
     VALUES ($1, $2), ($1, $3)`,
    [chat.id, senderId, recipientId],
  );
  return { senderId, recipientId, outsiderId, chatId: chat.id };
}

async function api(
  method: string,
  path: string,
  userId: string,
  body?: Record<string, unknown>,
) {
  return fetch(`${baseUrl}/api/scheduled-messages${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-auth-token": signToken(userId),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function insertDue(fixture: Fixture, text: string, status = "pending", updatedAt = Date.now()) {
  const now = Date.now();
  const row = await queryOne<{ id: string }>(
    `INSERT INTO vm_scheduled_messages
       (sender_id, chat_id, text, scheduled_for, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [fixture.senderId, fixture.chatId, text, now - 1, status, now, updatedAt],
  );
  assert.ok(row);
  return row.id;
}

async function getScheduled(id: string) {
  return queryOne<Scheduled>(
    `SELECT id, text, status, sent_message_id, failure_reason
       FROM vm_scheduled_messages WHERE id = $1`,
    [id],
  );
}

async function messageTextsForScheduled(id: string) {
  return query<{ text: string }>(
    `SELECT m.text
       FROM vm_messages m
      WHERE m.chat_id = (SELECT chat_id FROM vm_scheduled_messages WHERE id = $1)
        AND m.sender_id = (SELECT sender_id FROM vm_scheduled_messages WHERE id = $1)`,
    [id],
  );
}

test.before(async () => {
  await adminPool.query(`CREATE SCHEMA "${schemaName}"`);
  const isolatedUrl = new URL(originalDatabaseUrl);
  isolatedUrl.searchParams.set("options", `-c search_path=${schemaName}`);
  process.env["DATABASE_URL"] = isolatedUrl.toString();

  const [appModule, dbModule, authModule, migrateModule, scheduledModule] = await Promise.all([
    import("../app.ts"),
    import("../lib/db.ts"),
    import("../lib/auth.ts"),
    import("../lib/migrate.ts"),
    import("./scheduled-messages.ts"),
  ]);
  app = appModule.default;
  dbPool = dbModule.default;
  query = dbModule.query;
  queryOne = dbModule.queryOne;
  signToken = authModule.signToken;
  dispatchDueMessages = scheduledModule.dispatchDueMessages;

  await migrateModule.migrate();
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  if (chatIds.length) {
    await query(`DELETE FROM vm_chats WHERE id = ANY($1::uuid[])`, [chatIds]);
  }
  if (userIds.length) {
    await query(`DELETE FROM vm_users WHERE id = ANY($1::uuid[])`, [userIds]);
  }
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
  await dbPool.end();
  await adminPool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
  await adminPool.end();
});

test("scheduled-message routes and dispatcher remain race-safe", async (t) => {
  await t.test("create, edit, cancel, ownership, and membership are enforced", async () => {
    const fixture = await createFixture();
    const scheduledFor = Date.now() + 60_000;
    const createdResponse = await api("POST", "/", fixture.senderId, {
      chatId: fixture.chatId,
      text: "original",
      scheduledFor,
    });
    assert.equal(createdResponse.status, 201);
    const created = await createdResponse.json() as { id: string; text: string };
    assert.equal(created.text, "original");

    const outsiderCreate = await api("POST", "/", fixture.outsiderId, {
      chatId: fixture.chatId,
      text: "not allowed",
      scheduledFor,
    });
    assert.equal(outsiderCreate.status, 404);
    assert.equal((await getScheduled(created.id))?.text, "original");

    assert.equal((await api("PATCH", `/${created.id}`, fixture.outsiderId, { text: "stolen" })).status, 404);
    assert.equal((await api("DELETE", `/${created.id}`, fixture.outsiderId)).status, 404);

    const editedResponse = await api("PATCH", `/${created.id}`, fixture.senderId, { text: "edited" });
    assert.equal(editedResponse.status, 200);
    assert.equal(((await editedResponse.json()) as { text: string }).text, "edited");
    assert.equal((await api("DELETE", `/${created.id}`, fixture.senderId)).status, 204);
    assert.equal((await getScheduled(created.id))?.status, "cancelled");
  });

  await t.test("cancel racing the dispatcher is linearizable and never sends a cancelled row", async () => {
    const fixture = await createFixture();
    const id = await insertDue(fixture, "cancel race");
    const [cancelResponse] = await Promise.all([
      api("DELETE", `/${id}`, fixture.senderId),
      dispatchDueMessages({ senderId: fixture.senderId }),
    ]);
    const row = await getScheduled(id);
    assert.ok(row);
    const messages = await messageTextsForScheduled(id);

    if (cancelResponse.status === 204) {
      assert.equal(row.status, "cancelled");
      assert.equal(messages.length, 0);
    } else {
      assert.equal(cancelResponse.status, 404);
      assert.equal(row.status, "sent");
      assert.equal(messages.length, 1);
    }
  });

  await t.test("edit racing the dispatcher either wins fully or is rejected", async () => {
    const fixture = await createFixture();
    const id = await insertDue(fixture, "before edit");
    const [editResponse] = await Promise.all([
      api("PATCH", `/${id}`, fixture.senderId, { text: "after edit" }),
      dispatchDueMessages({ senderId: fixture.senderId }),
    ]);
    let row = await getScheduled(id);
    assert.ok(row);

    if (editResponse.status === 200) {
      if (row.status === "pending") {
        assert.equal((await messageTextsForScheduled(id)).length, 0);
        await dispatchDueMessages({ senderId: fixture.senderId });
        row = await getScheduled(id);
        assert.ok(row);
      }
      const messages = await messageTextsForScheduled(id);
      assert.equal(row.status, "sent");
      assert.equal(row.text, "after edit");
      assert.equal(messages.length, 1);
      assert.equal(messages[0]?.text, "after edit");
    } else {
      assert.equal(editResponse.status, 409);
      const messages = await messageTextsForScheduled(id);
      assert.equal(row.status, "sent");
      assert.equal(row.text, "before edit");
      assert.equal(messages.length, 1);
      assert.equal(messages[0]?.text, "before edit");
    }
  });

  await t.test("restart recovery cannot insert a scheduled message twice", async () => {
    const fixture = await createFixture();
    const id = await insertDue(fixture, "restart recovery", "sending", Date.now() - 121_000);
    await Promise.all([
      dispatchDueMessages({ senderId: fixture.senderId }),
      dispatchDueMessages({ senderId: fixture.senderId }),
    ]);
    await dispatchDueMessages({ senderId: fixture.senderId });

    const row = await getScheduled(id);
    assert.equal(row?.status, "sent");
    assert.ok(row?.sent_message_id);
    assert.equal((await messageTextsForScheduled(id)).length, 1);
  });

  await t.test("revoked parental approval blocks delivery at send time", async () => {
    const childId = await createUser("child", "child");
    const contactId = await createUser("child-contact");
    const outsiderId = await createUser("child-outsider");
    const chat = await queryOne<{ id: string }>(
      `INSERT INTO vm_chats (type, name, created_by)
       VALUES ('direct', $1, $2) RETURNING id`,
      [`${runId}-child-chat`, childId],
    );
    assert.ok(chat);
    chatIds.push(chat.id);
    await query(
      `INSERT INTO vm_chat_members (chat_id, user_id)
       VALUES ($1, $2), ($1, $3)`,
      [chat.id, childId, contactId],
    );
    await query(
      `INSERT INTO vm_contact_approvals (child_id, contact_id, status)
       VALUES ($1, $2, 'approved')`,
      [childId, contactId],
    );
    const fixture = { senderId: childId, recipientId: contactId, outsiderId, chatId: chat.id };
    const id = await insertDue(fixture, "must not send");
    await query(
      `UPDATE vm_contact_approvals SET status = 'blocked'
        WHERE child_id = $1 AND contact_id = $2`,
      [childId, contactId],
    );

    await dispatchDueMessages({ senderId: fixture.senderId });
    const row = await getScheduled(id);
    assert.equal(row?.status, "failed");
    assert.match(row?.failure_reason ?? "", /blocked by a parent/i);
    assert.equal((await messageTextsForScheduled(id)).length, 0);
  });

  await t.test("messages stay pending before their due time and send afterward", async () => {
    const fixture = await createFixture();
    const now = Date.now();
    const scheduled = await queryOne<{ id: string }>(
      `INSERT INTO vm_scheduled_messages
         (sender_id, chat_id, text, scheduled_for, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'pending', $5, $5)
       RETURNING id`,
      [fixture.senderId, fixture.chatId, "timing boundary", now + 60_000, now],
    );
    assert.ok(scheduled);

    await dispatchDueMessages({ senderId: fixture.senderId });
    assert.equal((await getScheduled(scheduled.id))?.status, "pending");
    assert.equal((await messageTextsForScheduled(scheduled.id)).length, 0);

    await query(
      `UPDATE vm_scheduled_messages SET scheduled_for = $2 WHERE id = $1`,
      [scheduled.id, Date.now() - 1],
    );
    await dispatchDueMessages({ senderId: fixture.senderId });
    assert.equal((await getScheduled(scheduled.id))?.status, "sent");
    assert.equal((await messageTextsForScheduled(scheduled.id)).length, 1);
  });
});