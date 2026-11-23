import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useMessaging } from "@/context/MessagingContext";
import { useServer } from "@/context/ServerContext";
import type { BlockedUser } from "@/utils/safety";

export default function BlockedUsersScreen() {
  const colors = useColorScheme() === "dark" ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const { listBlockedUsers, unblockUser } = useServer();
  const { forgetBlockedUser, rememberBlockedUser } = useMessaging();
  const [blocks, setBlocks] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const rows = await listBlockedUsers();
    setLoading(false);
    if (!rows) {
      Alert.alert("Couldn't load blocked users", "Check your connection and try again.");
      return;
    }
    setBlocks(rows);
    rows.forEach((row) => rememberBlockedUser(row.userId));
  }, [listBlockedUsers, rememberBlockedUser]);

  useEffect(() => {
    void load();
  }, [load]);

  function confirmUnblock(user: BlockedUser) {
    Alert.alert(
      `Unblock ${user.displayName}?`,
      "They will be able to message you again. They are not told that you blocked or unblocked them.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unblock",
          onPress: () => {
            void (async () => {
              const ok = await unblockUser(user.userId);
              if (!ok) {
                Alert.alert("Couldn't unblock", "Check your connection and try again.");
                return;
              }
              forgetBlockedUser(user.userId);
              setBlocks((current) => current.filter((row) => row.userId !== user.userId));
            })();
          },
        },
      ],
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" size={26} color={colors.primary} />
          <Text style={[styles.backText, { color: colors.primary }]}>Settings</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>Blocked users</Text>
        <View style={{ width: 72 }} />
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={colors.primary} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
          {blocks.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textSecondary }]}>
              You haven't blocked anyone. Block someone from a chat to hide their messages and stop them messaging you.
            </Text>
          ) : (
            blocks.map((user) => (
              <View key={user.userId} style={[styles.row, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, { color: colors.text }]}>{user.displayName}</Text>
                  {user.username ? (
                    <Text style={{ color: colors.textSecondary, fontFamily: "Inter_400Regular" }}>@{user.username}</Text>
                  ) : null}
                </View>
                <Pressable onPress={() => confirmUnblock(user)} style={[styles.unblock, { borderColor: colors.border }]}>
                  <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>Unblock</Text>
                </Pressable>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 8 },
  back: { flexDirection: "row", alignItems: "center", width: 72 },
  backText: { fontFamily: "Inter_500Medium", fontSize: 16 },
  title: { fontFamily: "Inter_700Bold", fontSize: 17 },
  empty: { margin: 24, fontSize: 15, lineHeight: 22, fontFamily: "Inter_400Regular" },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  name: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
  unblock: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
});
