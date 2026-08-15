/**
 * FavoritesStrip — an expandable/collapsible pinned-favorites bar.
 *
 * Shows a row of avatar bubbles for favorited contacts, chats, and messages.
 * A group-chip row filters by assigned group. Long-press any bubble opens
 * an action sheet to remove, change group, or view.
 *
 * Props:
 *   tab — "chats" | "calls" | "checkins" | "contacts"
 *         Used to filter which favorite types are relevant and for navigation.
 */

import React, { useCallback, useRef, useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  Animated,
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
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { useFavorites, type FavoriteItem, type FavoriteGroup } from "@/context/FavoritesContext";
import { Avatar } from "@/components/Avatar";

export type FavoritesTab = "chats" | "calls" | "checkins" | "contacts";

// COLORS for group picker
const GROUP_COLORS = ["#FF6B6B", "#FF9F43", "#FFD93D", "#4ECDC4", "#45B7D1", "#6C63FF", "#A55EEA", "#FC5C7D"];

function GroupChip({
  group,
  active,
  colors,
  onPress,
}: {
  group: FavoriteGroup;
  active: boolean;
  colors: typeof Colors.dark;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[
        chipStyles.chip,
        active
          ? { backgroundColor: group.color + "30", borderColor: group.color }
          : { backgroundColor: colors.background, borderColor: colors.border },
      ]}
      onPress={onPress}
    >
      <Text style={chipStyles.chipEmoji}>{group.emoji}</Text>
      <Text style={[chipStyles.chipText, { color: active ? group.color : colors.textSecondary }]}>
        {group.name}
      </Text>
    </Pressable>
  );
}

function FavBubble({
  item,
  colors,
  onPress,
  onLongPress,
}: {
  item: FavoriteItem;
  colors: typeof Colors.dark;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const isMessage = item.type === "message";
  return (
    <Pressable
      style={bubbleStyles.wrap}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      {isMessage ? (
        <View style={[bubbleStyles.msgBubble, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="chatbubble-outline" size={20} color={colors.primary} />
        </View>
      ) : (
        <Avatar name={item.name} avatar={item.avatar} size={52} />
      )}
      <Text style={[bubbleStyles.label, { color: colors.text }]} numberOfLines={1}>
        {item.name.split(" ")[0]}
      </Text>
      {isMessage && item.messagePreview && (
        <Text style={[bubbleStyles.preview, { color: colors.textSecondary }]} numberOfLines={1}>
          {item.messagePreview}
        </Text>
      )}
    </Pressable>
  );
}

// ─── Add-group modal ──────────────────────────────────────────────────────────

function AddGroupModal({
  visible,
  colors,
  onClose,
  onAdd,
}: {
  visible: boolean;
  colors: typeof Colors.dark;
  onClose: () => void;
  onAdd: (name: string, emoji: string, color: string) => void;
}) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("⭐");
  const [selectedColor, setSelectedColor] = useState(GROUP_COLORS[0]);

  const handle = () => {
    if (!name.trim()) return;
    onAdd(name.trim(), emoji, selectedColor);
    setName("");
    setEmoji("⭐");
    setSelectedColor(GROUP_COLORS[0]);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={addStyles.overlay}>
        <View style={[addStyles.sheet, { backgroundColor: colors.surface }]}>
          <Text style={[addStyles.title, { color: colors.text }]}>New Favorites Group</Text>

          <View style={addStyles.emojiRow}>
            <TextInput
              style={[addStyles.emojiInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
              value={emoji}
              onChangeText={(t) => setEmoji(t.slice(-2) || "⭐")}
              maxLength={2}
            />
            <TextInput
              style={[addStyles.nameInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
              value={name}
              onChangeText={setName}
              placeholder="Group name"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <View style={addStyles.colorRow}>
            {GROUP_COLORS.map((c) => (
              <Pressable
                key={c}
                style={[addStyles.colorDot, { backgroundColor: c, borderWidth: selectedColor === c ? 2 : 0, borderColor: "#fff" }]}
                onPress={() => setSelectedColor(c)}
              />
            ))}
          </View>

          <View style={addStyles.btns}>
            <Pressable style={[addStyles.btn, { backgroundColor: colors.background }]} onPress={onClose}>
              <Text style={[addStyles.btnText, { color: colors.textSecondary }]}>Cancel</Text>
            </Pressable>
            <Pressable style={[addStyles.btn, addStyles.btnPrimary]} onPress={handle}>
              <Text style={addStyles.btnPrimaryText}>Create</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FavoritesStrip({ tab }: { tab: FavoritesTab }) {
  const isDark = useColorScheme() === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const {
    filteredFavorites,
    favorites,
    groups,
    isExpanded,
    activeGroupFilter,
    toggleExpanded,
    setActiveGroupFilter,
    removeFavorite,
    assignGroup,
    addGroup,
    removeGroup,
  } = useFavorites();

  const [showAddGroup, setShowAddGroup] = useState(false);
  const heightAnim = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;
  const prevExpanded = useRef(isExpanded);

  // Animate on expand/collapse
  if (prevExpanded.current !== isExpanded) {
    prevExpanded.current = isExpanded;
    Animated.timing(heightAnim, {
      toValue: isExpanded ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }

  const handleBubblePress = useCallback((item: FavoriteItem) => {
    Haptics.selectionAsync();
    if (item.chatId) {
      router.push(`/chat/${item.chatId}` as never);
    } else if (item.userId) {
      // For contacts tab — nothing to navigate to directly without a chat
      // For calls, could start call. For now open chat.
      router.push(`/chat/${item.userId}` as never);
    }
  }, []);

  const handleBubbleLongPress = useCallback((item: FavoriteItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const groupOptions = groups.map((g) => `${g.emoji} Assign to ${g.name}`);
    const currentGroup = groups.find((g) => g.id === item.groupId);

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: item.name,
          message: currentGroup ? `In group: ${currentGroup.emoji} ${currentGroup.name}` : "Not in a group",
          options: ["Cancel", "Remove from Favorites", ...groupOptions, "Remove from Group"],
          destructiveButtonIndex: 1,
          cancelButtonIndex: 0,
        },
        (idx) => {
          if (idx === 1) { removeFavorite(item.id); }
          else if (idx >= 2 && idx < 2 + groups.length) {
            const g = groups[idx - 2];
            assignGroup(item.id, g.id);
          } else if (idx === 2 + groups.length) {
            assignGroup(item.id, undefined);
          }
        }
      );
    } else {
      Alert.alert(item.name, currentGroup ? `In group: ${currentGroup.emoji} ${currentGroup.name}` : undefined, [
        { text: "Cancel", style: "cancel" },
        { text: "Remove from Favorites", style: "destructive", onPress: () => removeFavorite(item.id) },
        ...groups.map((g) => ({
          text: `${g.emoji} Assign to ${g.name}`,
          onPress: () => assignGroup(item.id, g.id),
        })),
        ...(item.groupId ? [{ text: "Remove from Group", onPress: () => assignGroup(item.id, undefined) }] : []),
      ]);
    }
  }, [groups, removeFavorite, assignGroup]);

  const handleGroupLongPress = useCallback((group: FavoriteGroup) => {
    // Only allow deleting custom groups (not the 4 defaults)
    const isDefault = ["family", "work", "friends", "vip"].includes(group.id);
    if (isDefault) return;
    Alert.alert(`Delete "${group.name}"?`, "This removes the group but keeps its members in Favorites.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete Group", style: "destructive", onPress: () => removeGroup(group.id) },
    ]);
  }, [removeGroup]);

  // No favorites at all? Show a subtle placeholder
  const hasItems = filteredFavorites.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      {/* Header row */}
      <Pressable style={styles.header} onPress={toggleExpanded}>
        <View style={styles.headerLeft}>
          <Ionicons name="star" size={14} color="#FFD700" />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Favorites</Text>
          {favorites.length > 0 && (
            <View style={[styles.countBadge, { backgroundColor: colors.primary + "20" }]}>
              <Text style={[styles.countText, { color: colors.primary }]}>{favorites.length}</Text>
            </View>
          )}
        </View>
        <View style={styles.headerRight}>
          <Pressable
            style={[styles.addGroupBtn, { borderColor: colors.border }]}
            onPress={(e) => { e.stopPropagation(); setShowAddGroup(true); }}
            hitSlop={8}
          >
            <Ionicons name="folder-outline" size={13} color={colors.textSecondary} />
            <Text style={[styles.addGroupText, { color: colors.textSecondary }]}>Groups</Text>
          </Pressable>
          <Ionicons
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.textSecondary}
          />
        </View>
      </Pressable>

      {/* Expandable body */}
      <Animated.View
        style={[
          styles.body,
          {
            maxHeight: heightAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 180],
            }),
            opacity: heightAnim,
            overflow: "hidden",
          },
        ]}
      >
        {/* Group filter chips */}
        {groups.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            <Pressable
              style={[
                chipStyles.chip,
                !activeGroupFilter
                  ? { backgroundColor: "#6C63FF30", borderColor: "#6C63FF" }
                  : { backgroundColor: colors.background, borderColor: colors.border },
              ]}
              onPress={() => setActiveGroupFilter(null)}
            >
              <Text style={[chipStyles.chipText, { color: !activeGroupFilter ? "#6C63FF" : colors.textSecondary }]}>
                All
              </Text>
            </Pressable>
            {groups.map((g) => (
              <Pressable
                key={g.id}
                onLongPress={() => handleGroupLongPress(g)}
              >
                <GroupChip
                  group={g}
                  active={activeGroupFilter === g.id}
                  colors={colors}
                  onPress={() => setActiveGroupFilter(activeGroupFilter === g.id ? null : g.id)}
                />
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Favorites bubbles */}
        {hasItems ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.bubbles}
          >
            {filteredFavorites.map((item) => (
              <FavBubble
                key={item.id}
                item={item}
                colors={colors}
                onPress={() => handleBubblePress(item)}
                onLongPress={() => handleBubbleLongPress(item)}
              />
            ))}
          </ScrollView>
        ) : (
          <View style={styles.empty}>
            <Ionicons name="star-outline" size={22} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {activeGroupFilter
                ? "No favorites in this group yet"
                : "Long-press any contact or chat to add to Favorites"}
            </Text>
          </View>
        )}
      </Animated.View>

      <AddGroupModal
        visible={showAddGroup}
        colors={colors}
        onClose={() => setShowAddGroup(false)}
        onAdd={addGroup}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  headerTitle: { fontSize: 13, fontWeight: "700" },
  countBadge: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 },
  countText: { fontSize: 11, fontWeight: "700" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  addGroupBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  addGroupText: { fontSize: 11, fontWeight: "600" },
  body: {},
  chips: { paddingHorizontal: 12, paddingBottom: 6, gap: 6 },
  bubbles: { paddingHorizontal: 12, paddingBottom: 12, gap: 4 },
  empty: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 4,
  },
  emptyText: { fontSize: 13, flex: 1 },
});

const chipStyles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  chipEmoji: { fontSize: 13 },
  chipText: { fontSize: 12, fontWeight: "600" },
});

const bubbleStyles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    width: 64,
    gap: 4,
    marginRight: 4,
  },
  msgBubble: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  label: {
    fontSize: 11,
    fontWeight: "500",
    textAlign: "center",
    maxWidth: 60,
  },
  preview: {
    fontSize: 10,
    textAlign: "center",
    maxWidth: 60,
  },
});

const addStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 16,
  },
  title: { fontSize: 18, fontWeight: "700" },
  emojiRow: { flexDirection: "row", gap: 10 },
  emojiInput: {
    width: 52,
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    textAlign: "center",
    fontSize: 22,
  },
  nameInput: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  colorRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  colorDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  btns: { flexDirection: "row", gap: 10 },
  btn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  btnText: { fontSize: 15, fontWeight: "600" },
  btnPrimary: { backgroundColor: "#6C63FF" },
  btnPrimaryText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
