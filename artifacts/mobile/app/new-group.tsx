import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState, useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
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
import { useMessaging } from "@/context/MessagingContext";
import { useServer, type ServerUser } from "@/context/ServerContext";
import { Avatar } from "@/components/Avatar";

export default function NewGroupScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const { serverGroup: serverGroupParam } = useLocalSearchParams<{ serverGroup?: string }>();
  const isServerGroup = serverGroupParam === "true";

  const { contacts, createGroupChat } = useMessaging();
  const { findUsers, createServerGroupChat, serverUserId, isConnected } = useServer();

  const [groupName, setGroupName] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<ServerUser[]>([]);
  const [serverResults, setServerResults] = useState<ServerUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);

  const localOthers = contacts.filter(
    (c) => c.id !== "me" && c.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSearchServer = useCallback(async (text: string) => {
    setSearch(text);
    if (!text.trim()) { setServerResults([]); return; }
    setSearching(true);
    const results = await findUsers(text.trim());
    setServerResults(results.filter((u) => u.id !== serverUserId));
    setSearching(false);
  }, [findUsers, serverUserId]);

  const toggleLocal = (id: string) => {
    Haptics.selectionAsync();
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const toggleServer = (user: ServerUser) => {
    Haptics.selectionAsync();
    const alreadySelected = selectedUsers.some((u) => u.id === user.id);
    if (alreadySelected) {
      setSelectedUsers((prev) => prev.filter((u) => u.id !== user.id));
    } else {
      setSelectedUsers((prev) => [...prev, user]);
    }
  };

  const canCreate = groupName.trim() && (isServerGroup ? selectedUsers.length > 0 : selected.length > 0);

  const handleCreate = async () => {
    if (!canCreate || creating) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCreating(true);
    if (isServerGroup && serverUserId) {
      const memberIds = selectedUsers.map((u) => u.id);
      const chatId = await createServerGroupChat(serverUserId, groupName.trim(), memberIds);
      if (chatId) router.replace(`/chat/${chatId}`);
    } else {
      const chatId = await createGroupChat(groupName.trim(), selected);
      router.replace(`/chat/${chatId}`);
    }
    setCreating(false);
  };

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

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
        <View style={{ alignItems: "center" }}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {isServerGroup ? "Server Group" : "New Group"}
          </Text>
          {isServerGroup && (
            <View style={[styles.serverBadge, { backgroundColor: colors.primary + "18" }]}>
              <Ionicons name="wifi" size={10} color={colors.primary} />
              <Text style={[styles.serverBadgeText, { color: colors.primary }]}>Real-time</Text>
            </View>
          )}
        </View>
        <Pressable onPress={handleCreate} disabled={!canCreate || creating}>
          {creating ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={[styles.createBtn, { color: canCreate ? colors.primary : colors.textTertiary }]}>
              Create
            </Text>
          )}
        </Pressable>
      </View>

      <View
        style={[styles.nameSection, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
      >
        <View style={[styles.groupNameInput, { backgroundColor: colors.surfaceSecondary }]}>
          <Ionicons name="people" size={20} color={colors.textTertiary} />
          <TextInput
            style={[styles.nameInput, { color: colors.text }]}
            placeholder="Group name..."
            placeholderTextColor={colors.textTertiary}
            value={groupName}
            onChangeText={setGroupName}
            autoFocus
          />
        </View>
      </View>

      {(isServerGroup ? selectedUsers.length > 0 : selected.length > 0) && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.selectedBar, { borderBottomColor: colors.border }]}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 10 }}
        >
          {isServerGroup
            ? selectedUsers.map((user) => (
                <Pressable key={user.id} onPress={() => toggleServer(user)} style={styles.selectedChip}>
                  <Avatar name={user.displayName} size={44} isOnline={user.isOnline} />
                  <View style={[styles.selectedRemove, { backgroundColor: colors.danger }]}>
                    <Feather name="x" size={10} color="#FFF" />
                  </View>
                  <Text style={[styles.selectedName, { color: colors.textSecondary }]} numberOfLines={1}>
                    {user.displayName.split(" ")[0]}
                  </Text>
                </Pressable>
              ))
            : selected.map((id) => {
                const c = contacts.find((x) => x.id === id);
                if (!c) return null;
                return (
                  <Pressable key={id} onPress={() => toggleLocal(id)} style={styles.selectedChip}>
                    <Avatar name={c.name} size={44} />
                    <View style={[styles.selectedRemove, { backgroundColor: colors.danger }]}>
                      <Feather name="x" size={10} color="#FFF" />
                    </View>
                    <Text style={[styles.selectedName, { color: colors.textSecondary }]} numberOfLines={1}>
                      {c.name.split(" ")[0]}
                    </Text>
                  </Pressable>
                );
              })}
        </ScrollView>
      )}

      <View
        style={[styles.searchContainer, { backgroundColor: colors.surfaceSecondary, borderBottomColor: colors.border }]}
      >
        <Feather name="search" size={16} color={colors.textTertiary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder={isServerGroup ? "Search ZIVR users..." : "Add people..."}
          placeholderTextColor={colors.textTertiary}
          value={search}
          onChangeText={isServerGroup ? handleSearchServer : setSearch}
        />
        {searching && <ActivityIndicator size="small" color={colors.primary} />}
      </View>

      {isServerGroup ? (
        <FlatList
          data={serverResults}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isSelected = selectedUsers.some((u) => u.id === item.id);
            return (
              <Pressable
                onPress={() => toggleServer(item)}
                style={({ pressed }) => [
                  styles.contactRow,
                  { backgroundColor: isSelected ? colors.primary + "12" : colors.surface, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Avatar name={item.displayName} size={48} isOnline={item.isOnline} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.contactName, { color: colors.text }]}>{item.displayName}</Text>
                  {item.username && (
                    <Text style={[styles.contactSub, { color: colors.textSecondary }]}>@{item.username}</Text>
                  )}
                </View>
                <View
                  style={[
                    styles.checkCircle,
                    {
                      backgroundColor: isSelected ? colors.primary : colors.surfaceSecondary,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  {isSelected && <Feather name="check" size={14} color="#FFF" />}
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              {!isConnected ? (
                <>
                  <Ionicons name="wifi-outline" size={40} color={colors.textTertiary} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Connecting…</Text>
                </>
              ) : search.length === 0 ? (
                <>
                  <Ionicons name="search-outline" size={40} color={colors.textTertiary} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Search for ZIVR users to add</Text>
                </>
              ) : (
                <>
                  <Ionicons name="person-outline" size={40} color={colors.textTertiary} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No users found</Text>
                </>
              )}
            </View>
          }
          ItemSeparatorComponent={() => (
            <View style={[styles.separator, { backgroundColor: colors.border, marginLeft: 76 }]} />
          )}
        />
      ) : (
        <FlatList
          data={localOthers}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isSelected = selected.includes(item.id);
            return (
              <Pressable
                onPress={() => toggleLocal(item.id)}
                style={({ pressed }) => [
                  styles.contactRow,
                  { backgroundColor: isSelected ? colors.primary + "12" : colors.surface, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Avatar name={item.name} size={48} isOnline={item.isOnline} />
                <Text style={[styles.contactName, { color: colors.text, flex: 1 }]}>{item.name}</Text>
                <View
                  style={[
                    styles.checkCircle,
                    {
                      backgroundColor: isSelected ? colors.primary : colors.surfaceSecondary,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  {isSelected && <Feather name="check" size={14} color="#FFF" />}
                </View>
              </Pressable>
            );
          }}
          ItemSeparatorComponent={() => (
            <View style={[styles.separator, { backgroundColor: colors.border, marginLeft: 76 }]} />
          )}
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
  serverBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
  },
  serverBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  createBtn: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  nameSection: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  groupNameInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  nameInput: { flex: 1, fontSize: 16, fontFamily: "Inter_400Regular" },
  selectedBar: { borderBottomWidth: StyleSheet.hairlineWidth },
  selectedChip: { alignItems: "center", gap: 4, width: 52, position: "relative" },
  selectedRemove: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedName: { fontSize: 10, fontFamily: "Inter_500Medium", textAlign: "center" },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  contactName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  contactSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  separator: { height: StyleSheet.hairlineWidth },
  emptyState: { alignItems: "center", justifyContent: "center", padding: 40, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
});
