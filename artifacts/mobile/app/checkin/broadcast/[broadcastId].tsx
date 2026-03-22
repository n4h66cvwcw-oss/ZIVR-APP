import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  Modal,
  Animated,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import {
  useMessaging,
  type AudioAttachment,
  type CheckInReply,
} from "@/context/MessagingContext";
import { Avatar } from "@/components/Avatar";
import { ChatInput } from "@/components/ChatInput";

function MemberReplyPanel({
  memberId,
  replies,
  sideChatMessages,
  onReplyToAll,
  onPrivateReply,
  colors,
}: {
  memberId: string;
  replies: CheckInReply[];
  sideChatMessages: any[];
  onReplyToAll: () => void;
  onPrivateReply: (text: string, audio?: AudioAttachment) => void;
  colors: typeof Colors.dark;
}) {
  const { contacts } = useMessaging();
  const [expanded, setExpanded] = useState(false);
  const [showSideChat, setShowSideChat] = useState(false);
  const member = contacts.find((c) => c.id === memberId);
  const latestReply = replies[replies.length - 1];
  const unread = replies.filter((r) => !r.read).length;

  if (!member) return null;

  return (
    <View
      style={[
        styles.memberPanel,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          setExpanded(!expanded);
        }}
        style={styles.memberPanelHeader}
      >
        <Avatar name={member.name} size={40} isOnline={member.isOnline} />
        <View style={styles.memberPanelInfo}>
          <Text style={[styles.memberPanelName, { color: colors.text }]}>
            {member.name}
          </Text>
          {latestReply ? (
            <Text
              style={[styles.memberPanelReply, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {latestReply.audioAttachment
                ? "Sent an audio message"
                : latestReply.text}
            </Text>
          ) : (
            <Text style={[styles.memberPanelNoReply, { color: colors.textTertiary }]}>
              No reply yet
            </Text>
          )}
        </View>
        <View style={styles.memberPanelRight}>
          {unread > 0 && (
            <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.unreadBadgeText}>{unread}</Text>
            </View>
          )}
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.textTertiary}
          />
        </View>
      </Pressable>

      {expanded && (
        <View style={styles.memberPanelBody}>
          {replies.length === 0 ? (
            <Text style={[styles.noRepliesText, { color: colors.textTertiary }]}>
              Waiting for their reply...
            </Text>
          ) : (
            replies.map((reply) => (
              <View
                key={reply.id}
                style={[
                  styles.replyBubble,
                  { backgroundColor: colors.surfaceSecondary },
                ]}
              >
                {reply.audioAttachment && (
                  <View
                    style={[
                      styles.replyAudioTag,
                      { backgroundColor: colors.audioAccent + "15" },
                    ]}
                  >
                    <Ionicons
                      name="musical-notes"
                      size={13}
                      color={colors.audioAccent}
                    />
                    <Text
                      style={[styles.replyAudioName, { color: colors.audioAccent }]}
                    >
                      {reply.audioAttachment.name}
                    </Text>
                  </View>
                )}
                {reply.text ? (
                  <Text style={[styles.replyText, { color: colors.text }]}>
                    {reply.text}
                  </Text>
                ) : null}
                <Text
                  style={[styles.replyTime, { color: colors.textTertiary }]}
                >
                  {new Date(reply.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            ))
          )}

          <View style={styles.memberPanelActions}>
            <Pressable
              onPress={onReplyToAll}
              style={[
                styles.actionChip,
                { backgroundColor: colors.primary + "18" },
              ]}
            >
              <Ionicons name="people" size={14} color={colors.primary} />
              <Text style={[styles.actionChipText, { color: colors.primary }]}>
                Reply to All
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setShowSideChat(true)}
              style={[
                styles.actionChip,
                { backgroundColor: colors.accent + "18" },
              ]}
            >
              <Ionicons name="lock-closed" size={14} color={colors.accent} />
              <Text style={[styles.actionChipText, { color: colors.accent }]}>
                Private Chat
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      <Modal
        visible={showSideChat}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSideChat(false)}
      >
        <View
          style={[
            styles.sideChatModal,
            { backgroundColor: colors.background },
          ]}
        >
          <View
            style={[
              styles.sideChatHeader,
              {
                backgroundColor: colors.surface,
                borderBottomColor: colors.border,
              },
            ]}
          >
            <Pressable onPress={() => setShowSideChat(false)} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.primary} />
            </Pressable>
            <View style={styles.sideChatHeaderInfo}>
              <View
                style={[
                  styles.lockBadge,
                  { backgroundColor: colors.accent + "20" },
                ]}
              >
                <Ionicons name="lock-closed" size={12} color={colors.accent} />
              </View>
              <Text style={[styles.sideChatName, { color: colors.text }]}>
                Private with {member.name}
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.sideChatNotice,
              { backgroundColor: colors.accent + "12" },
            ]}
          >
            <Ionicons name="lock-closed" size={14} color={colors.accent} />
            <Text style={[styles.sideChatNoticeText, { color: colors.accent }]}>
              Only you and {member.name.split(" ")[0]} can see this conversation
            </Text>
          </View>

          <FlatList
            data={sideChatMessages}
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => (
              <View
                style={[
                  styles.sideMsg,
                  item.senderId === "me"
                    ? styles.sideMsgMine
                    : styles.sideMsgTheirs,
                  {
                    backgroundColor:
                      item.senderId === "me"
                        ? colors.accent
                        : colors.messageReceived,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.sideMsgText,
                    {
                      color:
                        item.senderId === "me"
                          ? "#FFFFFF"
                          : colors.messageTextReceived,
                    },
                  ]}
                >
                  {item.text}
                </Text>
              </View>
            )}
            contentContainerStyle={{ padding: 16, gap: 8 }}
            ListEmptyComponent={
              <View style={styles.sideChatEmpty}>
                <Ionicons
                  name="lock-closed"
                  size={40}
                  color={colors.textTertiary}
                />
                <Text
                  style={[styles.sideChatEmptyText, { color: colors.textSecondary }]}
                >
                  Private conversation with {member.name.split(" ")[0]}
                </Text>
              </View>
            }
          />
          <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={0}>
            <ChatInput
              onSend={(text, audio) => {
                onPrivateReply(text, audio);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              placeholder={`Private message to ${member.name.split(" ")[0]}...`}
            />
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

export default function BroadcastDetailScreen() {
  const { broadcastId } = useLocalSearchParams<{ broadcastId: string }>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const [replyToAll, setReplyToAll] = useState(false);

  const {
    broadcasts,
    checkInGroups,
    contacts,
    sendBroadcast,
    sendPrivateSideChat,
  } = useMessaging();

  const broadcast = broadcasts.find((b) => b.id === broadcastId);
  const group = broadcast
    ? checkInGroups.find((g) => g.id === broadcast.groupId)
    : null;

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  if (!broadcast || !group) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>Broadcast not found</Text>
      </View>
    );
  }

  const members = contacts.filter(
    (c) => group.memberIds.includes(c.id) && c.id !== "me"
  );

  const handleReplyAll = async (text: string, audio?: AudioAttachment) => {
    await sendBroadcast(group.id, text, audio);
    setReplyToAll(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
          <Ionicons
            name="chevron-back"
            size={26}
            color={colors.broadcastAccent}
          />
          <Text style={[styles.backText, { color: colors.broadcastAccent }]}>
            {group.name}
          </Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Broadcast
        </Text>
        <View style={{ width: 80 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}
        >
          <View
            style={[
              styles.broadcastBubble,
              { backgroundColor: colors.broadcastAccent },
            ]}
          >
            {broadcast.audioAttachment && (
              <View
                style={[
                  styles.audioChip,
                  { backgroundColor: "rgba(255,255,255,0.2)" },
                ]}
              >
                <Ionicons name="musical-notes" size={16} color="#FFFFFF" />
                <Text style={styles.audioChipText}>
                  {broadcast.audioAttachment.name}
                </Text>
              </View>
            )}
            <Text style={styles.broadcastBubbleText}>{broadcast.text}</Text>
            <Text style={styles.broadcastBubbleTime}>
              {new Date(broadcast.timestamp).toLocaleString([], {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </View>

          <View style={styles.repliesHeader}>
            <Text style={[styles.repliesTitle, { color: colors.textSecondary }]}>
              REPLIES ({members.length})
            </Text>
            <Text style={[styles.repliesHint, { color: colors.textTertiary }]}>
              Only you can see these
            </Text>
          </View>

          {members.map((member) => (
            <MemberReplyPanel
              key={member.id}
              memberId={member.id}
              replies={broadcast.replies[member.id] || []}
              sideChatMessages={broadcast.privateSideChats[member.id] || []}
              colors={colors}
              onReplyToAll={() => setReplyToAll(true)}
              onPrivateReply={(text, audio) =>
                sendPrivateSideChat(broadcastId, member.id, text, audio)
              }
            />
          ))}
        </ScrollView>

        {replyToAll && (
          <View
            style={[
              styles.replyAllBanner,
              {
                backgroundColor: colors.primary + "12",
                borderTopColor: colors.primary + "30",
              },
            ]}
          >
            <Ionicons name="people" size={14} color={colors.primary} />
            <Text style={[styles.replyAllText, { color: colors.primary }]}>
              Replying to all {members.length} members
            </Text>
            <Pressable onPress={() => setReplyToAll(false)} hitSlop={8}>
              <Ionicons name="close" size={16} color={colors.primary} />
            </Pressable>
          </View>
        )}

        <View style={{ paddingBottom: insets.bottom }}>
          <ChatInput
            onSend={replyToAll ? handleReplyAll : (t, a) => {}}
            placeholder={
              replyToAll
                ? "Reply to everyone..."
                : "Tap Reply to All to respond..."
            }
          />
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
    justifyContent: "space-between",
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    width: 80,
  },
  backText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  broadcastBubble: {
    borderRadius: 20,
    padding: 16,
    gap: 10,
    borderBottomRightRadius: 6,
    alignSelf: "flex-end",
    maxWidth: "90%",
  },
  audioChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  audioChipText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#FFFFFF",
  },
  broadcastBubbleText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "#FFFFFF",
    lineHeight: 22,
  },
  broadcastBubbleTime: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.7)",
    textAlign: "right",
  },
  repliesHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  repliesTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  repliesHint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  memberPanel: {
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
  },
  memberPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 10,
  },
  memberPanelInfo: {
    flex: 1,
    gap: 2,
  },
  memberPanelName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  memberPanelReply: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  memberPanelNoReply: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
  },
  memberPanelRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
  memberPanelBody: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
  },
  noRepliesText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 8,
  },
  replyBubble: {
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  replyAudioTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  replyAudioName: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  replyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  replyTime: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "right",
  },
  memberPanelActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  actionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    flex: 1,
    justifyContent: "center",
  },
  actionChipText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  sideChatModal: {
    flex: 1,
  },
  sideChatHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: 60,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  sideChatHeaderInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  lockBadge: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  sideChatName: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  sideChatNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sideChatNoticeText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  sideMsg: {
    maxWidth: "80%",
    borderRadius: 16,
    padding: 12,
  },
  sideMsgMine: {
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  sideMsgTheirs: {
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
  },
  sideMsgText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
  },
  sideChatEmpty: {
    alignItems: "center",
    paddingTop: 60,
    gap: 12,
  },
  sideChatEmptyText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
  replyAllBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  replyAllText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
});
