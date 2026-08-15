import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
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
import { useCall, type CallRecord } from "@/context/CallContext";
import { Avatar } from "@/components/Avatar";
import { FavoritesStrip } from "@/components/FavoritesStrip";
import { useFavorites } from "@/context/FavoritesContext";

function formatDuration(secs: number): string {
  if (secs === 0) return "";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatCallTime(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000)
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const days = Math.floor(diff / 86400000);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" });
}

type FilterType = "all" | "missed" | "voice" | "video";

export default function CallsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const { callHistory, startCall, clearHistory } = useCall();
  const { addFavorite, removeFavorite, isFavorited } = useFavorites();
  const [filter, setFilter] = useState<FilterType>("all");
  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  const handleClearHistory = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Clear Call History", "This will delete all call records.", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear All", style: "destructive", onPress: clearHistory },
    ]);
  };

  const handleCallback = (record: CallRecord) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    startCall(record.contactId, record.contactName, record.type);
    router.push({
      pathname: "/call/[id]",
      params: { id: record.contactId, name: record.contactName, type: record.type },
    });
  };

  const filtered = callHistory.filter((r) => {
    if (filter === "missed")
      return r.status === "missed" || (r.status === "declined" && r.direction === "incoming");
    if (filter === "voice") return r.type === "voice";
    if (filter === "video") return r.type === "video";
    return true;
  });

  const missedCount = callHistory.filter(
    (r) => r.status === "missed" || (r.status === "declined" && r.direction === "incoming")
  ).length;

  const filterTabs: { key: FilterType; label: string; count?: number }[] = [
    { key: "all", label: "All" },
    { key: "missed", label: "Missed", count: missedCount },
    { key: "voice", label: "Voice" },
    { key: "video", label: "Video" },
  ];

  const renderItem = ({ item }: { item: CallRecord }) => {
    const isMissed =
      item.status === "missed" ||
      (item.status === "declined" && item.direction === "incoming");
    const isIncoming = item.direction === "incoming";
    const arrowColor = isMissed ? "#FF453A" : isIncoming ? "#30D158" : colors.primary;

    return (
      <Pressable
        style={({ pressed }) => [
          styles.row,
          { backgroundColor: pressed ? colors.surfaceSecondary : colors.surface },
        ]}
        onPress={() => handleCallback(item)}
      >
        <View style={styles.avatarWrap}>
          <Avatar name={item.contactName} size={48} />
          <View style={[styles.callTypeBadge, { backgroundColor: colors.background }]}>
            <Ionicons
              name={item.type === "video" ? "videocam" : "call"}
              size={11}
              color={colors.textSecondary}
            />
          </View>
        </View>

        <View style={styles.info}>
          <Text style={[styles.name, { color: isMissed ? "#FF453A" : colors.text }]}>
            {item.contactName}
          </Text>
          <View style={styles.metaRow}>
            <Ionicons
              name={
                isIncoming
                  ? isMissed
                    ? "arrow-down-circle"
                    : "arrow-down-circle"
                  : "arrow-up-circle"
              }
              size={13}
              color={arrowColor}
            />
            <Text style={[styles.meta, { color: colors.textSecondary }]}>
              {isIncoming ? "Incoming" : "Outgoing"} ·{" "}
              {item.type === "video" ? "Video" : "Voice"}
              {isMissed
                ? " · Missed"
                : item.duration > 0
                ? ` · ${formatDuration(item.duration)}`
                : ""}
            </Text>
          </View>
        </View>

        <View style={styles.right}>
          <Text style={[styles.time, { color: colors.textTertiary }]}>
            {formatCallTime(item.startedAt)}
          </Text>
          <Pressable
            onPress={() => handleCallback(item)}
            hitSlop={12}
            style={[styles.callbackBtn, { backgroundColor: colors.primary + "15" }]}
          >
            <Ionicons
              name={item.type === "video" ? "videocam" : "call"}
              size={16}
              color={colors.primary}
            />
          </Pressable>
        </View>
      </Pressable>
    );
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
        <View style={styles.headerRow}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Calls</Text>
          {callHistory.length > 0 && (
            <Pressable onPress={handleClearHistory} hitSlop={8}>
              <Text style={[styles.clearText, { color: "#FF453A" }]}>Clear</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.filterRow}>
          {filterTabs.map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => {
                Haptics.selectionAsync();
                setFilter(tab.key);
              }}
              style={[
                styles.filterChip,
                {
                  backgroundColor:
                    filter === tab.key ? colors.primary : colors.surfaceSecondary,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: filter === tab.key ? "#FFF" : colors.textSecondary },
                ]}
              >
                {tab.label}
              </Text>
              {tab.count && tab.count > 0 ? (
                <View
                  style={[
                    styles.filterBadge,
                    {
                      backgroundColor:
                        filter === tab.key ? "rgba(255,255,255,0.35)" : "#FF453A",
                    },
                  ]}
                >
                  <Text style={styles.filterBadgeText}>{tab.count}</Text>
                </View>
              ) : null}
            </Pressable>
          ))}
        </View>
      </View>

      <FavoritesStrip tab="calls" />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => (
          <View
            style={[styles.separator, { backgroundColor: colors.border, marginLeft: 76 }]}
          />
        )}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        contentInsetAdjustmentBehavior="automatic"
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={[styles.emptyIconWrap, { backgroundColor: colors.primary + "12" }]}>
              <Ionicons
                name={filter === "missed" ? "call-outline" : "phone-portrait-outline"}
                size={48}
                color={colors.primary}
              />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {filter === "all"
                ? "No recent calls"
                : filter === "missed"
                ? "No missed calls"
                : filter === "voice"
                ? "No voice calls"
                : "No video calls"}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              {filter === "all"
                ? "Your voice and video calls will appear here"
                : "Try a different filter above"}
            </Text>
          </View>
        }
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
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  clearText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  filterRow: {
    flexDirection: "row",
    gap: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  filterChipText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  filterBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  filterBadgeText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#FFF" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  avatarWrap: { position: "relative" },
  callTypeBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  info: { flex: 1, gap: 4 },
  name: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  meta: { fontSize: 13, fontFamily: "Inter_400Regular" },
  right: { alignItems: "flex-end", gap: 8 },
  time: { fontSize: 12, fontFamily: "Inter_400Regular" },
  callbackBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  separator: { height: StyleSheet.hairlineWidth },
  empty: { alignItems: "center", paddingTop: 80, paddingHorizontal: 40, gap: 12 },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 20, fontFamily: "Inter_700Bold", marginTop: 4 },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
});
