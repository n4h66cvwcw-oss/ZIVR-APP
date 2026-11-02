/**
 * Cross-instance realtime fan-out for Autoscale deployments.
 *
 * Socket.IO rooms live in process memory. The live deployment runs on Replit
 * Autoscale, so two users can be connected to different instances. Presence is
 * stored in Postgres (vm_users.is_online) and therefore looks correct across
 * instances, but `io.to("chat:<id>")` only reaches sockets on the instance that
 * handled the send. This module relays events through Postgres LISTEN/NOTIFY so
 * every instance emits to its own local sockets.
 *
 * Privacy: NOTIFY payloads carry ids only (never message text). Receiving
 * instances re-read the canonical row from vm_messages before emitting.
 */
import { randomUUID } from "crypto";
import { Client } from "pg";
import type { Server as SocketServer } from "socket.io";
import { query, queryOne } from "./db";

export const REALTIME_CHANNEL = "zivr_realtime";
export const INSTANCE_ID = randomUUID();

/** A member whose presence row was not refreshed for this long is treated as offline for push. */
export const PRESENCE_STALE_MS = 3 * 60 * 1000;
const HEARTBEAT_MS = 60 * 1000;
const SELF_PING_MS = 30 * 1000;
const HEALTHY_WITHIN_MS = 75 * 1000;
const MAX_NOTIFY_BYTES = 7000;
/** While the bus is unhealthy every instance tails vm_messages at this rate. */
const TAIL_POLL_MS = 2000;
/** Re-scan window so clock skew between instances cannot skip a row. */
const TAIL_OVERLAP_MS = 10 * 1000;
const EMITTED_TTL_MS = 2 * 60 * 1000;
const UNHEALTHY_LOG_MS = 60 * 1000;
export const STARTED_AT = Date.now();

type Envelope =
  | { o: string; k: "msg"; id: string }
  | { o: string; k: "evt"; rooms: string[]; event: string; payload: unknown }
  | { o: string; k: "ping"; t: number };

export type FanoutMessage = {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  text: string;
  type: string;
  createdAt: number;
  localId?: string;
};

let io: SocketServer | null = null;
let listener: Client | null = null;
let lastSelfPingAt = 0;
let started = false;
let reconnectTimer: NodeJS.Timeout | null = null;
let listenerConnectedAt = 0;
let lastListenError: string | null = null;
let lastUnhealthyLogAt = 0;
let tailCursor = Date.now();
let tailRunning = false;
let tailEmitted = 0;
/** message id -> time this instance emitted it locally (dedupe bus vs tail). */
const emittedIds = new Map<string, number>();

function markEmitted(id: string, now = Date.now()): boolean {
  if (emittedIds.has(id)) return false;
  emittedIds.set(id, now);
  if (emittedIds.size > 5000) {
    for (const [k, t] of emittedIds) if (now - t > EMITTED_TTL_MS) emittedIds.delete(k);
  }
  return true;
}

/**
 * LISTEN must run on a direct (session) connection. Neon's "-pooler" endpoint
 * is PgBouncer in transaction mode: LISTEN succeeds but notifications are
 * never forwarded back, so cross-instance fan-out is silently dead.
 */
export function listenerConnectionString(env = process.env): { url: string | undefined; source: string } {
  const direct = env["DATABASE_URL_DIRECT"];
  if (direct) return { url: direct, source: "DATABASE_URL_DIRECT" };
  const raw = env["DATABASE_URL"];
  if (!raw) return { url: raw, source: "missing" };
  try {
    const u = new URL(raw);
    if (u.hostname.includes("-pooler.")) {
      u.hostname = u.hostname.replace("-pooler.", ".");
      if (u.port === "6543") u.port = "5432";
      return { url: u.toString(), source: "DATABASE_URL(pooler->direct)" };
    }
  } catch { /* fall through with the raw url */ }
  return { url: raw, source: "DATABASE_URL" };
}

function hostIsPooler(url: string | undefined): boolean {
  try { return !!url && new URL(url).hostname.includes("-pooler."); } catch { return false; }
}

/** True only when this instance has recently received its own NOTIFY round-trip. */
export function isBusHealthy(now = Date.now()): boolean {
  return lastSelfPingAt > 0 && now - lastSelfPingAt <= HEALTHY_WITHIN_MS;
}

async function memberRooms(chatId: string): Promise<string[]> {
  const members = await query<{ user_id: string }>(
    `SELECT user_id FROM vm_chat_members WHERE chat_id = $1`,
    [chatId],
  );
  // The chat room covers sockets that joined it; the per-user rooms cover a
  // member whose socket joined before this chat existed (new direct/group chat).
  // Socket.IO de-duplicates a socket that is in several of these rooms.
  return [`chat:${chatId}`, ...members.map((m) => `user:${m.user_id}`)];
}

async function emitMessageLocally(msg: FanoutMessage): Promise<void> {
  if (!io) return;
  if (!markEmitted(msg.id)) return; // already delivered by bus or tail
  const rooms = await memberRooms(msg.chatId);
  io.to(rooms).emit("message:new", msg);
}

async function hydrateMessage(id: string): Promise<FanoutMessage | null> {
  const row = await queryOne<{
    id: string; chat_id: string; sender_id: string; client_id: string | null;
    sender_name: string | null; text: string; type: string; created_at: number;
  }>(
    `SELECT m.id, m.chat_id, m.sender_id, m.client_id, u.display_name AS sender_name,
            m.text, m.type, m.created_at
       FROM vm_messages m JOIN vm_users u ON u.id = m.sender_id
      WHERE m.id = $1`,
    [id],
  );
  if (!row) return null;
  return {
    id: row.id,
    chatId: row.chat_id,
    senderId: row.sender_id,
    senderName: row.sender_name ?? "Unknown",
    text: row.text,
    type: row.type,
    createdAt: Number(row.created_at),
    localId: row.client_id ?? undefined,
  };
}

async function notify(envelope: Envelope): Promise<void> {
  const body = JSON.stringify(envelope);
  if (Buffer.byteLength(body, "utf8") > MAX_NOTIFY_BYTES) {
    console.error("[realtime-bus] payload too large for NOTIFY, dropped", envelope.k);
    return;
  }
  await query(`SELECT pg_notify($1, $2)`, [REALTIME_CHANNEL, body]);
}

/**
 * Deliver a persisted message to every connected member on every instance.
 * Emits locally first (zero added latency for same-instance peers), then relays.
 */
export async function fanoutMessage(msg: FanoutMessage): Promise<void> {
  try { await emitMessageLocally(msg); } catch (err) {
    console.error("[realtime-bus] local message emit failed", err);
  }
  try { await notify({ o: INSTANCE_ID, k: "msg", id: msg.id }); } catch (err) {
    console.error("[realtime-bus] message relay failed", err);
  }
}

/** Relay a small, content-free event (e.g. read receipts) to rooms on every instance. */
export async function fanoutEvent(rooms: string[], event: string, payload: unknown): Promise<void> {
  try { io?.to(rooms).emit(event, payload); } catch { /* best effort */ }
  try { await notify({ o: INSTANCE_ID, k: "evt", rooms, event, payload }); } catch (err) {
    console.error("[realtime-bus] event relay failed", err);
  }
}

export async function handleEnvelope(raw: string | undefined): Promise<void> {
  if (!raw) return;
  let env: Envelope;
  try { env = JSON.parse(raw) as Envelope; } catch { return; }
  if (env.k === "ping") {
    if (env.o === INSTANCE_ID) lastSelfPingAt = Date.now();
    return;
  }
  if (env.o === INSTANCE_ID) return; // already emitted locally
  if (env.k === "msg") {
    const msg = await hydrateMessage(env.id);
    if (msg) await emitMessageLocally(msg);
    return;
  }
  if (env.k === "evt" && Array.isArray(env.rooms) && typeof env.event === "string") {
    io?.to(env.rooms).emit(env.event, env.payload);
  }
}

async function connectListener(): Promise<void> {
  const { url, source } = listenerConnectionString();
  const client = new Client({ connectionString: url });
  client.on("notification", (n) => {
    if (n.channel !== REALTIME_CHANNEL) return;
    void handleEnvelope(n.payload).catch((err) => console.error("[realtime-bus] handle failed", err));
  });
  const scheduleReconnect = () => {
    if (listener === client) listener = null;
    lastSelfPingAt = 0;
    client.end().catch(() => {});
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      void connectListener().catch((err) => {
        console.error("[realtime-bus] reconnect failed", err?.message ?? err);
        scheduleReconnect();
      });
    }, 5000);
    reconnectTimer.unref();
  };
  client.on("error", (err) => {
    lastListenError = err.message;
    console.error("[realtime-bus] listener error", err.message);
    scheduleReconnect();
  });
  client.on("end", scheduleReconnect);
  await client.connect();
  await client.query(`LISTEN ${REALTIME_CHANNEL}`);
  // The HTTP server is what should keep the process alive. Integration tests
  // call attachSocket() and then close that server; a ref'd LISTEN socket
  // would leave the test runner hanging.
  const stream = (client as unknown as { connection?: { stream?: { unref?: () => void } } }).connection?.stream;
  stream?.unref?.();
  listener = client;
  listenerConnectedAt = Date.now();
  lastListenError = null;
  console.log(`[realtime-bus] LISTEN ${REALTIME_CHANNEL} connected via ${source}${hostIsPooler(url) ? " (WARNING: pooler host)" : ""} instance=${INSTANCE_ID}`);
  await notify({ o: INSTANCE_ID, k: "ping", t: Date.now() }).catch(() => {});
}

/** Mark users with a live socket on this instance as online, and expire stale rows. */
export async function presenceHeartbeat(now = Date.now()): Promise<void> {
  if (!io) return;
  const sockets = await io.local.fetchSockets();
  const userIds = [...new Set(
    sockets.map((s) => (s.data as { userId?: string } | undefined)?.userId).filter((id): id is string => !!id),
  )];
  if (userIds.length > 0) {
    await query(
      `UPDATE vm_users SET is_online = true, last_seen = $1 WHERE id = ANY($2::uuid[])`,
      [now, userIds],
    );
  }
  // Instances that were scaled down or crashed never ran their disconnect
  // handlers; without this their users would look online (and skip push) forever.
  await query(
    `UPDATE vm_users SET is_online = false
      WHERE is_online = true AND COALESCE(last_seen, 0) < $1`,
    [now - PRESENCE_STALE_MS - HEARTBEAT_MS],
  );
}

/**
 * Push tokens for chat members (excluding the sender) who should get a push:
 * offline, presence row stale, or - while the cross-instance bus is not proven
 * healthy - everyone, so a message can never be silently undelivered.
 */
export async function pushTokensForChat(chatId: string, senderId: string, now = Date.now()): Promise<string[]> {
  const includeOnline = !isBusHealthy(now);
  const rows = await query<{ push_token: string | null }>(
    `SELECT u.push_token FROM vm_chat_members cm
       JOIN vm_users u ON u.id = cm.user_id
      WHERE cm.chat_id = $1 AND cm.user_id != $2
        AND ($3::boolean OR u.is_online = false OR COALESCE(u.last_seen, 0) < $4)`,
    [chatId, senderId, includeOnline, now - PRESENCE_STALE_MS],
  );
  return rows
    .map((r) => r.push_token)
    .filter((t): t is string => !!t && t.startsWith("ExponentPushToken"));
}

/**
 * Server-only safety net that needs no LISTEN: while the bus is not proven
 * healthy, each instance with connected sockets re-reads recent vm_messages and
 * emits rows it has not already emitted. Clients de-duplicate by message id.
 */
export async function tailRecentMessages(now = Date.now()): Promise<number> {
  if (!io || tailRunning) return 0;
  tailRunning = true;
  try {
    const since = tailCursor - TAIL_OVERLAP_MS;
    const rows = await query<{ id: string; created_at: number }>(
      `SELECT id, created_at FROM vm_messages
        WHERE created_at > $1 ORDER BY created_at ASC LIMIT 500`,
      [since],
    );
    let emitted = 0;
    for (const row of rows) {
      const created = Number(row.created_at);
      if (created > tailCursor) tailCursor = Math.min(created, now);
      if (emittedIds.has(row.id)) continue;
      const msg = await hydrateMessage(row.id);
      if (!msg) continue;
      await emitMessageLocally(msg);
      emitted += 1;
    }
    tailEmitted += emitted;
    return emitted;
  } finally {
    tailRunning = false;
  }
}

async function localSocketCount(): Promise<number> {
  if (!io) return 0;
  try { return (await io.local.fetchSockets()).length; } catch { return 0; }
}

/** Content-free diagnostics for /api/healthz/realtime. */
export async function getRealtimeStatus(now = Date.now()) {
  const { url, source } = listenerConnectionString();
  return {
    instanceId: INSTANCE_ID,
    startedAt: STARTED_AT,
    busHealthy: isBusHealthy(now),
    listenerConnected: !!listener,
    listenerConnectedAt: listenerConnectedAt || null,
    lastSelfPingAgoMs: lastSelfPingAt ? now - lastSelfPingAt : null,
    listenerSource: source,
    listenerHostIsPooler: hostIsPooler(url),
    appDbHostIsPooler: hostIsPooler(process.env["DATABASE_URL"]),
    lastListenError,
    tailFallbackActive: !isBusHealthy(now),
    tailEmitted,
    localSockets: await localSocketCount(),
    bundle: "live-message-fanout-v2",
  };
}

export function startRealtimeBus(server: SocketServer): void {
  io = server;
  if (started) return;
  started = true;
  const tryConnect = (): void => {
    void connectListener().catch((err) => {
      lastListenError = String(err?.message ?? err);
      console.error("[realtime-bus] LISTEN failed; push + db-tail fallback active", err?.message ?? err);
      if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => { reconnectTimer = null; tryConnect(); }, 5000);
        reconnectTimer.unref();
      }
    });
  };
  tryConnect();
  setInterval(() => {
    if (listener) void notify({ o: INSTANCE_ID, k: "ping", t: Date.now() }).catch(() => {});
  }, SELF_PING_MS).unref();
  setInterval(() => {
    const now = Date.now();
    if (isBusHealthy(now)) { tailCursor = now; return; }
    if (now - lastUnhealthyLogAt >= UNHEALTHY_LOG_MS) {
      lastUnhealthyLogAt = now;
      console.error(`[realtime-bus] UNHEALTHY instance=${INSTANCE_ID} listener=${!!listener} lastSelfPingAgoMs=${lastSelfPingAt ? now - lastSelfPingAt : "never"} err=${lastListenError ?? "none"}; cross-instance in-app delivery via db-tail fallback, push to all members`);
    }
    void localSocketCount().then((n) => (n > 0 ? tailRecentMessages(now) : 0))
      .catch((err) => console.error("[realtime-bus] tail failed", err?.message ?? err));
  }, TAIL_POLL_MS).unref();
  setInterval(() => {
    void presenceHeartbeat().catch((err) => console.error("[realtime-bus] heartbeat failed", err));
  }, HEARTBEAT_MS).unref();
}

/** Test hook. */
export function __setIOForTests(server: SocketServer | null): void { io = server; }
