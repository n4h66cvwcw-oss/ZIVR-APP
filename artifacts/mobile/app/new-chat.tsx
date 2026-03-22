import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useMessaging, type Contact } from "@/context/MessagingContext";
import { useServer, type ServerUser } from "@/context/ServerContext";
import { useProfile } from "@/context/ProfileContext";
import { Avatar } from "@/components/Avatar";

type Tab = "contacts" | "find" | "invite";

const INVITE_MSG = (senderName: string) =>
  `Hey! I've been using VibeMsg — it has real-time messaging, music messages, E2E encryption, and more. Come chat with me!\n\nDownload VibeMsg and look up @${senderName || "me"} to connect.`;

export default function NewChatScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const { contacts, createDirectChat, createServerDirectChat } = useMessaging();
  const { findUsers, serverUserId, isConnected } = useServer();
  const { profile } = useProfile();

  const [tab, setTab] = useState<Tab>("contacts");
  const [search, setSearch] = useState("");
  const [serverResults, setServerResults] = useState<ServerUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());

  const localOthers = contacts.filter(
    (c) => c.id !== "me" && c.name.toLowerCase().includes(search.toLowerCase())
  );

  const invitableContacts = contacts.filter(
    (c) =>
      c.id !== "me" &&
      c.phone &&
      c.name.toLowerCase().includes(search.toLowerCase())
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

  const handleInviteSms = useCallback(
    async (contact: Contact) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const msg = INVITE_MSG(profile.username || profile.displayName);
      const phone = contact.phone?.replace(/\D/g, "") ?? "";
      const smsUrl =
        Platform.OS === "ios"
          ? `sms:${phone}&body=${encodeURIComponent(msg)}`
          : `sms:${phone}?body=${encodeURIComponent(msg)}`;

      const canOpen = await Linking.canOpenURL(smsUrl).catch(() => false);
      if (canOpen) {
        await Linking.openURL(smsUrl);
        setInvitedIds((prev) => new Set([...prev, contact.id]));
      } else {
        await Share.share({ message: msg });
        setInvitedIds((prev) => new Set([...prev, contact.id]));
      }
    },
    [profile.username, profile.displayName]
  );

  const handleInviteGeneral = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const msg = INVITE_MSG(profile.username || profile.displayName);
    try {
      await Share.share({ message: msg, title: "Join me on VibeMsg!" });
    } catch {
      Alert.alert("Could not open share sheet");
    }
  }, [profile.username, profile.displayName]);

  const handleSearch = useCallback(
    async (text: string) => {
      setSearch(text);
      if (tab !== "find") return;
      if (!text.trim()) {
        setServerResults([]);
        return;
      }
      setSearching(true);
      const results = await findUsers(text.trim());
      setServerResults(results.filter((u) => u.id !== serverUserId));
      setSearching(false);
    },
    [tab, findUsers, serverUserId]
  );

  const switchTab = (t: Tab) => {
    setTab(t);
    setSearch("");
    setServerResults([]);
  };

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  const renderLocalContact = ({ item }: { item: Contact }) => (
    <Pressable
      onPress={() => handleSelectLocal(item.id)}
      style={({ pressed }) => [
        styles.contactRow,
        { backgroundColor: colors.surface, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Avatar name={item.name} size={48} isOnline={item.isOnline} />
      <View style={styles.contactInfo}>
        <Text style={[styles.contactName, { color: colors.text }]}>{item.name}</Text>
        {item.status && (
          <Text
            style={[styles.contactStatus, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {item.status}
          </Text>
        )}
        {!item.status && item.phone && (
          <Text style={[styles.contactStatus, { color: colors.textTertiary }]}>
            {item.phone}
          </Text>
        )}
      </View>
      <View style={styles.rowActions}>
        {item.isOnline && (
          <View style={[styles.onlineBadge, { backgroundColor: colors.secondary + "20" }]}>
            <View style={[styles.onlineDot, { backgroundColor: colors.secondary }]} />
            <Text style={[styles.onlineText, { color: colors.secondary }]}>Online</Text>
          </View>
        )}
        {item.phone && (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              handleInviteSms(item);
            }}
            hitSlop={10}
            style={[
              styles.inviteBtn,
              invitedIds.has(item.id)
                ? { backgroundColor: "#34C75918" }
                : { backgroundColor: "#0A84FF18" },
            ]}
          >
            <Ionicons
              name={invitedIds.has(item.id) ? "checkmark" : "person-add-outline"}
              size={14}
              color={invitedIds.has(item.id) ? "#34C759" : "#0A84FF"}
            />
            <Text
              style={[
                styles.inviteBtnText,
                { color: invitedIds.has(item.id) ? "#34C759" : "#0A84FF" },
              ]}
            >
              {invitedIds.has(item.id) ? "Sent" : "Invite"}
            </Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );

  const renderInvitableContact = ({ item }: { item: Contact }) => (
    <View
      style={[styles.contactRow, { backgroundColor: colors.surface }]}
    >
      <Avatar name={item.name} size={48} />
      <View style={styles.contactInfo}>
        <Text style={[styles.contactName, { color: colors.text }]}>{item.name}</Text>
        <Text style={[styles.contactStatus, { color: colors.textTertiary }]}>
          {item.phone}
        </Text>
      </View>
      <Pressable
        onPress={() => handleInviteSms(item)}
        style={({ pressed }) => [
          styles.invitePrimaryBtn,
          invitedIds.has(item.id)
            ? { backgroundColor: "#34C75920" }
            : { backgroundColor: "#0A84FF" },
          pressed && { opacity: 0.8 },
        ]}
      >
        <Ionicons
          name={invitedIds.has(item.id) ? "checkmark" : "paper-plane-outline"}
          size={15}
          color={invitedIds.has(item.id) ? "#34C759" : "#fff"}
        />
        <Text
          style={[
            styles.invitePrimaryBtnText,
            { color: invitedIds.has(item.id) ? "#34C759" : "#fff" },
          ]}
        >
          {invitedIds.has(item.id) ? "Sent!" : "Invite"}
        </Text>
      </Pressable>
    </View>
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
        {item.username ? (
          <Text style={[styles.contactStatus, { color: colors.textSecondary }]}>
            @{item.username}
          </Text>
        ) : item.statusMessage ? (
          <Text
            style={[styles.contactStatus, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {item.statusMessage}
          </Text>
        ) : null}
      </View>
      {item.isOnline && (
        <View style={[styles.onlineBadge, { backgroundColor: colors.secondary + "20" }]}>
          <View style={[styles.onlineDot, { backgroundColor: colors.secondary }]} />
          <Text style={[styles.onlineText, { color: colors.secondary }]}>Online</Text>
        </View>
      )}
    </Pressable>
  );

  const inviteListHeader = (
    <View>
      <Pressable onPress={handleInviteGeneral} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}>
        <LinearGradient
          colors={["#0A84FF", "#5E5CE6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.inviteBanner}
        >
          <View style={styles.inviteBannerIcon}>
            <Ionicons name="share-social" size={24} color="#fff" />
          </View>
          <View style={styles.inviteBannerText}>
            <Text style={styles.inviteBannerTitle}>Share VibeMsg</Text>
            <Text style={styles.inviteBannerSub}>
              Invite anyone — even without their number
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
        </LinearGradient>
      </Pressable>
      {invitableContacts.length > 0 && (
        <Text
          style={[styles.sectionLabel, { color: colors.textSecondary, backgroundColor: colors.background }]}
        >
          FROM YOUR CONTACTS ({invitableContacts.filter((c) => !invitedIds.has(c.id)).length} not yet on VibeMsg)
        </Text>
      )}
    </View>
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
        {tab === "find" && serverUserId ? (
          <Pressable
            onPress={() => router.push({ pathname: "/new-group", params: { serverGroup: "true" } })}
            hitSlop={12}
          >
            <Ionicons name="people-outline" size={24} color={colors.primary} />
          </Pressable>
        ) : (
          <View style={{ width: 24 }} />
        )}
      </View>

      <View
        style={[styles.tabs, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
      >
        {(["contacts", "find", "invite"] as Tab[]).map((t) => (
          <Pressable
            key={t}
            onPress={() => switchTab(t)}
            style={[
              styles.tabBtn,
              tab === t && { borderBottomColor: "#0A84FF", borderBottomWidth: 2 },
            ]}
          >
            <Text
              style={[
                styles.tabLabel,
                { color: tab === t ? "#0A84FF" : colors.textSecondary },
              ]}
            >
              {t === "contacts" ? "My Contacts" : t === "find" ? "Find People" : "Invite"}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab !== "invite" && (
        <View
          style={[
            styles.searchBar,
            { backgroundColor: colors.surfaceSecondary, borderBottomColor: colors.border },
          ]}
        >
          <Feather name="search" size={16} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder={
              tab === "contacts"
                ? "Search contacts..."
                : "Search by name or @username..."
            }
            placeholderTextColor={colors.textTertiary}
            value={search}
            onChangeText={handleSearch}
            autoFocus
          />
          {searching && <ActivityIndicator size="small" color="#0A84FF" />}
        </View>
      )}

      {tab === "contacts" && (
        <FlatList
          data={localOthers}
          keyExtractor={(item) => item.id}
          renderItem={renderLocalContact}
          ItemSeparatorComponent={() => (
            <View style={[styles.separator, { backgroundColor: colors.border, marginLeft: 76 }]} />
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="person-outline" size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No contacts found
              </Text>
            </View>
          }
        />
      )}

      {tab === "find" && (
        <FlatList
          data={serverResults}
          keyExtractor={(item) => item.id}
          renderItem={renderServerUser}
          ItemSeparatorComponent={() => (
            <View style={[styles.separator, { backgroundColor: colors.border, marginLeft: 76 }]} />
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              {!serverUserId ? (
                <>
                  <Ionicons name="person-add-outline" size={48} color={colors.textTertiary} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    Connect your account to find people
                  </Text>
                </>
              ) : !isConnected ? (
                <>
                  <Ionicons name="wifi-outline" size={48} color={colors.textTertiary} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    Connecting to server...
                  </Text>
                </>
              ) : search.length === 0 ? (
                <>
                  <Ionicons name="search-outline" size={48} color={colors.textTertiary} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    Search for VibeMsg users by name or @username
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons name="person-outline" size={48} color={colors.textTertiary} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    No users found for "{search}"
                  </Text>
                  <Pressable
                    onPress={handleInviteGeneral}
                    style={[styles.inviteFromSearch, { backgroundColor: "#0A84FF18" }]}
                  >
                    <Ionicons name="paper-plane-outline" size={16} color="#0A84FF" />
                    <Text style={[styles.inviteFromSearchText, { color: "#0A84FF" }]}>
                      Invite "{search}" to VibeMsg
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          }
        />
      )}

      {tab === "invite" && (
        <FlatList
          data={invitableContacts}
          keyExtractor={(item) => item.id}
          renderItem={renderInvitableContact}
          ListHeaderComponent={inviteListHeader}
          ItemSeparatorComponent={() => (
            <View style={[styles.separator, { backgroundColor: colors.border, marginLeft: 76 }]} />
          )}
          ListEmptyComponent={
            <View>
              {inviteListHeader}
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No contacts with phone numbers found.{"\n"}Sync your contacts first or use the button above to share the link.
                </Text>
              </View>
            </View>
          }
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
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
  tabLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
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
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  contactName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  contactStatus: { fontSize: 13, fontFamily: "Inter_400Regular" },
  rowActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  serverBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
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
  inviteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  inviteBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  invitePrimaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  invitePrimaryBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  separator: { height: StyleSheet.hairlineWidth },
  emptyState: {
    alignItems: "center",
    paddingTop: 40,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center" },
  inviteFromSearch: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 4,
  },
  inviteFromSearchText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  inviteBanner: {
    margin: 16,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  inviteBannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  inviteBannerText: { flex: 1 },
  inviteBannerTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  inviteBannerSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});
