import { Feather, Ionicons } from "@expo/vector-icons";
import { FavoritesStrip } from "@/components/FavoritesStrip";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React from "react";
import {
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useMessaging, type CheckInGroup, type CheckInBroadcast } from "@/context/MessagingContext";
import { Avatar } from "@/components/Avatar";

function ReplyProgressBar({
  replied,
  total,
  color,
}: {
  replied: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? replied / total : 0;
  return (
    <View style={progressStyles.container}>
      <View style={[progressStyles.track, { backgroundColor: color + "20" }]}>
        <View
          style={[
            progressStyles.fill,
            { backgroundColor: color, width: `${Math.round(pct * 100)}%` },
          ]}
        />
      </View>
      <Text style={[progressStyles.label, { color }]}>
        {replied}/{total}
      </Text>
    </View>
  );
}

const progressStyles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  track: { flex: 1, height: 5, borderRadius: 3, overflow: "hidden" },
  fill: { height: 5, borderRadius: 3 },
  label: { fontSize: 11, fontFamily: "Inter_600SemiBold", minWidth: 28, textAlign: "right" },
});

function CheckInGroupCard({
  group,
  broadcastCount,
  unreadReplies,
  latestReplyProgress,
  onPress,
}: {
  group: CheckInGroup;
  broadcastCount: number;
  unreadReplies: number;
  latestReplyProgress: { replied: number; total: number } | null;
  onPress: () => void;
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const { contacts } = useMessaging();

  const memberNames = group.memberIds
    .slice(0, 3)
    .map((id) => contacts.find((c) => c.id === id)?.name?.split(" ")[0] || "?")
    .join(", ");
  const extra = group.memberIds.length > 3 ? ` +${group.memberIds.length - 3}` : "";

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={[styles.cardIconBg, { backgroundColor: colors.broadcastAccent + "18" }]}>
        <Ionicons name="radio" size={24} color={colors.broadcastAccent} />
      </View>

      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardName, { color: colors.text }]}>{group.name}</Text>
          {group.anonymous && (
            <View style={[styles.anonBadge, { backgroundColor: colors.accent + "20" }]}>
              <Ionicons name="eye-off" size={10} color={colors.accent} />
              <Text style={[styles.anonText, { color: colors.accent }]}>Private</Text>
            </View>
          )}
        </View>
        <Text style={[styles.cardMembers, { color: colors.textSecondary }]}>
          {memberNames}{extra}
        </Text>
        {latestReplyProgress && (
          <ReplyProgressBar
            replied={latestReplyProgress.replied}
            total={latestReplyProgress.total}
            color={colors.broadcastAccent}
          />
        )}
        <View style={styles.cardMeta}>
          <Ionicons name="people" size={13} color={colors.textTertiary} />
          <Text style={[styles.cardMetaText, { color: colors.textTertiary }]}>
            {group.memberIds.length} members
          </Text>
          {broadcastCount > 0 && (
            <>
              <View style={[styles.dot, { backgroundColor: colors.textTertiary }]} />
              <Ionicons name="send" size={11} color={colors.textTertiary} />
              <Text style={[styles.cardMetaText, { color: colors.textTertiary }]}>
                {broadcastCount} broadcasts
              </Text>
            </>
          )}
        </View>
      </View>

      <View style={styles.cardRight}>
        {unreadReplies > 0 && (
          <View style={[styles.unreadBadge, { backgroundColor: colors.broadcastAccent }]}>
            <Text style={styles.unreadBadgeText}>{unreadReplies}</Text>
          </View>
        )}
        <Feather name="chevron-right" size={18} color={colors.textTertiary} />
      </View>
    </Pressable>
  );
}

function ReceivedBroadcastCard({
  broadcast,
  senderName,
  groupName,
  hasReplied,
  onPress,
}: {
  broadcast: CheckInBroadcast;
  senderName: string;
  groupName: string;
  hasReplied: boolean;
  onPress: () => void;
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;

  const timeAgo = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        styles.receivedCard,
        {
          backgroundColor: colors.surface,
          borderColor: hasReplied ? colors.border : colors.primary + "40",
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={[styles.receivedIcon, { backgroundColor: colors.primary + "15" }]}>
        <Ionicons name="radio" size={20} color={colors.primary} />
      </View>

      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={[styles.receivedSender, { color: colors.primary }]}>{senderName}</Text>
          <Text style={[styles.receivedTime, { color: colors.textTertiary }]}>
            {timeAgo(broadcast.timestamp)}
          </Text>
        </View>
        <Text style={[styles.cardMembers, { color: colors.textSecondary }]}>{groupName}</Text>
        <Text
          style={[styles.receivedPreview, { color: colors.text }]}
          numberOfLines={2}
        >
          {broadcast.text}
        </Text>
        {hasReplied ? (
          <View style={styles.repliedRow}>
            <Ionicons name="checkmark-circle" size={13} color="#32D74B" />
            <Text style={[styles.repliedText, { color: "#32D74B" }]}>You replied</Text>
          </View>
        ) : (
          <View style={[styles.replyPrompt, { backgroundColor: colors.primary + "12" }]}>
            <Text style={[styles.replyPromptText, { color: colors.primary }]}>
              Tap to reply privately →
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

export default function CheckInsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const {
    checkInGroups,
    broadcasts,
    myId,
    getReceivedBroadcasts,
    getBroadcastReplyStats,
    contacts,
  } = useMessaging();

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  const myGroups = checkInGroups.filter(
    (g) => !g.creatorId || g.creatorId === myId
  );
  const receivedBroadcasts = getReceivedBroadcasts();

  const getLatestProgress = (groupId: string) => {
    const groupBroadcasts = broadcasts.filter(
      (b) => b.groupId === groupId && b.senderId === myId
    );
    if (!groupBroadcasts.length) return null;
    const latest = groupBroadcasts[0];
    const stats = getBroadcastReplyStats(latest.id);
    return { replied: stats.replied, total: stats.total };
  };

  const getUnreadReplies = (groupId: string) => {
    return broadcasts
      .filter((b) => b.groupId === groupId && b.senderId === myId)
      .reduce((sum, b) => {
        return sum + Object.values(b.replies).flat().filter((r) => !r.read).length;
      }, 0);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 8,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Check In</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
              Broadcast privately
            </Text>
          </View>
          <Pressable
            onPress={() => router.push("/new-checkin")}
            style={[styles.headerBtn, { backgroundColor: colors.broadcastAccent }]}
          >
            <Feather name="plus" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      <View
        style={[
          styles.explainerBanner,
          {
            backgroundColor: colors.broadcastAccent + "12",
            borderColor: colors.broadcastAccent + "30",
          },
        ]}
      >
        <Ionicons name="information-circle" size={18} color={colors.broadcastAccent} />
        <Text style={[styles.explainerText, { color: colors.textSecondary }]}>
          Members can't see each other. Only you see their replies.
        </Text>
      </View>

      <FavoritesStrip tab="checkins" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      >
        {receivedBroadcasts.length > 0 && (
          <View>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Received
              </Text>
              {receivedBroadcasts.filter((r) => !r.broadcast.myReply).length > 0 && (
                <View style={[styles.sectionBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.sectionBadgeText}>
                    {receivedBroadcasts.filter((r) => !r.broadcast.myReply).length} new
                  </Text>
                </View>
              )}
            </View>
            {receivedBroadcasts.map(({ broadcast, group, sender }) => (
              <ReceivedBroadcastCard
                key={broadcast.id}
                broadcast={broadcast}
                senderName={sender?.name ?? "Unknown"}
                groupName={group?.name ?? ""}
                hasReplied={!!broadcast.myReply}
                onPress={() =>
                  router.push({
                    pathname: "/checkin/received/[broadcastId]",
                    params: { broadcastId: broadcast.id },
                  })
                }
              />
            ))}
          </View>
        )}

        <View style={styles.sectionHeader}>
          <View style={[styles.sectionDot, { backgroundColor: colors.broadcastAccent }]} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>My Groups</Text>
        </View>

        {myGroups.length === 0 ? (
          <View style={styles.emptyState}>
            <View
              style={[
                styles.emptyIconBg,
                { backgroundColor: colors.broadcastAccent + "15" },
              ]}
            >
              <Ionicons name="radio" size={48} color={colors.broadcastAccent} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No Check-In Groups
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Create a private broadcast group where only you see each member's replies
            </Text>
            <Pressable
              onPress={() => router.push("/new-checkin")}
              style={[styles.emptyButton, { backgroundColor: colors.broadcastAccent }]}
            >
              <Feather name="plus" size={16} color="#FFFFFF" />
              <Text style={styles.emptyButtonText}>Create Group</Text>
            </Pressable>
          </View>
        ) : (
          myGroups.map((group) => (
            <CheckInGroupCard
              key={group.id}
              group={group}
              broadcastCount={broadcasts.filter(
                (b) => b.groupId === group.id && b.senderId === myId
              ).length}
              unreadReplies={getUnreadReplies(group.id)}
              latestReplyProgress={getLatestProgress(group.id)}
              onPress={() => router.push(`/checkin/${group.id}`)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  explainerBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  explainerText: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 18 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 10,
  },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold", flex: 1 },
  sectionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  sectionBadgeText: { color: "#FFF", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 16,
  },
  cardIconBg: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  cardContent: { flex: 1, gap: 4 },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "space-between",
  },
  cardName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  anonBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  anonText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  cardMembers: { fontSize: 13, fontFamily: "Inter_400Regular" },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  cardMetaText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  cardRight: { flexDirection: "column", alignItems: "flex-end", gap: 6 },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  unreadBadgeText: { color: "#FFF", fontSize: 11, fontFamily: "Inter_700Bold" },
  dot: { width: 3, height: 3, borderRadius: 1.5 },
  receivedCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  receivedIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  receivedSender: { fontSize: 14, fontFamily: "Inter_700Bold" },
  receivedTime: { fontSize: 12, fontFamily: "Inter_400Regular" },
  receivedPreview: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
    marginTop: 2,
  },
  repliedRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  repliedText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  replyPrompt: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  replyPromptText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  emptyState: {
    alignItems: "center",
    paddingTop: 40,
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyIconBg: {
    width: 100,
    height: 100,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: 22, fontFamily: "Inter_700Bold", marginTop: 8 },
  emptySubtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  emptyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  emptyButtonText: { color: "#FFFFFF", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
