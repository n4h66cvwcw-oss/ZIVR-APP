export const notifications: Array<{
  title: string;
  body: string;
  sound: string;
  data?: {
    type: "chat_message";
    chatId: string;
    messageIds: string[];
    messageId?: string;
  };
}> = [];

export const clearedChatIds: string[] = [];

let deliveredMessageIds = new Set<string>();

export function resetNotificationMock() {
  notifications.length = 0;
  clearedChatIds.length = 0;
  deliveredMessageIds = new Set();
}

export function seedDeliveredMessageIds(ids: Iterable<string>) {
  deliveredMessageIds = new Set(ids);
}

export async function loadDeliveredMessageIds(): Promise<Set<string>> {
  return new Set(deliveredMessageIds);
}

export async function scheduleLocalNotification(
  title: string,
  body: string,
  sound = "default",
  data?: (typeof notifications)[number]["data"],
) {
  notifications.push(data ? { title, body, sound, data } : { title, body, sound });
}

export async function clearPresentedNotificationsForChat(chatId: string) {
  clearedChatIds.push(chatId);
}
