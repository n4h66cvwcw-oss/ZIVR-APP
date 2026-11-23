export type NotificationMessage = {
  chatId: string;
  /** Server message id, when the payload has one. Used to skip remote-push duplicates. */
  messageId?: string;
  senderId: string;
  senderName?: string;
  text: string;
};

export type NotificationChatSettings = {
  id: string;
  isMuted?: boolean;
  notificationSound?: string;
};

export type ChatNotificationData = {
  type: "chat_message";
  chatId: string;
  messageIds: string[];
  messageId?: string;
};

export type NotificationRequest = {
  title: string;
  body: string;
  sound: string;
  data: ChatNotificationData;
};

export type MissedNotificationOptions = {
  /** Chat currently on screen. Missed banners for this chat are dropped. */
  activeChatId?: string | null;
  /** Message ids already shown via a remote push. */
  deliveredMessageIds?: ReadonlySet<string>;
};

function getSound(chat: NotificationChatSettings | undefined): string {
  return chat?.notificationSound ?? "default";
}

function isSuppressed(chat: NotificationChatSettings | undefined, sound: string): boolean {
  return chat?.isMuted === true || sound === "none";
}

function chatNotificationData(chatId: string, messageIds: string[]): ChatNotificationData {
  const data: ChatNotificationData = {
    type: "chat_message",
    chatId,
    messageIds,
  };
  const messageId = messageIds[messageIds.length - 1];
  if (messageId) data.messageId = messageId;
  return data;
}

export function chatIdFromNotificationData(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const chatId = (data as { chatId?: unknown }).chatId;
  return typeof chatId === "string" && chatId.length > 0 ? chatId : null;
}

export function messageIdsFromNotificationData(data: unknown): string[] {
  if (!data || typeof data !== "object") return [];
  const record = data as { messageId?: unknown; messageIds?: unknown };
  const ids: string[] = [];
  const push = (value: unknown) => {
    if (typeof value === "string" && value.length > 0 && !ids.includes(value)) ids.push(value);
  };
  push(record.messageId);
  if (Array.isArray(record.messageIds)) {
    for (const value of record.messageIds) push(value);
  }
  return ids;
}

/**
 * Route for a notification tap. Scheduled approvals and other typed payloads
 * are left to their own handlers. A missing chat id is not an error.
 */
export function routeForChatNotification(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const type = (data as { type?: unknown }).type;
  if (typeof type === "string" && type !== "chat_message") return null;
  const chatId = chatIdFromNotificationData(data);
  if (!chatId) return null;
  return `/chat/${chatId}`;
}

/** Returns the chat route once per response id. Missing chatId yields null. */
export function consumeChatNotificationRoute(
  responseId: string,
  data: unknown,
  handledResponseIds: Set<string>,
): string | null {
  if (responseId && handledResponseIds.has(responseId)) return null;
  const route = routeForChatNotification(data);
  if (!route) return null;
  if (responseId) handledResponseIds.add(responseId);
  return route;
}

export function isChatMessageNotification(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const type = (data as { type?: unknown }).type;
  if (typeof type === "string" && type !== "chat_message") return false;
  return chatIdFromNotificationData(data) !== null;
}

export function partitionPresentedNotifications(
  presented: Array<{ identifier: string; data: unknown }>,
  chatId: string,
): { dismissIds: string[]; remainingBadgeCount: number } {
  const dismissIds: string[] = [];
  let remainingBadgeCount = 0;
  for (const item of presented) {
    if (!isChatMessageNotification(item.data)) continue;
    if (chatIdFromNotificationData(item.data) === chatId) dismissIds.push(item.identifier);
    else remainingBadgeCount += 1;
  }
  return { dismissIds, remainingBadgeCount };
}

/**
 * Build one local notification for each chat represented in a missed-message
 * replay. Messages in a chat are summarized so reconnecting cannot create one
 * notification per replayed message. Messages already delivered by remote push,
 * and messages for the chat on screen, are omitted.
 */
export function buildMissedMessageNotifications(
  messages: NotificationMessage[],
  chats: NotificationChatSettings[],
  options: MissedNotificationOptions = {},
): NotificationRequest[] {
  const delivered = options.deliveredMessageIds;
  const chatById = new Map(chats.map((chat) => [chat.id, chat]));
  const groups = new Map<string, {
    count: number;
    senderId: string;
    senderName: string;
    lastText: string;
    hasMultipleSenders: boolean;
    messageIds: string[];
  }>();

  for (const message of messages) {
    if (options.activeChatId && message.chatId === options.activeChatId) continue;
    if (message.messageId && delivered?.has(message.messageId)) continue;

    const senderName = message.senderName || "New message";
    const existing = groups.get(message.chatId);
    const messageIds = message.messageId ? [message.messageId] : [];
    groups.set(message.chatId, existing
      ? {
          ...existing,
          count: existing.count + 1,
          lastText: message.text,
          hasMultipleSenders: existing.hasMultipleSenders || existing.senderId !== message.senderId,
          messageIds: message.messageId
            ? [...existing.messageIds, message.messageId]
            : existing.messageIds,
        }
      : {
          count: 1,
          senderId: message.senderId,
          senderName,
          lastText: message.text,
          hasMultipleSenders: false,
          messageIds,
        });
  }

  const requests: NotificationRequest[] = [];
  groups.forEach((group, chatId) => {
    const sound = getSound(chatById.get(chatId));
    if (isSuppressed(chatById.get(chatId), sound)) return;

    const title = group.count === 1
      ? group.senderName
      : group.hasMultipleSenders
        ? `${group.count} new messages`
        : `${group.count} new messages from ${group.senderName}`;
    requests.push({
      title,
      body: group.lastText,
      sound,
      data: chatNotificationData(chatId, group.messageIds),
    });
  });
  return requests;
}

/**
 * Live messages are never grouped. Return one request per message unless the
 * chat is muted or explicitly configured as silent.
 */
export function buildLiveMessageNotification(
  message: NotificationMessage,
  chat: NotificationChatSettings | undefined,
): NotificationRequest | null {
  const sound = getSound(chat);
  if (isSuppressed(chat, sound)) return null;
  return {
    title: message.senderName || "New message",
    body: message.text,
    sound,
    data: chatNotificationData(message.chatId, message.messageId ? [message.messageId] : []),
  };
}
