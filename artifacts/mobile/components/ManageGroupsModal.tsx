import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState, useCallback } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import Colors from "@/constants/colors";
import { useContactGroups, type ContactGroup } from "@/hooks/useContactGroups";
import type { Chat } from "@/context/MessagingContext";

const EMOJI_OPTIONS = [
  "👨‍👩‍👧","❤️","💼","👥","🏠","🎓","💪","🌟","🎵","🏋️","🎯","🎮",
  "🌈","🔥","💎","🤝","🌸","⚽","🎨","📚","🍕","✈️","🌊","🦁",
  "🐶","🌺","🎸","🏆","💡","🎤","🧠","🤙",
];

const COLOR_OPTIONS = [
  "#30D158","#FF375F","#0A84FF","#BF5AF2",
  "#FF9F0A","#32ADE6","#FFD60A","#FF6B35",
  "#5E5CE6","#64D2FF","#FF2D55","#34C759",
];

type View = "list" | "editor" | "members";

interface Props {
  visible: boolean;
  onClose: () => void;
  chats: Chat[];
}

export function ManageGroupsModal({ visible, onClose, chats }: Props) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const { groups, createGroup, updateGroup, deleteGroup, setChatIds } = useContactGroups();

  const [view, setView] = useState<View>("list");
  const [editingGroup, setEditingGroup] = useState<ContactGroup | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmoji, setEditEmoji] = useState("👥");
  const [editColor, setEditColor] = useState("#0A84FF");
  const [selectedChatIds, setSelectedChatIds] = useState<string[]>([]);

  const openCreate = () => {
    setEditingGroup(null);
    setEditName("");
    setEditEmoji("👥");
    setEditColor("#0A84FF");
    setView("editor");
  };

  const openEdit = (group: ContactGroup) => {
    setEditingGroup(group);
    setEditName(group.name);
    setEditEmoji(group.emoji);
    setEditColor(group.color);
    setView("editor");
  };

  const openMembers = (group: ContactGroup) => {
    setEditingGroup(group);
    setSelectedChatIds([...group.chatIds]);
    setView("members");
  };

  const handleSaveGroup = () => {
    if (!editName.trim()) return;
    if (editingGroup) {
      updateGroup(editingGroup.id, { name: editName.trim(), emoji: editEmoji, color: editColor });
    } else {
      createGroup(editName.trim(), editEmoji, editColor);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setView("list");
  };

  const handleSaveMembers = () => {
    if (!editingGroup) return;
    setChatIds(editingGroup.id, selectedChatIds);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setView("list");
  };

  const handleDeleteGroup = (group: ContactGroup) => {
    Alert.alert(
      `Delete "${group.name}"?`,
      "This will remove the group. Chats won't be deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            deleteGroup(group.id);
          },
        },
      ]
    );
  };

  const toggleChat = (chatId: string) => {
    Haptics.selectionAsync();
    setSelectedChatIds((prev) =>
      prev.includes(chatId) ? prev.filter((id) => id !== chatId) : [...prev, chatId]
    );
  };

  const handleClose = () => {
    setView("list");
    onClose();
  };

  const availableChats = chats.filter((c) => c.type !== "checkin");

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          {view === "list" ? (
            <Pressable onPress={handleClose} hitSlop={8} style={styles.headerSide}>
              <Text style={[styles.headerAction, { color: colors.textSecondary }]}>Done</Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => setView("list")} hitSlop={8} style={styles.headerSide}>
              <Text style={[styles.headerAction, { color: colors.textSecondary }]}>← Back</Text>
            </Pressable>
          )}
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {view === "list" ? "Contact Groups" : view === "editor" ? (editingGroup ? "Edit Group" : "New Group") : `Members — ${editingGroup?.name}`}
          </Text>
          {view === "list" ? (
            <Pressable onPress={openCreate} hitSlop={8} style={styles.headerSide}>
              <Ionicons name="add-circle" size={24} color={colors.primary} />
            </Pressable>
          ) : view === "editor" ? (
            <Pressable onPress={handleSaveGroup} hitSlop={8} style={styles.headerSide}>
              <Text style={[styles.headerAction, { color: editName.trim() ? colors.primary : colors.textTertiary, fontFamily: "Inter_600SemiBold" }]}>Save</Text>
            </Pressable>
          ) : (
            <Pressable onPress={handleSaveMembers} hitSlop={8} style={styles.headerSide}>
              <Text style={[styles.headerAction, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>Save</Text>
            </Pressable>
          )}
        </View>

        {view === "list" && (
          <FlatList
            data={groups}
            keyExtractor={(g) => g.id}
            contentContainerStyle={[styles.listContent, groups.length === 0 && styles.emptyList]}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={56} color={colors.textTertiary} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No Groups Yet</Text>
                <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                  Tap + to create your first contact group
                </Text>
              </View>
            }
            renderItem={({ item: group }) => (
              <View style={[styles.groupRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Pressable onPress={() => openMembers(group)} style={styles.groupMain}>
                  <View style={[styles.groupBadge, { backgroundColor: group.color + "22" }]}>
                    <Text style={styles.groupEmoji}>{group.emoji}</Text>
                  </View>
                  <View style={styles.groupInfo}>
                    <Text style={[styles.groupName, { color: colors.text }]}>{group.name}</Text>
                    <Text style={[styles.groupCount, { color: colors.textSecondary }]}>
                      {group.chatIds.length === 0
                        ? "No chats added"
                        : `${group.chatIds.length} chat${group.chatIds.length !== 1 ? "s" : ""}`}
                    </Text>
                  </View>
                  <View style={[styles.groupDot, { backgroundColor: group.color }]} />
                </Pressable>
                <View style={[styles.groupActions, { borderLeftColor: colors.border }]}>
                  <Pressable onPress={() => openEdit(group)} hitSlop={6} style={styles.groupActionBtn}>
                    <Ionicons name="create-outline" size={18} color={colors.primary} />
                  </Pressable>
                  <Pressable onPress={() => handleDeleteGroup(group)} hitSlop={6} style={styles.groupActionBtn}>
                    <Ionicons name="trash-outline" size={18} color="#FF453A" />
                  </Pressable>
                </View>
              </View>
            )}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          />
        )}

        {view === "editor" && (
          <ScrollView contentContainerStyle={styles.editorScroll} keyboardShouldPersistTaps="handled">
            <View style={[styles.previewBadge, { backgroundColor: editColor + "22" }]}>
              <Text style={styles.previewEmoji}>{editEmoji}</Text>
              <Text style={[styles.previewName, { color: editColor }]}>{editName || "Group Name"}</Text>
            </View>

            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>GROUP NAME</Text>
              <TextInput
                style={[styles.nameInput, { color: colors.text, borderBottomColor: colors.border }]}
                placeholder="e.g. Family, Work Team…"
                placeholderTextColor={colors.textTertiary}
                value={editName}
                onChangeText={setEditName}
                maxLength={24}
                autoFocus
                returnKeyType="done"
              />
            </View>

            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>EMOJI</Text>
              <View style={styles.emojiGrid}>
                {EMOJI_OPTIONS.map((em) => (
                  <Pressable
                    key={em}
                    onPress={() => { Haptics.selectionAsync(); setEditEmoji(em); }}
                    style={[styles.emojiCell, editEmoji === em && { backgroundColor: editColor + "33", borderRadius: 10 }]}
                  >
                    <Text style={styles.emojiOption}>{em}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>COLOR</Text>
              <View style={styles.colorGrid}>
                {COLOR_OPTIONS.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => { Haptics.selectionAsync(); setEditColor(c); }}
                    style={[styles.colorSwatch, { backgroundColor: c }, editColor === c && styles.colorSelected]}
                  >
                    {editColor === c && <Ionicons name="checkmark" size={16} color="#fff" />}
                  </Pressable>
                ))}
              </View>
            </View>
          </ScrollView>
        )}

        {view === "members" && (
          <FlatList
            data={availableChats}
            keyExtractor={(c) => c.id}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={
              <Text style={[styles.membersHint, { color: colors.textSecondary }]}>
                Tap chats to add or remove them from this group
              </Text>
            }
            renderItem={({ item: chat }) => {
              const selected = selectedChatIds.includes(chat.id);
              return (
                <Pressable
                  onPress={() => toggleChat(chat.id)}
                  style={[
                    styles.chatRow,
                    {
                      backgroundColor: selected ? (editingGroup?.color || colors.primary) + "15" : colors.surface,
                      borderColor: selected ? (editingGroup?.color || colors.primary) : colors.border,
                    },
                  ]}
                >
                  <View style={[styles.chatAvatar, { backgroundColor: selected ? (editingGroup?.color || colors.primary) : colors.surfaceSecondary }]}>
                    <Ionicons
                      name={chat.type === "group" ? "people" : "person"}
                      size={18}
                      color={selected ? "#fff" : colors.textSecondary}
                    />
                  </View>
                  <View style={styles.chatInfo}>
                    <Text style={[styles.chatName, { color: colors.text }]}>{chat.name}</Text>
                    <Text style={[styles.chatType, { color: colors.textSecondary }]}>
                      {chat.type === "group" ? "Group" : "Direct"}{chat.isEncrypted ? " · Encrypted" : ""}
                    </Text>
                  </View>
                  <View style={[styles.checkbox, { borderColor: selected ? (editingGroup?.color || colors.primary) : colors.border, backgroundColor: selected ? (editingGroup?.color || colors.primary) : "transparent" }]}>
                    {selected && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                </Pressable>
              );
            }}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerSide: { minWidth: 60 },
  headerTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", flex: 1, textAlign: "center" },
  headerAction: { fontSize: 16, fontFamily: "Inter_400Regular" },
  listContent: { padding: 16 },
  emptyList: { flex: 1, justifyContent: "center" },
  emptyState: { alignItems: "center", gap: 10, paddingTop: 40 },
  emptyTitle: { fontSize: 20, fontFamily: "Inter_600SemiBold" },
  emptySubtitle: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  groupMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  groupBadge: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  groupEmoji: { fontSize: 24 },
  groupInfo: { flex: 1, gap: 2 },
  groupName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  groupCount: { fontSize: 12, fontFamily: "Inter_400Regular" },
  groupDot: { width: 8, height: 8, borderRadius: 4, marginRight: 4 },
  groupActions: {
    flexDirection: "row",
    borderLeftWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 4,
  },
  groupActionBtn: { padding: 12 },
  editorScroll: { padding: 20, gap: 16, paddingBottom: 40 },
  previewBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    marginBottom: 8,
  },
  previewEmoji: { fontSize: 28 },
  previewName: { fontSize: 20, fontFamily: "Inter_700Bold" },
  section: {
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, textTransform: "uppercase" },
  nameInput: {
    fontSize: 17,
    fontFamily: "Inter_400Regular",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  emojiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  emojiCell: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  emojiOption: { fontSize: 26 },
  colorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  colorSwatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  colorSelected: { borderWidth: 3, borderColor: "#fff", shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  membersHint: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", marginBottom: 12 },
  chatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  chatAvatar: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  chatInfo: { flex: 1, gap: 2 },
  chatName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  chatType: { fontSize: 12, fontFamily: "Inter_400Regular" },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
