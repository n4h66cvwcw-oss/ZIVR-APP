export type CheckinReplyState = {
  id: string;
  clientId?: string;
  timestamp: number;
  read?: boolean;
  [key: string]: unknown;
};

export type CheckinBroadcastState = {
  id: string;
  timestamp: number;
  replies: Record<string, CheckinReplyState[]>;
  progress?: { total: number; replied: number };
  isServerBroadcast?: boolean;
  senderId?: string;
  [key: string]: unknown;
};

export function shouldMarkCheckinRepliesRead(
  broadcast: Pick<CheckinBroadcastState, "isServerBroadcast" | "senderId" | "replies"> | undefined,
  currentUserId: string | null,
): boolean {
  if (!broadcast || !currentUserId || !broadcast.isServerBroadcast || broadcast.senderId !== currentUserId) {
    return false;
  }
  return Object.values(broadcast.replies ?? {}).some((replies) => replies.some((reply) => reply.read !== true));
}

/** Merge server/cache state without allowing an older snapshot to regress it. */
export function mergeCheckinBroadcast(
  current: CheckinBroadcastState | undefined,
  incoming: CheckinBroadcastState,
): CheckinBroadcastState {
  if (!current) return incoming;
  const replies: Record<string, CheckinReplyState[]> = { ...current.replies };
  for (const [memberId, incomingReplies] of Object.entries(incoming.replies ?? {})) {
    const existing = replies[memberId] ?? [];
    const byId = new Map(existing.map((reply) => [reply.id, reply]));
    for (const reply of incomingReplies) byId.set(reply.id, { ...byId.get(reply.id), ...reply });
    replies[memberId] = [...byId.values()].sort((a, b) => a.timestamp - b.timestamp);
  }
  const newer = incoming.timestamp >= current.timestamp;
  const currentProgress = current.progress;
  const incomingProgress = incoming.progress;
  return {
    ...current,
    ...(newer ? incoming : {}),
    id: current.id,
    timestamp: Math.max(current.timestamp, incoming.timestamp),
    replies,
    progress: currentProgress || incomingProgress
      ? {
          total: Math.max(currentProgress?.total ?? 0, incomingProgress?.total ?? 0),
          replied: Math.max(currentProgress?.replied ?? 0, incomingProgress?.replied ?? 0),
        }
      : undefined,
  };
}

export function mergeCheckinBroadcasts<T extends CheckinBroadcastState>(
  current: T[],
  incoming: T[],
): T[] {
  const merged = new Map(current.map((broadcast) => [broadcast.id, broadcast]));
  for (const broadcast of incoming) {
    merged.set(broadcast.id, mergeCheckinBroadcast(merged.get(broadcast.id), broadcast) as T);
  }
  return [...merged.values()].sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Legacy check-ins are migrated only when they are explicitly server-backed
 * and owned by the active identity. Unmarked/local/simulated records remain
 * in the legacy cache and are never uploaded or attributed to another user.
 */
export function migrateLegacyCheckins<
  G extends {
  isServerGroup?: boolean;
  creatorId?: string;
  },
  B extends {
    isServerBroadcast?: boolean;
    senderId?: string;
  },
>(
  groups: G[],
  broadcasts: B[],
  activeUserId: string,
): { groups: G[]; broadcasts: B[]; legacyGroups: G[]; legacyBroadcasts: B[] } {
  const eligibleGroup = (group: G) => group.isServerGroup === true && group.creatorId === activeUserId;
  const eligibleBroadcast = (broadcast: B) =>
    broadcast.isServerBroadcast === true && broadcast.senderId === activeUserId;
  return {
    groups: groups.filter(eligibleGroup),
    broadcasts: broadcasts.filter(eligibleBroadcast),
    legacyGroups: groups.filter((group) => !eligibleGroup(group)),
    legacyBroadcasts: broadcasts.filter((broadcast) => !eligibleBroadcast(broadcast)),
  };
}