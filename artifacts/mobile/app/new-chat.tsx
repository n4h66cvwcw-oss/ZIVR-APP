import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
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
import { useMessaging } from "@/context/MessagingContext";
import { useServer, type ServerUser } from "@/context/ServerContext";
import { Avatar } from "@/components/Avatar";

type Tab = "contacts" | "find";

export default function NewChatScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const { contacts, createDirectChat, createServerDirectChat } = useMessaging();
  const { findUsers, serverUserId, isConnected } = useServer();

  const [tab, setTab] = useState<Tab>("contacts");
  const [search, setSearch] = useState("");
  const [serverResults, setServerResults] = useState<ServerUser[]>([]);
  const [searching, setSearching] = useState(false);

  const localOthers = contacts.filter(
    (c) =>
      c.id !== "me" && c.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelectLocal = async (contactId: string) => {
    Haptics.selectionAsync();
    const chatId = await createDirectChat(contactId);
    router.replace(`/chat/${chatId}`);
  };

  const handleSelectServer = async (user: ServerUser) => {
    Haptics.selectionAsync();
    const chatId = await createServerDirectChat(user);
    if (chatId) router.replace(`/chat/${chatId}`);
  };

  const handleSearch = useCallback(async (text: string) => {
    setSearch(text);
    if (tab !== "find") return;
    if (!text.trim()) { setServerResults([]); return; }
    setSearching(true);
    const results = await findUsers(text.trim());
    setServerResults(results.filter((u) => u.id !== serverUserId));
    setSearching(false);
  }, [tab, findUsers, serverUserId]);

  const switchTab = (t: Tab) => {
    setTab(t);
    setSearch("");
    setServerResults([]);
  };

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  const renderLocalContact = ({ item }: { item: typeof localOthers[0] }) => (
    <Pressable
      onPress={() => handleSelectLocal(item.id)}
      style={({ pressed }) => [
        styles.contactRow,
        { backgroundColor: colors.surface, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <Avatar name={item.name} size={48} isOnline={item.isOnline} />
      <View style={styles.contactInfo}>
        <Text style={[styles.contactName, { color: colors.text }]}>{item.name}</Text>
        {item.status && (
          <Text style={[styles.contactStatus, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.status}
          </Text>
        )}
      </View>
      {item.isOnline && (
        <View style={[styles.onlineBadge, { backgroundColor: colors.secondary + "20" }]}>
          <View style={[styles.onlineDot, { backgroundColor: colors.secondary }]} />
          <Text style={[styles.onlineText, { color: colors.secondary }]}>Online</Text>
        </View>
      )}
    </Pressable>
  );

  const renderServerUser = ({ item }: { item: ServerUser }) => (
    <Pressable
      onPress={() => handleSelectServer(item)}
      style={({ pressed }) => [
        styles.contactRow,
        { backgroundColor: colors.surface, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <Avatar name={item.displayName} size={48} isOnline={item.isOnline} />
      <View style={styles.contactInfo}>
        <View style={styles.nameRow}>
          <Text style={[styles.contactName, { color: colors.text }]}>{item.displayName}</Text>
          <View style={[styles.serverBadge, { backgroundColor: "#0A84FF20" }]}>
            <Text style={[styles.serverBadgeText, { color: "#0A84FF" }]}>VibeMsg</Text>
          </View>
        </View>
        {item.username && (
          <Text style={[styles.contactStatus, { color: colors.textSecondary }]}>
            @{item.username}
          </Text>
        )}
        {item.statusMessage && !item.username && (
          <Text style={[styles.contactStatus, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.statusMessage}
          </Text>
        )}
      </View>
      {item.isOnline && (
        <View style={[styles.onlineBadge, { backgroundColor: colors.secondary + "20" }]}>
          <View style={[styles.onlineDot, { backgroundColor: colors.secondary }]} />
          <Text style={[styles.onlineText, { color: colors.secondary }]}>Online</Text>
        </View>
      )}
    </Pressable>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: topPad, backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>New Message</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={[styles.tabs, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {(["contacts", "find"] as Tab[]).map((t) => (
          <Pressable key={t} onPress={() => switchTab(t)} style={[styles.tabBtn, tab === t && { borderBottomColor: "#0A84FF", borderBottomWidth: 2 }]}>
            <Text style={[styles.tabLabel, { color: tab === t ? "#0A84FF" : colors.textSecondary }]}>
              {t === "contacts" ? "My Contacts" : "Find People"}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={[styles.searchBar, { backgroundColor: colors.surfaceSecondary, borderBottomColor: colors.border }]}>
        <Feather name="search" size={16} color={colors.textTertiary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder={tab === "contacts" ? "Search contacts..." : "Search by name or @username..."}
          placeholderTextColor={colors.textTertiary}
          value={search}
          onChangeText={handleSearch}
          autoFocus
        />
        {searching && <ActivityIndicator size="small" color="#0A84FF" />}
      </View>

      {tab === "contacts" ? (
        <FlatList
          data={localOthers}
          keyExtractor={(item) => item.id}
          renderItem={renderLocalContact}
          ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.border, marginLeft: 76 }]} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="person-outline" size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No contacts found</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={serverResults}
          keyExtractor={(item) => item.id}
          renderItem={renderServerUser}
          ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.border, marginLeft: 76 }]} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              {!serverUserId ? (
                <>
                  <Ionicons name="person-add-outline" size={48} color={colors.textTertiary} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Connect your account to find people</Text>
                </>
              ) : !isConnected ? (
                <>
                  <Ionicons name="wifi-outline" size={48} color={colors.textTertiary} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Connecting to server...</Text>
                </>
              ) : search.length === 0 ? (
                <>
                  <Ionicons name="search-outline" size={48} color={colors.textTertiary} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Search for VibeMsg users by name or @username</Text>
                </>
              ) : (
                <>
                  <Ionicons name="person-outline" size={48} color={colors.textTertiary} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No users found for "{search}"</Text>
                </>
              )}
            </View>
          }
        />
      )}
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
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
  },
  tabLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, fontSize: 16, fontFamily: "Inter_400Regular" },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  contactInfo: { flex: 1, gap: 3 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  contactName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  contactStatus: { fontSize: 13, fontFamily: "Inter_400Regular" },
  serverBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  serverBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  onlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  onlineDot: { width: 6, height: 6, borderRadius: 3 },
  onlineText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  separator: { height: StyleSheet.hairlineWidth },
  emptyState: { alignItems: "center", paddingTop: 60, paddingHorizontal: 32, gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center" },
});
