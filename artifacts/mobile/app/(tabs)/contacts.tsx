import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState, useCallback, useRef } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
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
import { useCall } from "@/context/CallContext";
import { FavoritesStrip } from "@/components/FavoritesStrip";
import { useFavorites } from "@/context/FavoritesContext";
import { Avatar } from "@/components/Avatar";
import { useContactSync } from "@/hooks/useContactSync";
import { useContactGroups } from "@/hooks/useContactGroups";

const INVITE_LINK = "https://zivr.app/join";
const INVITE_MESSAGE = `Hey! I'm using ZIVR to send musical messages and more. Join me here: ${INVITE_LINK}`;

const GROUP_COLORS = ["#30D158", "#FF375F", "#0A84FF", "#BF5AF2", "#FF9F0A", "#5E5CE6", "#FF6B6B", "#00C7BE"];
const GROUP_EMOJIS = ["👥", "👨‍👩‍👧", "❤️", "💼", "🎉", "⭐", "🏠", "🌍", "🎵", "🏋️"];

// ─── Contact Group Modal ──────────────────────────────────────────────────────

function ContactGroupModal({
  visible,
  contact,
  onClose,
  colors,
  insets,
  getChatId,
}: {
  visible: boolean;
  contact: Contact | null;
  onClose: () => void;
  colors: typeof Colors.light;
  insets: { top: number; bottom: number };
  getChatId: (contactId: string) => Promise<string>;
}) {
  const { groups, createGroup, toggleChatInGroup } = useContactGroups();
  const [chatId, setChatId] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupEmoji, setNewGroupEmoji] = useState("👥");
  const [newGroupColor, setNewGroupColor] = useState("#0A84FF");
  const nameInputRef = useRef<TextInput>(null);

  // Resolve the direct chat ID when modal opens
  React.useEffect(() => {
    if (!visible || !contact) {
      setChatId(null);
      setCreating(false);
      setNewGroupName("");
      return;
    }
    setResolving(true);
    getChatId(contact.id)
      .then((id) => setChatId(id))
      .catch(() => setChatId(null))
      .finally(() => setResolving(false));
  }, [visible, contact?.id]);

  const handleToggleGroup = async (groupId: string) => {
    if (!chatId) return;
    Haptics.selectionAsync();
    toggleChatInGroup(groupId, chatId);
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newId = createGroup(newGroupName.trim(), newGroupEmoji, newGroupColor);
    if (chatId) {
      toggleChatInGroup(newId, chatId);
    }
    setCreating(false);
    setNewGroupName("");
    setNewGroupEmoji("👥");
    setNewGroupColor("#0A84FF");
  };

  const handleClose = () => {
    setCreating(false);
    setNewGroupName("");
    setNewGroupEmoji("👥");
    setNewGroupColor("#0A84FF");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={[cgStyles.container, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View
            style={[
              cgStyles.header,
              { paddingTop: insets.top + 16, borderBottomColor: colors.border },
            ]}
          >
            <Pressable onPress={handleClose} hitSlop={12}>
              <Text style={[cgStyles.cancel, { color: colors.primary }]}>Done</Text>
            </Pressable>
            <Text style={[cgStyles.title, { color: colors.text }]}>
              Add to Group
            </Text>
            <View style={{ width: 44 }} />
          </View>

          {/* Contact info banner */}
          {contact && (
            <View style={[cgStyles.contactBanner, { backgroundColor: colors.surfaceSecondary }]}>
              <Avatar name={contact.name} size={36} isOnline={contact.isOnline} />
              <Text style={[cgStyles.contactBannerName, { color: colors.text }]}>
                {contact.name}
              </Text>
            </View>
          )}

          {resolving ? (
            <View style={cgStyles.loadingWrap}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={[cgStyles.sectionLabel, { color: colors.textTertiary }]}>
                GROUPS
              </Text>

              {groups.map((group) => {
                const isMember = chatId ? group.chatIds.includes(chatId) : false;
                return (
                  <Pressable
                    key={group.id}
                    onPress={() => handleToggleGroup(group.id)}
                    style={({ pressed }) => [
                      cgStyles.groupRow,
                      {
                        backgroundColor: pressed
                          ? colors.surfaceSecondary
                          : colors.surface,
                      },
                    ]}
                  >
                    <View style={[cgStyles.groupEmojiBadge, { backgroundColor: group.color + "22" }]}>
                      <Text style={cgStyles.groupEmoji}>{group.emoji}</Text>
                    </View>
                    <View style={cgStyles.groupInfo}>
                      <Text style={[cgStyles.groupName, { color: colors.text }]}>
                        {group.name}
                      </Text>
                      <Text style={[cgStyles.groupCount, { color: colors.textTertiary }]}>
                        {group.chatIds.length} {group.chatIds.length === 1 ? "member" : "members"}
                      </Text>
                    </View>
                    <View
                      style={[
                        cgStyles.checkbox,
                        {
                          backgroundColor: isMember ? group.color : "transparent",
                          borderColor: isMember ? group.color : colors.border,
                        },
                      ]}
                    >
                      {isMember && (
                        <Ionicons name="checkmark" size={14} color="#FFF" />
                      )}
                    </View>
                  </Pressable>
                );
              })}

              {/* Divider */}
              <View style={[cgStyles.divider, { backgroundColor: colors.border }]} />

              {/* New Group Section */}
              {creating ? (
                <View style={[cgStyles.newGroupForm, { backgroundColor: colors.surface }]}>
                  {/* Emoji picker */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={cgStyles.emojiRow}
                  >
                    {GROUP_EMOJIS.map((e) => (
                      <Pressable
                        key={e}
                        onPress={() => setNewGroupEmoji(e)}
                        style={[
                          cgStyles.emojiOption,
                          {
                            backgroundColor:
                              newGroupEmoji === e
                                ? colors.primary + "20"
                                : colors.surfaceSecondary,
                            borderWidth: newGroupEmoji === e ? 1.5 : 0,
                            borderColor: colors.primary,
                          },
                        ]}
                      >
                        <Text style={{ fontSize: 20 }}>{e}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>

                  {/* Color picker */}
                  <View style={cgStyles.colorRow}>
                    {GROUP_COLORS.map((c) => (
                      <Pressable
                        key={c}
                        onPress={() => setNewGroupColor(c)}
                        style={[
                          cgStyles.colorDot,
                          { backgroundColor: c },
                          newGroupColor === c && cgStyles.colorDotSelected,
                        ]}
                      />
                    ))}
                  </View>

                  {/* Name input */}
                  <View
                    style={[
                      cgStyles.nameInputWrap,
                      { backgroundColor: colors.surfaceSecondary },
                    ]}
                  >
                    <Text style={{ fontSize: 20 }}>{newGroupEmoji}</Text>
                    <TextInput
                      ref={nameInputRef}
                      style={[cgStyles.nameInput, { color: colors.text }]}
                      placeholder="Group name…"
                      placeholderTextColor={colors.textTertiary}
                      value={newGroupName}
                      onChangeText={setNewGroupName}
                      autoFocus
                      returnKeyType="done"
                      onSubmitEditing={handleCreateGroup}
                    />
                  </View>

                  <View style={cgStyles.formActions}>
                    <Pressable
                      onPress={() => {
                        setCreating(false);
                        setNewGroupName("");
                      }}
                      style={[cgStyles.formBtn, { backgroundColor: colors.surfaceSecondary }]}
                    >
                      <Text style={[cgStyles.formBtnText, { color: colors.textSecondary }]}>
                        Cancel
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={handleCreateGroup}
                      style={[
                        cgStyles.formBtn,
                        {
                          backgroundColor:
                            newGroupName.trim() ? newGroupColor : colors.surfaceSecondary,
                          flex: 1,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          cgStyles.formBtnText,
                          { color: newGroupName.trim() ? "#FFF" : colors.textTertiary },
                        ]}
                      >
                        Create &amp; Add
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setCreating(true);
                  }}
                  style={({ pressed }) => [
                    cgStyles.newGroupBtn,
                    {
                      backgroundColor: pressed
                        ? colors.primary + "18"
                        : colors.primary + "10",
                    },
                  ]}
                >
                  <View style={[cgStyles.newGroupPlus, { backgroundColor: colors.primary }]}>
                    <Ionicons name="add" size={18} color="#FFF" />
                  </View>
                  <Text style={[cgStyles.newGroupBtnText, { color: colors.primary }]}>
                    New Group
                  </Text>
                </Pressable>
              )}
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Contact Row ──────────────────────────────────────────────────────────────

function ContactRow({
  contact,
  onPress,
  onLongPress,
  onVoiceCall,
  onVideoCall,
  onGroupPress,
  colors,
}: {
  contact: Contact;
  onPress: () => void;
  onLongPress?: () => void;
  onVoiceCall: () => void;
  onVideoCall: () => void;
  onGroupPress: () => void;
  colors: typeof Colors.light;
}) {
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
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.contactRow,
        { backgroundColor: colors.surface, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      {/* Group tag icon — left side */}
      <Pressable
        onPress={(e) => {
          e.stopPropagation();
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onGroupPress();
        }}
        hitSlop={6}
        style={[styles.groupTagBtn, { backgroundColor: colors.primary + "15" }]}
      >
        <Ionicons name="bookmark-outline" size={15} color={colors.primary} />
      </Pressable>

      <Avatar name={contact.name} size={48} isOnline={contact.isOnline} hasApp={contact.hasApp} />
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

// ─── Invite Modal ─────────────────────────────────────────────────────────────

function InviteRow({
  contact,
  selected,
  onToggle,
}: {
  contact: Contact;
  selected: boolean;
  onToggle: () => void;
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;

  return (
    <Pressable
      onPress={onToggle}
      style={[styles.inviteRow, { backgroundColor: selected ? colors.primary + "12" : colors.surface }]}
    >
      <Avatar name={contact.name} size={44} />
      <View style={styles.inviteInfo}>
        <Text style={[styles.inviteName, { color: colors.text }]}>{contact.name}</Text>
        {contact.phone && (
          <Text style={[styles.invitePhone, { color: colors.textSecondary }]} numberOfLines={1}>
            {contact.phone}
          </Text>
        )}
      </View>
      <View
        style={[
          styles.inviteCheck,
          {
            backgroundColor: selected ? colors.primary : "transparent",
            borderColor: selected ? colors.primary : colors.border,
          },
        ]}
      >
        {selected && <Ionicons name="checkmark" size={14} color="#FFF" />}
      </View>
    </Pressable>
  );
}

function InviteModal({
  visible,
  contacts,
  onClose,
  colors,
  insets,
}: {
  visible: boolean;
  contacts: Contact[];
  onClose: () => void;
  colors: typeof Colors.light;
  insets: { top: number; bottom: number };
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [inviteSearch, setInviteSearch] = useState("");

  const phoneContacts = contacts.filter((c) => c.id !== "me" && c.phone);
  const filtered = phoneContacts.filter((c) =>
    c.name.toLowerCase().includes(inviteSearch.toLowerCase())
  );

  const toggle = (id: string) => {
    Haptics.selectionAsync();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleInvite = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await Share.share(
        Platform.OS === "ios"
          ? { message: INVITE_MESSAGE, url: INVITE_LINK }
          : { message: INVITE_MESSAGE }
      );
    } catch (e) {
      console.log("Share error:", e);
    }
    onClose();
    setSelected(new Set());
    setInviteSearch("");
  };

  const handleClose = () => {
    onClose();
    setSelected(new Set());
    setInviteSearch("");
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.modalHeader, { paddingTop: insets.top + 16, borderBottomColor: colors.border }]}>
          <Pressable onPress={handleClose} hitSlop={12}>
            <Text style={[styles.modalCancel, { color: colors.primary }]}>Cancel</Text>
          </Pressable>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Invite Contacts</Text>
          <Pressable
            onPress={handleInvite}
            style={[
              styles.inviteActionBtn,
              { backgroundColor: selected.size > 0 ? colors.primary : colors.surfaceSecondary },
            ]}
          >
            <Text style={[styles.inviteActionText, { color: selected.size > 0 ? "#FFF" : colors.textTertiary }]}>
              {selected.size > 0 ? `Invite ${selected.size}` : "Invite"}
            </Text>
          </Pressable>
        </View>

        <View style={[styles.inviteSearchContainer, { backgroundColor: colors.surfaceSecondary, margin: 16, marginTop: 12 }]}>
          <Feather name="search" size={16} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search contacts..."
            placeholderTextColor={colors.textTertiary}
            value={inviteSearch}
            onChangeText={setInviteSearch}
          />
        </View>

        <Text style={[styles.inviteHint, { color: colors.textSecondary }]}>
          Select contacts to send them an invite link via your messaging app.
        </Text>

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <InviteRow
              contact={item}
              selected={selected.has(item.id)}
              onToggle={() => toggle(item.id)}
            />
          )}
          ItemSeparatorComponent={() => (
            <View style={[styles.separator, { backgroundColor: colors.border, marginLeft: 72 }]} />
          )}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          ListEmptyComponent={
            <View style={styles.inviteEmpty}>
              <Ionicons name="people-outline" size={40} color={colors.textTertiary} />
              <Text style={[styles.inviteEmptyText, { color: colors.textSecondary }]}>
                {inviteSearch ? "No matching contacts" : "Sync your contacts first to invite friends"}
              </Text>
            </View>
          }
        />
      </View>
    </Modal>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatLastSeen(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ContactsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const { contacts, createDirectChat, updateContacts } = useMessaging();
  const { startCall } = useCall();
  const { favorites, addFavorite, removeFavorite, isFavorited } = useFavorites();
  const [search, setSearch] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [groupModalContact, setGroupModalContact] = useState<Contact | null>(null);
  const { status: syncStatus, syncedCount, syncContacts } = useContactSync();

  const isSyncing = syncStatus === "requesting" || syncStatus === "syncing";

  const handleSync = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const result = await syncContacts();
    if (result.length > 0) {
      await updateContacts(result);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleInvitePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowInvite(true);
  }, []);

  const otherContacts = contacts.filter((c) => c.id !== "me");
  const filtered = otherContacts.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

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
          <View style={styles.headerButtons}>
            <Pressable
              onPress={handleInvitePress}
              style={[styles.inviteBtn, { backgroundColor: colors.primary + "15" }]}
            >
              <Ionicons name="person-add" size={15} color={colors.primary} />
              <Text style={[styles.inviteBtnText, { color: colors.primary }]}>Invite</Text>
            </Pressable>
            <Pressable
              onPress={handleSync}
              disabled={isSyncing}
              style={[
                styles.syncBtn,
                {
                  backgroundColor:
                    syncStatus === "done"
                      ? "#34C75920"
                      : syncStatus === "denied" || syncStatus === "error"
                      ? "#FF453A20"
                      : colors.primary + "15",
                },
              ]}
            >
              {isSyncing ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ width: 16, height: 16 }} />
              ) : (
                <Ionicons
                  name={syncStatus === "done" ? "checkmark-circle" : syncStatus === "denied" || syncStatus === "error" ? "alert-circle" : "sync"}
                  size={16}
                  color={syncStatus === "done" ? "#34C759" : syncStatus === "denied" || syncStatus === "error" ? "#FF453A" : colors.primary}
                />
              )}
              <Text style={[styles.syncBtnText, { color: syncStatus === "done" ? "#34C759" : syncStatus === "denied" || syncStatus === "error" ? "#FF453A" : colors.primary }]}>
                {syncStatus === "done" ? `${syncedCount} synced` : isSyncing ? "Syncing…" : "Sync"}
              </Text>
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
            placeholder="Search contacts..."
            placeholderTextColor={colors.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      <FavoritesStrip tab="contacts" />

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
                colors={colors}
                onPress={() => handleMessage(item.id)}
                onLongPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  const alreadyFaved = isFavorited(undefined, item.id);
                  if (alreadyFaved) {
                    const existing = favorites.find((f) => f.userId === item.id);
                    if (existing) {
                      removeFavorite(existing.id);
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    }
                  } else {
                    addFavorite({ type: "contact", name: item.name, avatar: item.avatar, userId: item.id });
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  }
                }}
                onGroupPress={() => setGroupModalContact(item)}
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
              { backgroundColor: colors.border, marginLeft: 96 },
            ]}
          />
        )}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        contentInsetAdjustmentBehavior="automatic"
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconWrap, { backgroundColor: colors.primary + "12" }]}>
              <Ionicons name="people-outline" size={48} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {search ? "No contacts found" : "No contacts yet"}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              {search
                ? "Try a different name or spelling"
                : syncStatus === "denied"
                ? "Allow contacts access in Settings to find people on ZIVR"
                : "Sync your phone contacts to find friends on ZIVR"}
            </Text>
            {!search && (
              <View style={styles.emptyActions}>
                <Pressable
                  onPress={handleSync}
                  disabled={isSyncing}
                  style={[styles.emptyButton, { backgroundColor: colors.primary }]}
                >
                  {isSyncing ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <Ionicons name="sync" size={16} color="#FFF" />
                  )}
                  <Text style={styles.emptyButtonText}>
                    {isSyncing ? "Syncing…" : syncStatus === "done" ? "Sync Again" : "Sync Contacts"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleInvitePress}
                  style={[styles.emptyButton, { backgroundColor: colors.primary + "15" }]}
                >
                  <Ionicons name="person-add" size={16} color={colors.primary} />
                  <Text style={[styles.emptyButtonText, { color: colors.primary }]}>Invite Friends</Text>
                </Pressable>
              </View>
            )}
          </View>
        }
      />

      <InviteModal
        visible={showInvite}
        contacts={contacts}
        onClose={() => setShowInvite(false)}
        colors={colors}
        insets={{ top: insets.top, bottom: insets.bottom }}
      />

      <ContactGroupModal
        visible={groupModalContact !== null}
        contact={groupModalContact}
        onClose={() => setGroupModalContact(null)}
        colors={colors}
        insets={{ top: insets.top, bottom: insets.bottom }}
        getChatId={createDirectChat}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inviteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  inviteBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  syncBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  syncBtnText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
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
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  groupTagBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
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
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
    marginTop: -4,
  },
  emptyActions: {
    gap: 10,
    alignItems: "center",
    marginTop: 4,
  },
  emptyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyButtonText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#FFF",
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalCancel: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  inviteActionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
  },
  inviteActionText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  inviteSearchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  inviteHint: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    paddingHorizontal: 16,
    marginBottom: 4,
    lineHeight: 18,
  },
  inviteRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  inviteInfo: {
    flex: 1,
    gap: 2,
  },
  inviteName: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  invitePhone: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  inviteCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  inviteEmpty: {
    alignItems: "center",
    paddingTop: 60,
    gap: 12,
    paddingHorizontal: 40,
  },
  inviteEmptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
});

const cgStyles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cancel: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    width: 44,
    textAlign: "left",
  },
  title: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  contactBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  contactBannerName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 14,
  },
  groupEmojiBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  groupEmoji: {
    fontSize: 20,
  },
  groupInfo: {
    flex: 1,
    gap: 2,
  },
  groupName: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  groupCount: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  newGroupBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 14,
  },
  newGroupPlus: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  newGroupBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  newGroupForm: {
    marginHorizontal: 16,
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  emojiRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 2,
  },
  emojiOption: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  colorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  colorDotSelected: {
    transform: [{ scale: 1.2 }],
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  nameInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  nameInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  formActions: {
    flexDirection: "row",
    gap: 10,
  },
  formBtn: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  formBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
