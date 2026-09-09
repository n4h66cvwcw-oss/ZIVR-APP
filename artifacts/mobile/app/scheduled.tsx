import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useServer, type ScheduledMessage } from "@/context/ServerContext";

export default function ScheduledMessagesScreen() {
  const colors = useColorScheme() === "dark" ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const { listScheduledMessages, cancelScheduledMessage } = useServer();
  const [items, setItems] = useState<ScheduledMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setItems(await listScheduledMessages());
    } catch (error) {
      Alert.alert("Couldn't load scheduled messages", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setLoading(false);
    }
  }, [listScheduledMessages]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const cancel = useCallback((item: ScheduledMessage) => {
    Alert.alert("Cancel scheduled message?", `It won't be sent to ${item.chatName}.`, [
      { text: "Keep", style: "cancel" },
      {
        text: "Cancel message",
        style: "destructive",
        onPress: async () => {
          try {
            await cancelScheduledMessage(item.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setItems((current) => current.filter((candidate) => candidate.id !== item.id));
          } catch (error) {
            Alert.alert("Couldn't cancel", error instanceof Error ? error.message : "Please try again.");
          }
        },
      },
    ]);
  }, [cancelScheduledMessage]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.roundButton}>
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]}>Scheduled</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Messages waiting to send</Text>
        </View>
        <Pressable onPress={() => router.push("/schedule-message")} style={[styles.roundButton, { backgroundColor: colors.primary }]}>
          <Ionicons name="add" size={24} color="#fff" />
        </Pressable>
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 80 }} color={colors.primary} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={items.length ? styles.list : styles.emptyList}
          onRefresh={refresh}
          refreshing={loading}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.clock, { backgroundColor: colors.primary + "18" }]}>
                <Ionicons name="time-outline" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[styles.chatName, { color: colors.text }]}>{item.chatName}</Text>
                <Text style={[styles.message, { color: colors.textSecondary }]} numberOfLines={2}>{item.text}</Text>
                <Text style={[styles.time, { color: colors.primary }]}>
                  {new Date(item.scheduledFor).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                </Text>
              </View>
              <View style={styles.actions}>
                <Pressable onPress={() => router.push({ pathname: "/schedule-message", params: { scheduledId: item.id } })}>
                  <Ionicons name="pencil-outline" size={20} color={colors.primary} />
                </Pressable>
                <Pressable onPress={() => cancel(item)}>
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                </Pressable>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="time-outline" size={64} color={colors.textTertiary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Nothing scheduled</Text>
              <Text style={[styles.emptyCopy, { color: colors.textSecondary }]}>Schedule a message from a conversation or create one here.</Text>
              <Pressable onPress={() => router.push("/schedule-message")} style={[styles.createButton, { backgroundColor: colors.primary }]}>
                <Text style={styles.createText}>Schedule a message</Text>
              </Pressable>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  roundButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 26, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular" },
  list: { padding: 16, gap: 12 },
  emptyList: { flexGrow: 1 },
  card: { flexDirection: "row", padding: 14, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, gap: 12 },
  clock: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  chatName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  message: { fontSize: 14, lineHeight: 19, fontFamily: "Inter_400Regular" },
  time: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  actions: { justifyContent: "space-around", paddingLeft: 6 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 12 },
  emptyTitle: { fontSize: 21, fontFamily: "Inter_700Bold" },
  emptyCopy: { fontSize: 15, lineHeight: 22, textAlign: "center" },
  createButton: { marginTop: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  createText: { color: "#fff", fontFamily: "Inter_600SemiBold" },
});