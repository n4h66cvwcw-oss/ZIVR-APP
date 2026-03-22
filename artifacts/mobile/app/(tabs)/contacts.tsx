import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
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
import { useMessaging, type Contact } from "@/context/MessagingContext";
import { useCall } from "@/context/CallContext";
import { Avatar } from "@/components/Avatar";

function ContactRow({
  contact,
  onPress,
  onVoiceCall,
  onVideoCall,
}: {
  contact: Contact;
  onPress: () => void;
  onVoiceCall: () => void;
  onVideoCall: () => void;
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;

  const lastSeenText = contact.isOnline
    ? "Online"
    : contact.lastSeen
    ? `Last seen ${formatLastSeen(contact.lastSeen)}`
    : "";

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        styles.contactRow,
        { backgroundColor: colors.surface, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <Avatar name={contact.name} size={48} isOnline={contact.isOnline} />
      <View style={styles.contactInfo}>
        <Text style={[styles.contactName, { color: colors.text }]}>
          {contact.name}
        </Text>
        {contact.status && (
          <Text
            style={[styles.contactStatus, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {contact.status}
          </Text>
        )}
        {lastSeenText ? (
          <Text
            style={[
              styles.lastSeen,
              { color: contact.isOnline ? colors.secondary : colors.textTertiary },
            ]}
          >
            {lastSeenText}
          </Text>
        ) : null}
      </View>
      <View style={styles.contactActions}>
        <Pressable
          onPress={onVideoCall}
          hitSlop={8}
          style={[styles.callBtn, { backgroundColor: colors.primary + "15" }]}
        >
          <Ionicons name="videocam" size={18} color={colors.primary} />
        </Pressable>
        <Pressable
          onPress={onVoiceCall}
          hitSlop={8}
          style={[styles.callBtn, { backgroundColor: "#30D158" + "20" }]}
        >
          <Ionicons name="call" size={18} color="#30D158" />
        </Pressable>
        <Pressable
          onPress={onPress}
          style={[styles.messageBtn, { backgroundColor: colors.primary }]}
        >
          <Feather name="send" size={14} color="#FFFFFF" />
        </Pressable>
      </View>
    </Pressable>
  );
}

function formatLastSeen(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export default function ContactsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const { contacts, createDirectChat } = useMessaging();
  const { startCall } = useCall();
  const [search, setSearch] = useState("");

  const otherContacts = contacts.filter((c) => c.id !== "me");
  const filtered = otherContacts.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );
  const online = filtered.filter((c) => c.isOnline);
  const offline = filtered.filter((c) => !c.isOnline);

  const sections = [
    ...(online.length > 0
      ? [{ title: "Online", data: online, isSection: true }]
      : []),
    ...(offline.length > 0
      ? [{ title: "Contacts", data: offline, isSection: true }]
      : []),
  ];

  const handleMessage = async (contactId: string) => {
    const chatId = await createDirectChat(contactId);
    router.push(`/chat/${chatId}`);
  };

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
        <View style={styles.headerRow}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Contacts
          </Text>
          <Pressable
            onPress={() => router.push("/call-history")}
            style={[styles.recentsBtn, { backgroundColor: colors.primary + "15" }]}
          >
            <Ionicons name="time-outline" size={16} color={colors.primary} />
            <Text style={[styles.recentsBtnText, { color: colors.primary }]}>Recents</Text>
          </Pressable>
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
            placeholder="Search contacts..."
            placeholderTextColor={colors.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => {
          const showOnlineHeader = item.isOnline && (index === 0 || !filtered[index - 1]?.isOnline);
          const showOfflineHeader = !item.isOnline && (index === 0 || filtered[index - 1]?.isOnline);
          return (
            <>
              {showOnlineHeader && (
                <Text style={[styles.sectionHeader, { color: colors.textTertiary }]}>
                  Online
                </Text>
              )}
              {showOfflineHeader && (
                <Text style={[styles.sectionHeader, { color: colors.textTertiary }]}>
                  Contacts
                </Text>
              )}
              <ContactRow
                contact={item}
                onPress={() => handleMessage(item.id)}
                onVoiceCall={() => {
                  startCall(item.id, item.name, "voice");
                  router.push({ pathname: "/call/[id]", params: { id: item.id, name: item.name, type: "voice" } });
                }}
                onVideoCall={() => {
                  startCall(item.id, item.name, "video");
                  router.push({ pathname: "/call/[id]", params: { id: item.id, name: item.name, type: "video" } });
                }}
              />
            </>
          );
        }}
        ItemSeparatorComponent={() => (
          <View
            style={[
              styles.separator,
              { backgroundColor: colors.border, marginLeft: 76 },
            ]}
          />
        )}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        contentInsetAdjustmentBehavior="automatic"
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color={colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No contacts found
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
  headerTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
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
  sectionHeader: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  contactInfo: {
    flex: 1,
    gap: 2,
  },
  contactName: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  contactStatus: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  lastSeen: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  recentsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  recentsBtnText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  contactActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  callBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  messageBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_500Medium",
  },
});
