import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { AppState, Platform } from "react-native";
import { resolveExpoProjectId } from "@/utils/expo-project-id";
import {
  messageIdsFromNotificationData,
  partitionPresentedNotifications,
  type ChatNotificationData,
} from "@/utils/notification-policy";

export type NotificationSoundOption = {
  id: string;
  label: string;
  icon: string;
  description: string;
};

export const NOTIFICATION_SOUNDS: NotificationSoundOption[] = [
  { id: "default", label: "Default",  icon: "notifications-outline",   description: "System bell" },
  { id: "chime",   label: "Chime",    icon: "musical-notes-outline",    description: "Soft chime" },
  { id: "ping",    label: "Ping",     icon: "radio-button-on-outline",  description: "Quick ping" },
  { id: "pop",     label: "Pop",      icon: "ellipse-outline",          description: "Bubble pop" },
  { id: "echo",    label: "Echo",     icon: "repeat-outline",           description: "Echo tone"  },
  { id: "none",    label: "Silent",   icon: "volume-mute-outline",      description: "No sound"   },
];

export function getSoundLabel(id: string): string {
  return NOTIFICATION_SOUNDS.find((s) => s.id === id)?.label ?? "Default";
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function readExtraEasProjectId(extra: unknown): string | undefined {
  if (!extra || typeof extra !== "object") return undefined;
  const eas = (extra as { eas?: { projectId?: unknown } }).eas;
  return typeof eas?.projectId === "string" ? eas.projectId : undefined;
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === "web") return null;

  const projectId = resolveExpoProjectId(
    Constants.easConfig?.projectId,
    readExtraEasProjectId(Constants.expoConfig?.extra),
  );

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.warn("[notifications] push permission not granted:", finalStatus);
      return null;
    }

    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token.data) {
      console.error("[notifications] getExpoPushTokenAsync returned an empty token", { projectId });
      return null;
    }
    return token.data;
  } catch (error) {
    console.error("[notifications] push registration failed", { projectId, error });
    return null;
  }
}

const deliveredRemoteMessageIds = new Set<string>();

export function recordNotificationData(data: unknown): void {
  for (const messageId of messageIdsFromNotificationData(data)) {
    deliveredRemoteMessageIds.add(messageId);
  }
}

/** In-memory ids plus anything still in the notification tray. */
export async function loadDeliveredMessageIds(): Promise<Set<string>> {
  if (Platform.OS !== "web") {
    try {
      const presented = await Notifications.getPresentedNotificationsAsync();
      for (const notification of presented) {
        recordNotificationData(notification.request.content.data);
      }
    } catch {
      // Tray lookup can fail before the native module is ready.
    }
  }
  return new Set(deliveredRemoteMessageIds);
}

export function installRemoteNotificationDeliveryTracker(): () => void {
  const received = Notifications.addNotificationReceivedListener((notification) => {
    recordNotificationData(notification.request.content.data);
  });
  const appState = AppState.addEventListener("change", (state) => {
    if (state === "active") void loadDeliveredMessageIds();
  });
  void loadDeliveredMessageIds();
  return () => {
    received.remove();
    appState.remove();
  };
}

export async function scheduleLocalNotification(
  title: string,
  body: string,
  soundId: string = "default",
  data?: ChatNotificationData,
): Promise<void> {
  if (Platform.OS === "web") return;
  if (soundId === "none") return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      ...(data ? { data: { ...data } } : {}),
    },
    trigger: null,
  });
}

/** Dismiss tray items for this chat and set the badge to the other chats' remaining count. */
export async function clearPresentedNotificationsForChat(chatId: string): Promise<void> {
  if (!chatId || Platform.OS === "web") return;
  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    const { dismissIds, remainingBadgeCount } = partitionPresentedNotifications(
      presented.map((notification) => ({
        identifier: notification.request.identifier,
        data: notification.request.content.data,
      })),
      chatId,
    );
    await Promise.all(
      dismissIds.map((identifier) => Notifications.dismissNotificationAsync(identifier).catch(() => {})),
    );
    await Notifications.setBadgeCountAsync(remainingBadgeCount);
  } catch (error) {
    console.warn("[notifications] failed to clear chat notifications", error);
  }
}
