import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import {
  useMessaging,
  type AudioAttachment,
  type CheckInBroadcast,
} from "@/context/MessagingContext";
import { Avatar } from "@/components/Avatar";
import { ChatInput } from "@/components/ChatInput";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";

function BroadcastCard({
  broadcast,
  onPress,
  colors,
}: {
  broadcast: CheckInBroadcast;
  onPress: () => void;
  colors: typeof Colors.dark;
}) {
  const { contacts } = useMessaging();
  const replyCount = Object.values(broadcast.replies).flat().length;
  const unreadReplies = Object.values(broadcast.replies)
    .flat()
    .filter((r) => !r.read).length;

  const time = new Date(broadcast.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        styles.broadcastCard,
        {
          backgroundColor: colors.surface,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.broadcastCardHeader}>
        <View
          style={[
            styles.broadcastIconBg,
            { backgroundColor: colors.broadcastAccent + "18" },
          ]}
        >
          <Ionicons name="send" size={14} color={colors.broadcastAccent} />
        </View>
        <Text style={[styles.broadcastTime, { color: colors.textTertiary }]}>
          {time}
        </Text>
        {unreadReplies > 0 && (
          <View
            style={[
              styles.unreadDot,
              { backgroundColor: colors.primary },
            ]}
          >
            <Text style={styles.unreadDotText}>{unreadReplies}</Text>
          </View>
        )}
      </View>

      <Text style={[styles.broadcastText, { color: colors.text }]}>
        {broadcast.text}
      </Text>

      {broadcast.audioAttachment && (
        <View
          style={[
            styles.audioIndicator,
            { backgroundColor: colors.audioAccent + "15" },
          ]}
        >
          <Ionicons name="musical-notes" size={14} color={colors.audioAccent} />
          <Text style={[styles.audioIndicatorText, { color: colors.audioAccent }]}>
            {broadcast.audioAttachment.name}
          </Text>
        </View>
      )}

      <View style={styles.broadcastFooter}>
        <View style={styles.replyCountBadge}>
          <Ionicons name="chatbubble" size={13} color={colors.textSecondary} />
          <Text style={[styles.replyCountText, { color: colors.textSecondary }]}>
            {replyCount} {replyCount === 1 ? "reply" : "replies"}
          </Text>
        </View>
        <Feather name="chevron-right" size={14} color={colors.textTertiary} />
      </View>
    </Pressable>
  );
}

export default function CheckInGroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const [showCompose, setShowCompose] = useState(false);

  const {
    checkInGroups,
    getBroadcastsForGroup,
    sendBroadcast,
    contacts,
    addMemberToCheckIn,
    removeMemberFromCheckIn,
  } = useMessaging();

  const group = checkInGroups.find((g) => g.id === id);
  const broadcasts = getBroadcastsForGroup(id);

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  if (!group) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>Group not found</Text>
      </View>
    );
  }

  const members = contacts.filter(
    (c) => group.memberIds.includes(c.id) && c.id !== "me"
  );

  const handleSendBroadcast = async (text: string, audio?: AudioAttachment) => {
    if (!text.trim() && !audio) return;
    await sendBroadcast(id, text, audio);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowCompose(false);
  };

  const handleRemoveMember = (memberId: string, memberName: string) => {
    Alert.alert(
      "Remove Member",
      `Remove ${memberName} from this group?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => removeMemberFromCheckIn(id, memberId),
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad,
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.broadcastAccent} />
          <Text style={[styles.backText, { color: colors.broadcastAccent }]}>
            Check In
          </Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <View
            style={[
              styles.headerIconBg,
              { backgroundColor: colors.broadcastAccent + "20" },
            ]}
          >
            <Ionicons name="radio" size={20} color={colors.broadcastAccent} />
          </View>
          <View>
            <Text style={[styles.headerName, { color: colors.text }]}>
              {group.name}
            </Text>
            <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
              {group.memberIds.length} members · private
            </Text>
          </View>
        </View>
      </View>

      <View
        style={[
          styles.membersSection,
          { backgroundColor: colors.surfaceSecondary, borderBottomColor: colors.border },
        ]}
      >
        <Text style={[styles.membersSectionTitle, { color: colors.textSecondary }]}>
          MEMBERS
        </Text>
        <View style={styles.membersRow}>
          {members.map((m) => (
            <Pressable
              key={m.id}
              onLongPress={() => handleRemoveMember(m.id, m.name)}
              style={styles.memberChip}
            >
              <Avatar name={m.name} size={32} isOnline={m.isOnline} />
              <Text
                style={[styles.memberChipName, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                {m.name.split(" ")[0]}
              </Text>
            </Pressable>
          ))}
          {group.anonymous && (
            <View
              style={[
                styles.anonLabel,
                { backgroundColor: colors.accent + "20" },
              ]}
            >
              <Ionicons name="eye-off" size={13} color={colors.accent} />
              <Text style={[styles.anonLabelText, { color: colors.accent }]}>
                Hidden from each other
              </Text>
            </View>
          )}
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
        <FlatList
          data={[...broadcasts].reverse()}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <BroadcastCard
              broadcast={item}
              colors={colors}
              onPress={() =>
                router.push(`/checkin/broadcast/${item.id}`)
              }
            />
          )}
          inverted={broadcasts.length > 0}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          ListEmptyComponent={
            <View style={styles.emptyBroadcasts}>
              <Ionicons
                name="send-outline"
                size={48}
                color={colors.textTertiary}
              />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Send your first broadcast
              </Text>
              <Text style={[styles.emptySubText, { color: colors.textTertiary }]}>
                Everyone receives it privately
              </Text>
            </View>
          }
        />

        <View
          style={[
            styles.composeArea,
            {
              paddingBottom: insets.bottom,
              borderTopColor: colors.border,
              backgroundColor: colors.surface,
            },
          ]}
        >
          {!showCompose ? (
            <Pressable
              onPress={() => setShowCompose(true)}
              style={[
                styles.composeTrigger,
                { backgroundColor: colors.broadcastAccent },
              ]}
            >
              <Ionicons name="send" size={18} color="#FFFFFF" />
              <Text style={styles.composeTriggerText}>Send Broadcast</Text>
            </Pressable>
          ) : (
            <View>
              <Text style={[styles.composeLabel, { color: colors.textSecondary }]}>
                Broadcast to {group.memberIds.length} members privately
              </Text>
              <ChatInput
                onSend={handleSendBroadcast}
                placeholder="Write your broadcast..."
              />
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
  },
  backText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  headerName: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  headerSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  membersSection: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  membersSectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  membersRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  memberChip: {
    alignItems: "center",
    gap: 4,
    width: 48,
  },
  memberChipName: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
  anonLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  anonLabelText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  broadcastCard: {
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  broadcastCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  broadcastIconBg: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  broadcastTime: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  unreadDot: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadDotText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
  broadcastText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },
  audioIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  audioIndicatorText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  broadcastFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  replyCountBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  replyCountText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  emptyBroadcasts: {
    alignItems: "center",
    paddingTop: 60,
    gap: 8,
  },
  emptyText: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    marginTop: 8,
  },
  emptySubText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  composeArea: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  composeTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    borderRadius: 14,
  },
  composeTriggerText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
  composeLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    marginBottom: 6,
  },
});
