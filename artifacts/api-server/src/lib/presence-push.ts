/**
 * Presence vs push. A Socket.IO connection is not proof the app is showing
 * the message: iOS can keep the socket up in the background while
 * presenceHeartbeat refreshes vm_users.is_online and last_seen. That used to
 * suppress APNs until the recipient opened ZIVR.
 *
 * Push selection therefore does not skip "online" members and has no grace
 * window. The client can still tell us the app is backgrounded by emitting
 * USER_AWAY_EVENT so the green dot is not stuck on.
 */

/** Client emits this with no payload when AppState leaves "active".
 *  The socket stays connected. Foreground return is the existing user:join. */
export const USER_AWAY_EVENT = "user:away";

export type SocketPresence = "active" | "away";

export type PushMember = {
  pushToken: string | null;
  isOnline: boolean;
  lastSeen: number | null;
};

export type PushSelectionContext = {
  /** Unhealthy bus still includes every token. A healthy bus does too. */
  busHealthy: boolean;
  now: number;
};

/** Members other than the sender. Presence columns are selected for the
 *  policy; the WHERE clause must not filter on is_online or last_seen. */
export const PUSH_TOKENS_FOR_CHAT_SQL = `SELECT u.push_token, u.is_online, u.last_seen
     FROM vm_chat_members cm
     JOIN vm_users u ON u.id = cm.user_id
    WHERE cm.chat_id = $1 AND cm.user_id != $2`;

export function isExpoPushToken(token: string | null | undefined): token is string {
  return typeof token === "string" && token.startsWith("ExponentPushToken");
}

/**
 * Expo token for this member, or null when there is nothing to send.
 * Online, offline, stale, and a healthy or unhealthy bus all include a
 * valid token. There is no interval after last_seen during which push is
 * withheld.
 */
export function pushTokenForMember(member: PushMember, _ctx: PushSelectionContext): string | null {
  if (!isExpoPushToken(member.pushToken)) return null;
  return member.pushToken;
}

export function selectPushTokens(members: readonly PushMember[], ctx: PushSelectionContext): string[] {
  return members
    .map((member) => pushTokenForMember(member, ctx))
    .filter((token): token is string => token != null);
}

export function readSocketPresence(data: unknown): SocketPresence {
  if (data && typeof data === "object" && (data as { presence?: unknown }).presence === "away") {
    return "away";
  }
  return "active";
}

/** True when at least one of these sockets is still in the foreground. */
export function accountIsOnline(presences: readonly SocketPresence[]): boolean {
  return presences.some((presence) => presence !== "away");
}

/** User ids whose sockets should refresh vm_users.is_online. Away sockets
 *  are omitted so a backgrounded connection cannot resurrect presence. */
export function foregroundUserIds(
  sockets: readonly { userId?: string; presence?: string }[],
): string[] {
  const ids = new Set<string>();
  for (const socket of sockets) {
    if (!socket.userId) continue;
    if (socket.presence === "away") continue;
    ids.add(socket.userId);
  }
  return [...ids];
}
