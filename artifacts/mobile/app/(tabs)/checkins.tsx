import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React from "react";
import {
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
import { useMessaging, type CheckInGroup } from "@/context/MessagingContext";
import { Avatar } from "@/components/Avatar";

function CheckInGroupCard({
  group,
  broadcastCount,
  onPress,
}: {
  group: CheckInGroup;
  broadcastCount: number;
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
        {
          backgroundColor: colors.surface,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={[styles.cardIconBg, { backgroundColor: colors.broadcastAccent + "18" }]}>
        <Ionicons name="radio" size={24} color={colors.broadcastAccent} />
      </View>

      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardName, { color: colors.text }]}>
            {group.name}
          </Text>
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

      <Feather name="chevron-right" size={18} color={colors.textTertiary} />
    </Pressable>
  );
}

export default function CheckInsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const { checkInGroups, broadcasts } = useMessaging();

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

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
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              Check In
            </Text>
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
        style={[styles.explainerBanner, { backgroundColor: colors.broadcastAccent + "12", borderColor: colors.broadcastAccent + "30" }]}
      >
        <Ionicons name="information-circle" size={18} color={colors.broadcastAccent} />
        <Text style={[styles.explainerText, { color: colors.textSecondary }]}>
          Members can't see each other. Only you see their replies.
        </Text>
      </View>

      <FlatList
        data={checkInGroups}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <CheckInGroupCard
            group={item}
            broadcastCount={broadcasts.filter((b) => b.groupId === item.id).length}
            onPress={() => router.push(`/checkin/${item.id}`)}
          />
        )}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconBg, { backgroundColor: colors.broadcastAccent + "15" }]}>
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
        }
        contentInsetAdjustmentBehavior="automatic"
      />
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
  headerTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
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
  explainerText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    flex: 1,
    lineHeight: 18,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
  },
  cardIconBg: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  cardContent: {
    flex: 1,
    gap: 4,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardName: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  anonBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  anonText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  cardMembers: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  cardMetaText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 60,
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
  emptyTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    marginTop: 8,
  },
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
  emptyButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
