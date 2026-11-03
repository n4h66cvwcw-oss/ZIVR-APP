export type ReactionMap = Record<string, string[]>;

export type ReactionWrite =
  | { kind: "link"; chatId: string; localId: string; serverId: string; reactions?: ReactionMap }
  | { kind: "snapshot"; chatId: string; messageId: string; clientId?: string; reactions: ReactionMap };

type ReactionCarrier = {
  id: string;
  /** Sender localId. The reaction fanout calls this `clientId`. */
  localId?: string;
  /** Server `vm_messages.id` once the send echo or a reaction payload teaches it. */
  serverMessageId?: string;
  reactions?: ReactionMap;
};

export function cloneReactions(reactions: ReactionMap | undefined): ReactionMap {
  const next: ReactionMap = {};
  for (const [emoji, users] of Object.entries(reactions ?? {})) {
    next[emoji] = [...users];
  }
  return next;
}

/** Accept a history/socket reactions map. `null` means the field was unusable and must be ignored. */
export function normalizeReactions(input: unknown): ReactionMap | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const next: ReactionMap = {};
  for (const [emoji, users] of Object.entries(input as Record<string, unknown>)) {
    if (!Array.isArray(users)) continue;
    next[emoji] = users.filter((id): id is string => typeof id === "string");
  }
  return next;
}

export function sameReactions(left: ReactionMap | undefined, right: ReactionMap | undefined): boolean {
  const a = left ?? {};
  const b = right ?? {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    const usersA = a[key] ?? [];
    const usersB = b[key] ?? [];
    if (usersA.length !== usersB.length) return false;
    for (let i = 0; i < usersA.length; i += 1) {
      if (usersA[i] !== usersB[i]) return false;
    }
  }
  return true;
}

/** Optimistic toggle. The same emoji from the same user adds, then removes. */
export function toggleReaction(reactions: ReactionMap | undefined, userId: string, emoji: string): ReactionMap {
  const next = cloneReactions(reactions);
  const current = next[emoji] ?? [];
  if (current.includes(userId)) next[emoji] = current.filter((id) => id !== userId);
  else next[emoji] = [...current, userId];
  return next;
}

/**
 * Same logical message has different ids on each phone.
 * Recipient: `message.id` is the server uuid (`messageId`).
 * Sender: `message.id` or `message.localId` is the client localId (`clientId`).
 * `serverMessageId` is also accepted once this phone has learned the uuid.
 */
export function messageMatchesReaction(
  message: ReactionCarrier,
  messageId?: string,
  clientId?: string,
): boolean {
  if (messageId && (message.id === messageId || message.serverMessageId === messageId)) return true;
  if (clientId && (message.id === clientId || message.localId === clientId)) return true;
  return false;
}

export function hasServerMessage<T extends ReactionCarrier>(
  messages: Record<string, T[]>,
  chatId: string,
  messageId: string,
  clientId?: string,
): boolean {
  return (messages[chatId] ?? []).some((message) => messageMatchesReaction(message, messageId, clientId));
}

/**
 * Replace matching messages' reactions with the server snapshot.
 * Matching `messageId` or `clientId` is idempotent: a repeat event does not toggle again.
 * When the sender's local id matches `clientId`, remember `messageId` as the server uuid.
 */
export function applyReactionSnapshot<T extends ReactionCarrier>(
  messages: Record<string, T[]>,
  chatId: string,
  messageId: string,
  reactions: ReactionMap | undefined,
  clientId?: string,
): Record<string, T[]> {
  const normalized = normalizeReactions(reactions);
  if (!normalized) return messages;
  const chatMessages = messages[chatId];
  if (!chatMessages) return messages;
  let changed = false;
  const updated = chatMessages.map((message) => {
    if (!messageMatchesReaction(message, messageId, clientId)) return message;
    const serverMessageId = message.serverMessageId
      ?? (messageId && messageId !== message.id ? messageId : undefined);
    const localId = message.localId ?? clientId;
    if (
      sameReactions(message.reactions, normalized)
      && serverMessageId === message.serverMessageId
      && localId === message.localId
    ) return message;
    changed = true;
    return {
      ...message,
      ...(localId ? { localId } : {}),
      ...(serverMessageId ? { serverMessageId } : {}),
      reactions: cloneReactions(normalized),
    };
  });
  if (!changed) return messages;
  return { ...messages, [chatId]: updated };
}

/** Remember `vm_messages.id` on the sender's local copy without replacing the client id. */
export function linkServerMessageId<T extends ReactionCarrier>(
  messages: Record<string, T[]>,
  chatId: string,
  localId: string,
  serverId: string,
  reactions?: ReactionMap,
): Record<string, T[]> {
  const chatMessages = messages[chatId];
  if (!chatMessages || !localId || !serverId) return messages;
  const normalized = reactions === undefined ? undefined : normalizeReactions(reactions) ?? undefined;
  let changed = false;
  const updated = chatMessages.map((message) => {
    if (message.id !== localId && message.localId !== localId && message.serverMessageId !== serverId) return message;
    const nextReactions = normalized ?? message.reactions;
    const nextLocalId = message.localId ?? localId;
    if (
      message.serverMessageId === serverId
      && nextLocalId === message.localId
      && sameReactions(message.reactions, nextReactions)
    ) return message;
    changed = true;
    return {
      ...message,
      localId: nextLocalId,
      serverMessageId: serverId,
      ...(nextReactions ? { reactions: cloneReactions(nextReactions) } : {}),
    };
  });
  if (!changed) return messages;
  return { ...messages, [chatId]: updated };
}

export function applyReactionWrites<T extends ReactionCarrier>(
  messages: Record<string, T[]>,
  writes: ReactionWrite[],
): Record<string, T[]> {
  return writes.reduce((current, write) => {
    if (write.kind === "link") {
      return linkServerMessageId(current, write.chatId, write.localId, write.serverId, write.reactions);
    }
    return applyReactionSnapshot(current, write.chatId, write.messageId, write.reactions, write.clientId);
  }, messages);
}

export function localFieldsFromServerMessage(msg: {
  id: string;
  chatId: string;
  text: string;
  senderId: string;
  createdAt: number;
  localId?: string;
  clientId?: string;
  reactions?: ReactionMap;
}): {
  id: string;
  chatId: string;
  text: string;
  senderId: string;
  timestamp: number;
  read: false;
  localId?: string;
  reactions?: ReactionMap;
} {
  const reactions = normalizeReactions(msg.reactions) ?? undefined;
  const localId = msg.localId ?? msg.clientId;
  return {
    id: msg.id,
    chatId: msg.chatId,
    text: msg.text,
    senderId: msg.senderId,
    timestamp: msg.createdAt,
    read: false,
    ...(localId ? { localId } : {}),
    ...(reactions && Object.keys(reactions).length > 0 ? { reactions } : {}),
  };
}

/**
 * Path id for `POST /api/chats/:chatId/messages/:messageId/reactions`.
 * Prefer the server uuid. When the echo has not arrived, this is the local
 * message id (the `localId` / reaction `clientId` for a message this phone sent).
 */
export function reactionPostId(
  message: { id: string; serverMessageId?: string } | undefined,
  fallbackId: string,
): string {
  return message?.serverMessageId || message?.id || fallbackId;
}
