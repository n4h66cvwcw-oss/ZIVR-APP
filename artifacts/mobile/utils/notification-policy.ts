export type NotificationMessage = {
  chatId: string;
  senderId: string;
  senderName?: string;
  text: string;
};

export type NotificationChatSettings = {
  id: string;
  isMuted?: boolean;
  notificationSound?: string;
};

export type NotificationRequest = {
  title: string;
  body: string;
  sound: string;
};

function getSound(chat: NotificationChatSettings | undefined): string {
  return chat?.notificationSound ?? "default";
}

function isSuppressed(chat: NotificationChatSettings | undefined, sound: string): boolean {
  return chat?.isMuted === true || sound === "none";
}

/**
 * Build one local notification for each chat represented in a missed-message
 * replay. Messages in a chat are intentionally summarized so reconnecting
 * cannot create one notification per replayed message.
 */
export function buildMissedMessageNotifications(
  messages: NotificationMessage[],
  chats: NotificationChatSettings[],
): NotificationRequest[] {
  const chatById = new Map(chats.map((chat) => [chat.id, chat]));
  const groups = new Map<string, {
    count: number;
    senderId: string;
    senderName: string;
    lastText: string;
    hasMultipleSenders: boolean;
  }>();

  for (const message of messages) {
    const senderName = message.senderName || "New message";
    const existing = groups.get(message.chatId);
    groups.set(message.chatId, existing
      ? {
          ...existing,
          count: existing.count + 1,
          lastText: message.text,
          hasMultipleSenders: existing.hasMultipleSenders || existing.senderId !== message.senderId,
        }
      : {
          count: 1,
          senderId: message.senderId,
          senderName,
          lastText: message.text,
          hasMultipleSenders: false,
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
    requests.push({ title, body: group.lastText, sound });
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
  };
}