export const notifications: Array<{ title: string; body: string; sound: string }> = [];

export function resetNotificationMock() {
  notifications.length = 0;
}

export async function scheduleLocalNotification(title: string, body: string, sound = "default") {
  notifications.push({ title, body, sound });
}