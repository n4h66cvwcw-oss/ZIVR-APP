import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { resolveExpoProjectId } from "@/utils/expo-project-id";

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

export async function scheduleLocalNotification(
  title: string,
  body: string,
  soundId: string = "default"
): Promise<void> {
  if (Platform.OS === "web") return;
  if (soundId === "none") return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
    },
    trigger: null,
  });
}
