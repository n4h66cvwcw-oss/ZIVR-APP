import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useMessaging } from "@/context/MessagingContext";
import { Avatar } from "@/components/Avatar";

export default function ReceivedBroadcastScreen() {
  const { broadcastId } = useLocalSearchParams<{ broadcastId: string }>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const { broadcasts, checkInGroups, contacts, replyToReceivedBroadcast, myId } = useMessaging();

  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  const broadcast = broadcasts.find((b) => b.id === broadcastId);
  const group = checkInGroups.find((g) => g.id === broadcast?.groupId);
  const sender = contacts.find((c) => c.id === broadcast?.senderId);
  const isAnonymous = group?.anonymous;

  if (!broadcast || !group) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textSecondary, textAlign: "center", marginTop: 80 }}>
          Broadcast not found
        </Text>
      </View>
    );
  }

  const hasReplied = !!broadcast.myReply;
  const timeAgo = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const handleSend = async () => {
    if (!replyText.trim() || sending) return;
    setSending(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await replyToReceivedBroadcast(broadcastId, replyText.trim());
    setReplyText("");
    setSending(false);
    Alert.alert(
      "Reply Sent",
      `Your reply was sent privately to ${isAnonymous ? "the group creator" : sender?.name ?? "the creator"}. Only they can see it.`,
      [{ text: "Got it", onPress: () => router.back() }]
    );
  };

  const memberCount = group.memberIds.filter((id) => id !== broadcast.senderId).length;
  const replyCount = Object.values(broadcast.replies).flat().length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={["#0A84FF18", "transparent"]}
        style={styles.headerGlow}
      />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.primary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{group.name}</Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
            {memberCount} members · {timeAgo(broadcast.timestamp)}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={insets.bottom + 80}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.senderSection}>
            <Avatar name={isAnonymous ? "?" : (sender?.name ?? "?")} size={52} isOnline={sender?.isOnline} />
            <View style={styles.senderInfo}>
              <Text style={[styles.senderName, { color: colors.text }]}>
                {isAnonymous ? "Anonymous Sender" : sender?.name ?? "Unknown"}
              </Text>
              <View style={[styles.broadcastBadge, { backgroundColor: colors.primary + "15" }]}>
                <Ionicons name="radio" size={12} color={colors.primary} />
                <Text style={[styles.broadcastBadgeText, { color: colors.primary }]}>
                  Check-In Broadcast
                </Text>
              </View>
            </View>
          </View>

          <View style={[styles.messageBubble, { backgroundColor: colors.surface }]}>
            <Text style={[styles.messageText, { color: colors.text }]}>
              {broadcast.text}
            </Text>
            {broadcast.audioAttachment && (
              <View style={[styles.audioAttachment, { backgroundColor: colors.surfaceSecondary }]}>
                <Ionicons name="musical-notes" size={16} color={colors.audioAccent} />
                <Text style={[styles.audioLabel, { color: colors.audioAccent }]}>
                  {broadcast.audioAttachment.name ?? "Audio message"}
                </Text>
              </View>
            )}
            <Text style={[styles.messageTime, { color: colors.textTertiary }]}>
              {new Date(broadcast.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </View>

          <View style={[styles.privacyNotice, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <Ionicons name="lock-closed" size={16} color={colors.secondary} />
            <View style={styles.privacyText}>
              <Text style={[styles.privacyTitle, { color: colors.text }]}>
                Your reply is completely private
              </Text>
              <Text style={[styles.privacySub, { color: colors.textSecondary }]}>
                Only {isAnonymous ? "the group creator" : sender?.name ?? "the creator"} will see your response.
                Other members cannot see that you replied or what you said.
              </Text>
            </View>
          </View>

          <View style={[styles.statsRow, { backgroundColor: colors.surface }]}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.text }]}>{memberCount}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Members</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.text }]}>{replyCount}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Replied so far</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: hasReplied ? "#32D74B" : colors.primary }]}>
                {hasReplied ? "✓" : "—"}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>You replied</Text>
            </View>
          </View>

          {hasReplied && (
            <View style={[styles.yourReplyCard, { backgroundColor: colors.surface, borderColor: "#32D74B40" }]}>
              <View style={styles.yourReplyHeader}>
                <Ionicons name="checkmark-circle" size={16} color="#32D74B" />
                <Text style={[styles.yourReplyLabel, { color: "#32D74B" }]}>Your Reply</Text>
              </View>
              <Text style={[styles.yourReplyText, { color: colors.text }]}>
                {broadcast.myReply}
              </Text>
            </View>
          )}
        </ScrollView>

        {!hasReplied && (
          <View
            style={[
              styles.replyBar,
              {
                backgroundColor: colors.surface,
                borderTopColor: colors.border,
                paddingBottom: insets.bottom + 8,
              },
            ]}
          >
            <TextInput
              style={[
                styles.replyInput,
                {
                  backgroundColor: colors.surfaceSecondary,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              value={replyText}
              onChangeText={setReplyText}
              placeholder="Type your private reply..."
              placeholderTextColor={colors.textTertiary}
              multiline
              maxLength={500}
            />
            <Pressable
              onPress={handleSend}
              disabled={!replyText.trim() || sending}
              style={[
                styles.sendBtn,
                {
                  backgroundColor:
                    replyText.trim() && !sending ? colors.primary : colors.surfaceSecondary,
                },
              ]}
            >
              <Ionicons
                name="send"
                size={18}
                color={replyText.trim() && !sending ? "#FFF" : colors.textTertiary}
              />
            </Pressable>
          </View>
        )}

        {hasReplied && (
          <View
            style={[
              styles.repliedBar,
              {
                backgroundColor: "#32D74B15",
                borderTopColor: "#32D74B30",
                paddingBottom: insets.bottom + 8,
              },
            ]}
          >
            <Ionicons name="checkmark-circle" size={20} color="#32D74B" />
            <Text style={[styles.repliedBarText, { color: "#32D74B" }]}>
              Reply sent privately
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerGlow: { position: "absolute", top: 0, left: 0, right: 0, height: 180 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  headerSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  senderSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  senderInfo: { flex: 1, gap: 6 },
  senderName: { fontSize: 18, fontFamily: "Inter_700Bold" },
  broadcastBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  broadcastBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  messageBubble: {
    marginHorizontal: 20,
    padding: 18,
    borderRadius: 20,
    gap: 8,
    marginBottom: 16,
  },
  messageText: { fontSize: 16, fontFamily: "Inter_400Regular", lineHeight: 24 },
  audioAttachment: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 12,
  },
  audioLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  messageTime: { fontSize: 12, fontFamily: "Inter_400Regular", alignSelf: "flex-end" },
  privacyNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginHorizontal: 20,
    padding: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
  },
  privacyText: { flex: 1, gap: 4 },
  privacyTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  privacySub: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  statsRow: {
    flexDirection: "row",
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  statItem: { flex: 1, alignItems: "center", gap: 4 },
  statValue: { fontSize: 22, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
  statDivider: { width: StyleSheet.hairlineWidth, marginVertical: 4 },
  yourReplyCard: {
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 8,
  },
  yourReplyHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  yourReplyLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  yourReplyText: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22 },
  replyBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  replyInput: {
    flex: 1,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    maxHeight: 100,
    minHeight: 44,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  repliedBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  repliedBarText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
