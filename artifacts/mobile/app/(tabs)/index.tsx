import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState, useCallback, useMemo } from "react";
import {
  Alert,
  FlatList,
  Image,
  Modal,
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
import { useMessaging, type Chat, type ChatSortMode } from "@/context/MessagingContext";
import { useProfile } from "@/context/ProfileContext";
import { ChatListItem } from "@/components/ChatListItem";
import { SwipeableRow } from "@/components/SwipeableRow";
import { PasscodeModal } from "@/components/PasscodeModal";
import { ManageGroupsModal } from "@/components/ManageGroupsModal";
import { useContactGroups } from "@/hooks/useContactGroups";
import { FavoritesStrip } from "@/components/FavoritesStrip";
import { useFavorites } from "@/context/FavoritesContext";

type FilterTab = "all" | "direct" | "groups" | "pinned" | "unread" | "encrypted";

export default function ChatsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const { chats, deleteChat, pinChat, muteChat, sortMode, setSortMode, verifyChatPasscode, removeChatPasscode } = useMessaging();
  const { profile } = useProfile();
  const { groups } = useContactGroups();
  const { favorites, addFavorite, removeFavorite, isFavorited } = useFavorites();
  const [search, setSearch] = useState("");
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [showSortModal, setShowSortModal] = useState(false);
  const [showGroupManager, setShowGroupManager] = useState(false);
  const [pendingChat, setPendingChat] = useState<Chat | null>(null);
  const [showPasscode, setShowPasscode] = useState(false);

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  const visibleChats = useMemo(() => {
    let list = chats.filter((c) => c.type !== "checkin");

    if (search.trim()) {
      list = list.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));
    }

    if (activeGroupId) {
      const group = groups.find((g) => g.id === activeGroupId);
      if (group) list = list.filter((c) => group.chatIds.includes(c.id));
    }

    switch (filterTab) {
      case "direct":
        list = list.filter((c) => c.type === "direct");
        break;
      case "groups":
        list = list.filter((c) => c.type === "group");
        break;
      case "pinned":
        list = list.filter((c) => c.isPinned);
        break;
      case "unread":
        list = list.filter((c) => (c.unreadCount || 0) > 0);
        break;
      case "encrypted":
        list = list.filter((c) => c.isEncrypted);
        break;
    }

    return list.sort((a, b) => {
      if (sortMode === "pinned-first") {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
      }
      switch (sortMode) {
        case "recent":
        default:
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return (b.lastMessageTime || b.createdAt) - (a.lastMessageTime || a.createdAt);
        case "alphabetical":
          return a.name.localeCompare(b.name);
        case "unread":
          return (b.unreadCount || 0) - (a.unreadCount || 0);
        case "oldest":
          return (a.lastMessageTime || a.createdAt) - (b.lastMessageTime || b.createdAt);
        case "pinned-first":
          return (b.lastMessageTime || b.createdAt) - (a.lastMessageTime || a.createdAt);
      }
    });
  }, [chats, search, filterTab, sortMode, activeGroupId, groups]);

  const handlePress = useCallback((chat: Chat) => {
    if (chat.passcodeHash) {
      setPendingChat(chat);
      setShowPasscode(true);
    } else {
      router.push(`/chat/${chat.id}`);
    }
  }, []);

  const handlePasscodeSuccess = useCallback(() => {
    if (!pendingChat) return;
    const chatId = pendingChat.id;
    const passcode = _lastPasscodeRef.current;
    if (verifyChatPasscode(chatId, passcode)) {
      setShowPasscode(false);
      setPendingChat(null);
      router.push(`/chat/${chatId}`);
    } else {
      setShowPasscode(false);
      setTimeout(() => setShowPasscode(true), 100);
    }
  }, [pendingChat, verifyChatPasscode]);

  const _lastPasscodeRef = React.useRef("");

  const handleDelete = useCallback((chatId: string) => {
    Alert.alert("Delete Chat", "This will permanently delete all messages. Continue?", [
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
  }, [deleteChat]);

  const SORT_OPTIONS: { key: ChatSortMode; label: string; icon: string }[] = [
    { key: "recent", label: "Most Recent", icon: "time-outline" },
    { key: "unread", label: "Unread First", icon: "mail-unread-outline" },
    { key: "alphabetical", label: "Alphabetical", icon: "text-outline" },
    { key: "oldest", label: "Oldest First", icon: "calendar-outline" },
    { key: "pinned-first", label: "Pinned First", icon: "pin-outline" },
  ];

  const FILTER_TABS: { key: FilterTab; label: string; icon: string }[] = [
    { key: "all", label: "All", icon: "chatbubbles-outline" },
    { key: "unread", label: "Unread", icon: "ellipse" },
    { key: "direct", label: "Direct", icon: "person-outline" },
    { key: "groups", label: "Groups", icon: "people-outline" },
    { key: "pinned", label: "Pinned", icon: "pin-outline" },
    { key: "encrypted", label: "Encrypted", icon: "lock-closed-outline" },
  ];

  const unreadTotal = chats.reduce((acc, c) => acc + (c.unreadCount || 0), 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 8, backgroundColor: colors.background, borderBottomColor: colors.border },
        ]}
      >
        <View style={styles.headerTop}>
          <Pressable onPress={() => router.push("/profile")} hitSlop={8} style={styles.profileBtn}>
            {profile.avatar ? (
              <Image source={{ uri: profile.avatar }} style={styles.profileAvatarImg} />
            ) : (
              <View style={[styles.profileAvatar, { backgroundColor: colors.primary }]}>
                {profile.displayName ? (
                  <Text style={styles.profileAvatarInitial}>
                    {profile.displayName.charAt(0).toUpperCase()}
                  </Text>
                ) : (
                  <Ionicons name="person" size={18} color="#FFF" />
                )}
              </View>
            )}
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Messages</Text>
            {unreadTotal > 0 && (
              <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                {unreadTotal} unread
              </Text>
            )}
          </View>
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => router.push("/search")}
              style={[styles.headerBtn, { backgroundColor: colors.surfaceSecondary }]}
              hitSlop={8}
            >
              <Feather name="search" size={18} color={colors.primary} />
            </Pressable>
            <Pressable
              onPress={() => setShowSortModal(true)}
              style={[styles.headerBtn, { backgroundColor: colors.surfaceSecondary }]}
              hitSlop={8}
            >
              <Ionicons name="funnel-outline" size={18} color={colors.primary} />
            </Pressable>
            <Pressable
              onPress={() => router.push("/skin-store")}
              style={[styles.headerBtn, { backgroundColor: colors.surfaceSecondary }]}
              hitSlop={8}
            >
              <Ionicons name="color-palette-outline" size={20} color={colors.primary} />
            </Pressable>
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

        <View style={[styles.searchContainer, { backgroundColor: colors.surfaceSecondary }]}>
          <Feather name="search" size={16} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search messages..."
            placeholderTextColor={colors.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 ? (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
            </Pressable>
          ) : (
            <Pressable onPress={() => router.push("/search")} hitSlop={8}>
              <Ionicons name="options-outline" size={16} color={colors.textTertiary} />
            </Pressable>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterTabsRow}>
          {FILTER_TABS.map((tab) => {
            const active = filterTab === tab.key;
            const count =
              tab.key === "unread"
                ? chats.filter((c) => c.type !== "checkin" && (c.unreadCount || 0) > 0).length
                : tab.key === "pinned"
                ? chats.filter((c) => c.type !== "checkin" && c.isPinned).length
                : tab.key === "encrypted"
                ? chats.filter((c) => c.type !== "checkin" && c.isEncrypted).length
                : 0;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setFilterTab(tab.key)}
                style={[
                  styles.filterTab,
                  {
                    backgroundColor: active ? colors.primary : colors.surfaceSecondary,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                <Ionicons
                  name={tab.icon as any}
                  size={13}
                  color={active ? "#FFF" : colors.textSecondary}
                />
                <Text style={[styles.filterTabText, { color: active ? "#FFF" : colors.textSecondary }]}>
                  {tab.label}
                </Text>
                {count > 0 && (
                  <View style={[styles.filterBadge, { backgroundColor: active ? "rgba(255,255,255,0.3)" : colors.primary }]}>
                    <Text style={styles.filterBadgeText}>{count}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        {groups.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.groupsRow} contentContainerStyle={styles.groupsRowContent}>
            {groups.map((group) => {
              const active = activeGroupId === group.id;
              return (
                <Pressable
                  key={group.id}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setActiveGroupId(active ? null : group.id);
                  }}
                  onLongPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setShowGroupManager(true);
                  }}
                  style={[
                    styles.groupChip,
                    {
                      backgroundColor: active ? group.color : colors.surfaceSecondary,
                      borderColor: active ? group.color : colors.border,
                    },
                  ]}
                >
                  <Text style={styles.groupChipEmoji}>{group.emoji}</Text>
                  <Text style={[styles.groupChipText, { color: active ? "#fff" : colors.textSecondary }]}>
                    {group.name}
                  </Text>
                  {group.chatIds.length > 0 && (
                    <View style={[styles.groupChipBadge, { backgroundColor: active ? "rgba(255,255,255,0.3)" : group.color + "30" }]}>
                      <Text style={[styles.groupChipBadgeText, { color: active ? "#fff" : group.color }]}>
                        {group.chatIds.length}
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => setShowGroupManager(true)}
              style={[styles.groupChip, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
            >
              <Ionicons name="settings-outline" size={13} color={colors.textSecondary} />
              <Text style={[styles.groupChipText, { color: colors.textSecondary }]}>Manage</Text>
            </Pressable>
          </ScrollView>
        )}

        <View style={styles.sortRow}>
          <Pressable onPress={() => setShowSortModal(true)} style={styles.sortBtn}>
            <Ionicons name="swap-vertical" size={14} color={colors.textSecondary} />
            <Text style={[styles.sortLabel, { color: colors.textSecondary }]}>
              {SORT_OPTIONS.find((o) => o.key === sortMode)?.label || "Sort"}
            </Text>
          </Pressable>
          <Pressable onPress={() => router.push("/widget-settings")} style={styles.widgetBtn}>
            <Ionicons name="phone-portrait-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.sortLabel, { color: colors.textSecondary }]}>Widgets</Text>
          </Pressable>
        </View>
      </View>

      <FavoritesStrip tab="chats" />

      <FlatList
        data={visibleChats}
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
                label: isFavorited(item.id) ? "Unfave" : "Favorite",
                icon: "star",
                color: "#FFD700",
                onPress: () => {
                  if (isFavorited(item.id)) {
                    const existing = favorites.find((f) => f.chatId === item.id && !f.messageId);
                    if (existing) removeFavorite(existing.id);
                  } else {
                    addFavorite({
                      type: "chat",
                      name: item.name,
                      avatar: item.avatar,
                      chatId: item.id,
                    });
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  }
                },
              },
              {
                label: "Settings",
                icon: "settings",
                color: colors.primary,
                onPress: () => router.push(`/chat-settings/${item.id}`),
              },
              {
                label: "Delete",
                icon: "trash-2",
                color: "#FF453A",
                onPress: () => handleDelete(item.id),
              },
            ]}
          >
            <ChatListItem chat={item} onPress={() => handlePress(item)} />
          </SwipeableRow>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={64} color={colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {filterTab === "all" && !search ? "No messages yet" : "No results"}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              {filterTab === "encrypted"
                ? "Enable encryption from Chat Settings"
                : filterTab === "pinned"
                ? "Swipe left on a chat to pin it"
                : "Start a conversation or create a group"}
            </Text>
            {filterTab === "all" && !search && (
              <Pressable
                onPress={() => router.push("/new-chat")}
                style={[styles.emptyButton, { backgroundColor: colors.primary }]}
              >
                <Text style={styles.emptyButtonText}>New Message</Text>
              </Pressable>
            )}
          </View>
        }
        ItemSeparatorComponent={() => (
          <View style={[styles.separator, { backgroundColor: colors.border, marginLeft: 80 }]} />
        )}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      />

      <Modal visible={showSortModal} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowSortModal(false)}>
          <View style={[styles.sortModal, { backgroundColor: colors.surface }]}>
            <View style={[styles.sortModalHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sortModalTitle, { color: colors.text }]}>Organize Messages</Text>
            {SORT_OPTIONS.map((opt) => {
              const active = sortMode === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => { setSortMode(opt.key); setShowSortModal(false); }}
                  style={({ pressed }) => [
                    styles.sortOption,
                    { backgroundColor: pressed ? colors.surfaceSecondary : "transparent" },
                  ]}
                >
                  <View style={[styles.sortOptionIcon, { backgroundColor: active ? colors.primary + "18" : colors.surfaceSecondary }]}>
                    <Ionicons name={opt.icon as any} size={18} color={active ? colors.primary : colors.textSecondary} />
                  </View>
                  <Text style={[styles.sortOptionLabel, { color: active ? colors.primary : colors.text, fontFamily: active ? "Inter_600SemiBold" : "Inter_400Regular" }]}>
                    {opt.label}
                  </Text>
                  {active && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                </Pressable>
              );
            })}
            <View style={[styles.sortDivider, { backgroundColor: colors.border }]} />
            <Pressable
              onPress={() => { setShowSortModal(false); router.push("/widget-settings"); }}
              style={styles.sortOption}
            >
              <View style={[styles.sortOptionIcon, { backgroundColor: colors.surfaceSecondary }]}>
                <Ionicons name="phone-portrait-outline" size={18} color={colors.textSecondary} />
              </View>
              <Text style={[styles.sortOptionLabel, { color: colors.text, fontFamily: "Inter_400Regular" }]}>
                Manage Home Widgets
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {pendingChat && (
        <PasscodeModal
          visible={showPasscode}
          title={`Unlock ${pendingChat.name}`}
          subtitle="Enter your passcode to open this chat"
          hint={pendingChat.passcodeHint}
          recoveryEmail={pendingChat.recoveryEmail}
          onSuccess={() => {
            setShowPasscode(false);
            router.push(`/chat/${pendingChat.id}`);
            setPendingChat(null);
          }}
          onCancel={() => {
            setShowPasscode(false);
            setPendingChat(null);
          }}
          onRemove={pendingChat ? () => {
            removeChatPasscode(pendingChat.id);
            setShowPasscode(false);
            setPendingChat(null);
          } : undefined}
        />
      )}

      <ManageGroupsModal
        visible={showGroupManager}
        onClose={() => setShowGroupManager(false)}
        chats={chats}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  headerTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  profileBtn: { marginTop: 2 },
  profileAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  profileAvatarImg: { width: 36, height: 36, borderRadius: 18 },
  profileAvatarInitial: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#FFF" },
  headerTitle: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  headerActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  headerBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  filterTabsRow: { flexGrow: 0 },
  groupsRow: { flexGrow: 0 },
  groupsRowContent: { paddingRight: 4, gap: 8, alignItems: "center" },
  groupChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  groupChipEmoji: { fontSize: 14 },
  groupChipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  groupChipBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  groupChipBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  filterTab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 5,
  },
  filterTabText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  filterBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  filterBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#FFF" },
  sortRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sortBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
  widgetBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
  sortLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  separator: { height: StyleSheet.hairlineWidth },
  emptyState: { alignItems: "center", paddingTop: 80, paddingHorizontal: 40, gap: 12 },
  emptyTitle: { fontSize: 20, fontFamily: "Inter_600SemiBold", marginTop: 8 },
  emptySubtitle: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  emptyButton: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  emptyButtonText: { color: "#FFFFFF", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sortModal: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, gap: 4 },
  sortModalHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 12 },
  sortModalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 8 },
  sortOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 12,
  },
  sortOptionIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  sortOptionLabel: { flex: 1, fontSize: 16 },
  sortDivider: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
});
