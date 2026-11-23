import { router } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";
import { ReportSheet } from "@/components/ReportSheet";
import { useMessaging } from "@/context/MessagingContext";
import { useServer } from "@/context/ServerContext";
import { isServerUuid, type ReportReason } from "@/utils/safety";

export type ReportTarget = {
  reportedUserId: string;
  name: string;
  messageId?: string | null;
  chatId?: string | null;
};

export function useUserSafety() {
  const { reportContent, blockUser, unblockUser } = useServer();
  const { blockedUserIds, rememberBlockedUser, forgetBlockedUser } = useMessaging();
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);

  function isBlocked(userId: string) {
    return blockedUserIds.includes(userId);
  }

  function promptReport(target: ReportTarget) {
    if (!isServerUuid(target.reportedUserId)) {
      Alert.alert("Can't report yet", "This person isn't on a ZIVR account yet.");
      return;
    }
    setReportTarget(target);
  }

  function promptBlock(userId: string, name: string, options?: { onBlocked?: () => void }) {
    if (!isServerUuid(userId)) {
      Alert.alert("Can't block yet", "This person isn't on a ZIVR account yet.");
      return;
    }
    const blocked = isBlocked(userId);
    Alert.alert(
      blocked ? `Unblock ${name}?` : `Block ${name}?`,
      blocked
        ? "They will be able to message you again. They are not notified."
        : "You won't see their messages, and they won't be able to message you. They are not notified. A 1:1 chat with them leaves your chat list.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: blocked ? "Unblock" : "Block",
          style: blocked ? "default" : "destructive",
          onPress: () => {
            void (async () => {
              const ok = blocked ? await unblockUser(userId) : await blockUser(userId);
              if (!ok) {
                Alert.alert(blocked ? "Couldn't unblock" : "Couldn't block", "Check your connection and try again.");
                return;
              }
              if (blocked) {
                forgetBlockedUser(userId);
                return;
              }
              rememberBlockedUser(userId);
              options?.onBlocked?.();
            })();
          },
        },
      ],
    );
  }

  async function submitReport(reason: ReportReason, details: string) {
    if (!reportTarget) return;
    const result = await reportContent({
      reportedUserId: reportTarget.reportedUserId,
      messageId: reportTarget.messageId,
      chatId: reportTarget.chatId,
      reason,
      details,
    });
    if (!result.ok) {
      Alert.alert("Couldn't send report", result.error);
      throw new Error(result.error);
    }
    Alert.alert("Report sent", "Thanks. Moderators will review this report.");
  }

  const reportSheet = (
    <ReportSheet
      visible={reportTarget !== null}
      title={reportTarget?.messageId ? `Report message from ${reportTarget.name}` : `Report ${reportTarget?.name ?? "user"}`}
      onClose={() => setReportTarget(null)}
      onSubmit={submitReport}
    />
  );

  return { promptReport, promptBlock, isBlocked, reportSheet };
}

export function leaveDirectChatAfterBlock() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}
