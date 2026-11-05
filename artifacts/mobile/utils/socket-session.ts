/**
 * Pure helpers for the realtime socket session (ServerContext).
 *
 * "Connected" in the UI means the server accepted `user:join` (we got
 * `user:joined`), not merely that the websocket transport is open. A socket
 * whose join failed (bad/missing token, server error) is in no chat rooms and
 * will never receive `message:new`, so it must not be treated as ready.
 */

/** How far back a `since` catch-up may reach (server replays all chats). */
export const MAX_CATCH_UP_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
/** Device-clock fallbacks are pulled back by this much to absorb clock skew. */
export const DEVICE_CLOCK_SKEW_MARGIN_MS = 60 * 1000;
/** If no `user:joined` arrives this long after `user:join`, re-send it. */
export const JOIN_ACK_TIMEOUT_MS = 8000;
export const MAX_JOIN_ATTEMPTS = 5;
/**
 * Backgrounded longer than this, the OS has likely frozen the websocket while
 * `socket.connected` still reads true (zombie). Force a fresh transport.
 */
export const FORCE_RECONNECT_AFTER_BACKGROUND_MS = 20 * 1000;

export type SinceInputs = {
  /**
   * Device time at which we SENT the most recent user:join that the server
   * acknowledged (user:joined). The server answered that join with every
   * message up to roughly that moment, so history before it is complete.
   */
  lastCaughtUpAt: number | null;
  /** Newest server `createdAt` this device has received (server clock). */
  lastSeenMessageAt: number | null;
  /** Device time when the socket last dropped. */
  lastDisconnectAt: number | null;
  /** Device time when the app last went to background. */
  lastBackgroundAt: number | null;
  now: number;
};

/**
 * The `since` value for `user:join`, or undefined when we have nothing to
 * anchor on (first launch with no history; REST history covers that).
 *
 * Why not just "newest message seen": if live fan-out drops message A in
 * chat 1 but later delivers B in chat 2, anchoring on B would skip A forever.
 * The last acknowledged catch-up is the newest point we KNOW is complete.
 * Device-clock anchors are pulled back by a skew margin. Replays are
 * de-duplicated by message id in MessagingContext, so erring early is safe.
 */
export function computeJoinSince(input: SinceInputs): number | undefined {
  const valid = (v: number | null): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;
  const floor = input.now - MAX_CATCH_UP_LOOKBACK_MS;
  let since: number | undefined;
  if (valid(input.lastCaughtUpAt)) {
    since = input.lastCaughtUpAt - DEVICE_CLOCK_SKEW_MARGIN_MS;
  } else if (valid(input.lastSeenMessageAt)) {
    since = input.lastSeenMessageAt;
  } else {
    const markers = [input.lastDisconnectAt, input.lastBackgroundAt].filter(valid);
    if (markers.length) since = Math.min(...markers) - DEVICE_CLOCK_SKEW_MARGIN_MS;
  }
  if (since === undefined) return undefined;
  return Math.max(since, floor);
}

/** Server `error` payloads that mean user:join was rejected / we are unjoined. */
export function isJoinAuthError(payload: unknown): boolean {
  const message = typeof payload === "string"
    ? payload
    : typeof (payload as { message?: unknown } | null)?.message === "string"
      ? (payload as { message: string }).message
      : "";
  return /authentication failed|not authenticated/i.test(message);
}

export function advanceLastSeen(prev: number | null, createdAt: unknown): number | null {
  const ts = typeof createdAt === "number" ? createdAt : Number(createdAt);
  if (!Number.isFinite(ts) || ts <= 0) return prev;
  return prev === null || ts > prev ? ts : prev;
}

export function shouldForceReconnect(backgroundedAt: number | null, now: number): boolean {
  return backgroundedAt !== null && now - backgroundedAt >= FORCE_RECONNECT_AFTER_BACKGROUND_MS;
}

export function joinPayload(userId: string, since: number | undefined): string | { userId: string; since: number } {
  return since ? { userId, since } : userId;
}

export function lastSeenStorageKey(userId: string): string {
  return `@zivr_last_seen_message_at:${userId}`;
}

export function lastCaughtUpStorageKey(userId: string): string {
  return `@zivr_last_caught_up_at:${userId}`;
}

export type SocketDiagnostics = {
  serverUrl: string;
  userId: string | null;
  socketId: string | null;
  transportConnected: boolean;
  userJoined: boolean;
  joinAttempts: number;
  lastJoinSentAt: number | null;
  lastJoinSince: number | null;
  lastJoinedAt: number | null;
  joinedRoomCount: number | null;
  lastMessageNewAt: number | null;
  lastMissedBatchSize: number | null;
  lastSeenMessageAt: number | null;
  lastCaughtUpAt: number | null;
  lastError: string | null;
  lastErrorAt: number | null;
};

export function emptyDiagnostics(serverUrl: string): SocketDiagnostics {
  return {
    serverUrl,
    userId: null,
    socketId: null,
    transportConnected: false,
    userJoined: false,
    joinAttempts: 0,
    lastJoinSentAt: null,
    lastJoinSince: null,
    lastJoinedAt: null,
    joinedRoomCount: null,
    lastMessageNewAt: null,
    lastMissedBatchSize: null,
    lastSeenMessageAt: null,
    lastCaughtUpAt: null,
    lastError: null,
    lastErrorAt: null,
  };
}
