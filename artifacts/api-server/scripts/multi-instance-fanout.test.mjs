// Multi-instance delivery proof (synthetic data only, local Postgres only).
// Spawns TWO api-server processes against the same DB (like Replit Autoscale),
// connects sender to instance A and recipient to instance B, and asserts the
// recipient gets message:new for (1) socket send, (2) REST send, and (3) a
// brand-new direct chat created AFTER the recipient connected.
//   DATABASE_URL=postgres://... SESSION_SECRET=x node scripts/multi-instance-fanout.test.mjs [distEntry]
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import test from "node:test";
import pg from "pg";
import { io } from "socket.io-client";

const DB = process.env.DATABASE_URL;
const SECRET = process.env.SESSION_SECRET;
assert.ok(DB && SECRET, "DATABASE_URL and SESSION_SECRET required");
assert.ok(!/replit|neon/i.test(DB), "refusing to run against a hosted database");
const entry = process.argv[2] ?? new URL("../dist/index.mjs", import.meta.url).pathname;
const sign = (id) => `${id}.${crypto.createHmac("sha256", SECRET).update(id).digest("hex")}`;
const pool = new pg.Pool({ connectionString: DB });
const procs = [];

function startInstance(port) {
  return new Promise((resolve, reject) => {
    const p = spawn("node", [entry], { env: { ...process.env, ...(process.env.FANOUT_DEAD_BUS ? { DATABASE_URL_DIRECT: "postgres://nobody@127.0.0.1:1/none" } : {}), PORT: String(port), NODE_ENV: "production" }, stdio: ["ignore", "pipe", "pipe"] });
    procs.push(p);
    const t = setTimeout(() => reject(new Error(`instance ${port} did not start`)), 20000);
    const onData = (d) => { if (String(d).includes("Server listening")) { clearTimeout(t); resolve(); } };
    p.stdout.on("data", onData); p.stderr.on("data", onData);
    p.on("exit", (c) => reject(new Error(`instance ${port} exited ${c}`)));
  });
}

async function user(label) {
  const r = await pool.query(`INSERT INTO vm_users (display_name, username) VALUES ($1,$1) RETURNING id`, [`synthetic-${label}-${crypto.randomUUID().slice(0, 6)}`]);
  return r.rows[0].id;
}

function connect(port, userId) {
  return new Promise((resolve, reject) => {
    const s = io(`http://127.0.0.1:${port}`, { path: "/api/socket.io", transports: ["websocket"], auth: { token: sign(userId) }, forceNew: true });
    s.on("connect", () => s.emit("user:join", userId));
    s.on("user:joined", () => resolve(s));
    s.on("connect_error", reject);
  });
}

function nextMessage(s, ms = process.env.FANOUT_DEAD_BUS ? 8000 : 4000) {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms);
    s.once("message:new", (m) => { clearTimeout(t); resolve(m); });
  });
}

const A = 18431, B = 18432;
let alice, bob;
test.before(async () => {
  await startInstance(A);
  await startInstance(B);
  alice = await user("alice");
  bob = await user("bob");
  await new Promise((r) => setTimeout(r, 1500)); // let LISTEN + self-ping settle
});
test.after(async () => { procs.forEach((p) => p.kill()); await pool.end(); });

test("new direct chat created after recipient connected, cross-instance socket send", async () => {
  const sb = await connect(B, bob);         // recipient on instance B, before chat exists
  const sa = await connect(A, alice);       // sender on instance A
  const res = await fetch(`http://127.0.0.1:${A}/api/chats/direct`, {
    method: "POST", headers: { "content-type": "application/json", "x-auth-token": sign(alice) },
    body: JSON.stringify({ myUserId: alice, theirUserId: bob }),
  });
  assert.equal(res.status, 200);
  const { chatId } = await res.json();
  sa.emit("chat:join", chatId);
  await new Promise((r) => setTimeout(r, 200));
  const got = nextMessage(sb);
  const ack = await sa.timeout(5000).emitWithAck("message:send", { chatId, text: "synthetic ping 1", localId: crypto.randomUUID() });
  assert.equal(ack.ok, true);
  const m = await got;
  assert.ok(m, "recipient on other instance never received message:new");
  assert.equal(m.chatId, chatId);

  // REST durable path, recipient still on B
  const got2 = nextMessage(sb);
  const r2 = await fetch(`http://127.0.0.1:${A}/api/chats/${chatId}/messages`, {
    method: "POST", headers: { "content-type": "application/json", "x-auth-token": sign(alice) },
    body: JSON.stringify({ text: "synthetic ping 2", clientId: crypto.randomUUID() }),
  });
  assert.equal(r2.status, 200);
  assert.ok(await got2, "REST send not delivered cross-instance");
  sa.close(); sb.close();
});

test("realtime health route reports this instance", async () => {
  const r = await fetch(`http://127.0.0.1:${A}/api/healthz/realtime`);
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(typeof j.instanceId, "string");
  assert.equal(j.busHealthy, !process.env.FANOUT_DEAD_BUS);
  assert.equal(j.tailFallbackActive, !!process.env.FANOUT_DEAD_BUS);
  const h = await (await fetch(`http://127.0.0.1:${A}/api/healthz`)).json();
  assert.deepEqual(h, { status: "ok" });
});

test("multi-socket: closing one of two sockets keeps the user online", async () => {
  const s1 = await connect(A, bob);
  const s2 = await connect(A, bob);
  s1.close();
  await new Promise((r) => setTimeout(r, 500));
  const r = await pool.query(`SELECT is_online FROM vm_users WHERE id = $1`, [bob]);
  assert.equal(r.rows[0].is_online, true);
  s2.close();
  await new Promise((r) => setTimeout(r, 500));
  const r2 = await pool.query(`SELECT is_online FROM vm_users WHERE id = $1`, [bob]);
  assert.equal(r2.rows[0].is_online, false);
});
