import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState, useCallback } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useMessaging, type Chat } from "@/context/MessagingContext";
import { ChatListItem } from "@/components/ChatListItem";
import { SwipeableRow } from "@/components/SwipeableRow";

export default function ChatsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const { chats, deleteChat, pinChat, muteChat } = useMessaging();
  const [search, setSearch] = useState("");

  const filtered = chats
    .filter(
      (c) =>
        c.type !== "checkin" &&
        c.name.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return (b.lastMessageTime || b.createdAt) - (a.lastMessageTime || a.createdAt);
    });

  const handlePress = useCallback(
    (chat: Chat) => {
      router.push(`/chat/${chat.id}`);
    },
    []
  );

  const handleDelete = useCallback(
    (chatId: string) => {
      Alert.alert("Delete Chat", "This will delete all messages. Continue?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            deleteChat(chatId);
          },
        },
      ]);
    },
    [deleteChat]
  );

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
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Messages
          </Text>
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => router.push("/new-group")}
              style={[styles.headerBtn, { backgroundColor: colors.surfaceSecondary }]}
            >
              <Ionicons name="people" size={20} color={colors.primary} />
            </Pressable>
            <Pressable
              onPress={() => router.push("/new-chat")}
              style={[styles.headerBtn, { backgroundColor: colors.primary }]}
            >
              <Feather name="edit" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        <View
          style={[
            styles.searchContainer,
            { backgroundColor: colors.surfaceSecondary },
          ]}
        >
          <Feather name="search" size={16} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search messages..."
            placeholderTextColor={colors.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
            </Pressable>
          )}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SwipeableRow
            rightActions={[
              {
                label: item.isMuted ? "Unmute" : "Mute",
                icon: item.isMuted ? "volume-2" : "volume-x",
                color: "#636366",
                onPress: () => muteChat(item.id),
              },
              {
                label: item.isPinned ? "Unpin" : "Pin",
                icon: "bookmark",
                color: "#FF9F0A",
                onPress: () => pinChat(item.id),
              },
              {
                label: "Delete",
                icon: "trash-2",
                color: "#FF453A",
                onPress: () => handleDelete(item.id),
              },
            ]}
          >
            <ChatListItem
              chat={item}
              onPress={() => handlePress(item)}
            />
          </SwipeableRow>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={64} color={colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No messages yet
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Start a conversation or create a group
            </Text>
            <Pressable
              onPress={() => router.push("/new-chat")}
              style={[styles.emptyButton, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.emptyButtonText}>New Message</Text>
            </Pressable>
          </View>
        }
        ItemSeparatorComponent={() => (
          <View
            style={[
              styles.separator,
              { backgroundColor: colors.border, marginLeft: 80 },
            ]}
          />
        )}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
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
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 80,
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  emptyButton: {
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
