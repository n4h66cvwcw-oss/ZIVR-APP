import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
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

export default function CallHistoryScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const { callHistory, startCall, clearHistory } = useCall();
  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  const handleClearHistory = () => {
    Alert.alert("Clear Call History", "This will delete all call records.", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear All", style: "destructive", onPress: clearHistory },
    ]);
  };

  const handleCallback = (record: CallRecord) => {
    startCall(record.contactId, record.contactName, record.type);
    router.push({
      pathname: "/call/[id]",
      params: { id: record.contactId, name: record.contactName, type: record.type },
    });
  };

  const renderItem = ({ item }: { item: CallRecord }) => {
    const isMissed = item.status === "missed" || (item.status === "declined" && item.direction === "incoming");
    const isIncoming = item.direction === "incoming";

    const arrowIcon = isIncoming
      ? isMissed
        ? "arrow-down-circle"
        : "arrow-down-circle"
      : "arrow-up-circle";
    const arrowColor = isMissed
      ? "#FF453A"
      : isIncoming
      ? "#30D158"
      : colors.primary;

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
            <Ionicons name={arrowIcon as any} size={13} color={arrowColor} />
            <Text style={[styles.meta, { color: colors.textSecondary }]}>
              {isIncoming ? "Incoming" : "Outgoing"} · {item.type === "video" ? "Video" : "Voice"}
              {isMissed ? " · Missed" : item.duration > 0 ? ` · ${formatDuration(item.duration)}` : ""}
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
          { paddingTop: topPad, backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.primary} />
          <Text style={[styles.backText, { color: colors.primary }]}>Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>Recents</Text>
        {callHistory.length > 0 ? (
          <Pressable onPress={handleClearHistory}>
            <Text style={[styles.clearText, { color: "#FF453A" }]}>Clear</Text>
          </Pressable>
        ) : (
          <View style={{ width: 48 }} />
        )}
      </View>

      <FlatList
        data={callHistory}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => (
          <View style={[styles.separator, { backgroundColor: colors.border, marginLeft: 76 }]} />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="call-outline" size={64} color={colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No recent calls</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Your voice and video calls will appear here
            </Text>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { flexDirection: "row", alignItems: "center" },
  backText: { fontSize: 16, fontFamily: "Inter_400Regular" },
  title: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  clearText: { fontSize: 15, fontFamily: "Inter_400Regular" },
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
  empty: { alignItems: "center", paddingTop: 100, gap: 12 },
  emptyTitle: { fontSize: 20, fontFamily: "Inter_600SemiBold", marginTop: 8 },
  emptySubtitle: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
});
