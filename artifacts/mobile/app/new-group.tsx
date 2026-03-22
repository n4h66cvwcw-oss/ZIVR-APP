import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
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
import { Avatar } from "@/components/Avatar";

export default function NewGroupScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const { contacts, createGroupChat } = useMessaging();
  const [groupName, setGroupName] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const others = contacts.filter(
    (c) =>
      c.id !== "me" && c.name.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id: string) => {
    Haptics.selectionAsync();
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleCreate = async () => {
    if (!groupName.trim() || selected.length === 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const chatId = await createGroupChat(groupName.trim(), selected);
    router.replace(`/chat/${chatId}`);
  };

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad,
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          New Group
        </Text>
        <Pressable
          onPress={handleCreate}
          disabled={!groupName.trim() || selected.length === 0}
        >
          <Text
            style={[
              styles.createBtn,
              {
                color:
                  groupName.trim() && selected.length > 0
                    ? colors.primary
                    : colors.textTertiary,
              },
            ]}
          >
            Create
          </Text>
        </Pressable>
      </View>

      <View
        style={[
          styles.nameSection,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <View
          style={[
            styles.groupNameInput,
            {
              backgroundColor: colors.surfaceSecondary,
            },
          ]}
        >
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

      {selected.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[
            styles.selectedBar,
            { borderBottomColor: colors.border },
          ]}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 10 }}
        >
          {selected.map((id) => {
            const c = contacts.find((x) => x.id === id);
            if (!c) return null;
            return (
              <Pressable key={id} onPress={() => toggle(id)} style={styles.selectedChip}>
                <Avatar name={c.name} size={44} />
                <Pressable
                  onPress={() => toggle(id)}
                  style={[
                    styles.selectedRemove,
                    { backgroundColor: colors.danger },
                  ]}
                >
                  <Feather name="x" size={10} color="#FFFFFF" />
                </Pressable>
                <Text
                  style={[styles.selectedName, { color: colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {c.name.split(" ")[0]}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      <View
        style={[
          styles.searchContainer,
          { backgroundColor: colors.surfaceSecondary, borderBottomColor: colors.border },
        ]}
      >
        <Feather name="search" size={16} color={colors.textTertiary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Add people..."
          placeholderTextColor={colors.textTertiary}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={others}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isSelected = selected.includes(item.id);
          return (
            <Pressable
              onPress={() => toggle(item.id)}
              style={({ pressed }) => [
                styles.contactRow,
                {
                  backgroundColor: isSelected
                    ? colors.primary + "12"
                    : colors.surface,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Avatar name={item.name} size={48} isOnline={item.isOnline} />
              <Text style={[styles.contactName, { color: colors.text, flex: 1 }]}>
                {item.name}
              </Text>
              <View
                style={[
                  styles.checkCircle,
                  {
                    backgroundColor: isSelected
                      ? colors.primary
                      : colors.surfaceSecondary,
                    borderColor: isSelected ? colors.primary : colors.border,
                  },
                ]}
              >
                {isSelected && (
                  <Feather name="check" size={14} color="#FFFFFF" />
                )}
              </View>
            </Pressable>
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
      />
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
  headerTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  createBtn: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
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
  nameInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  selectedBar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  selectedChip: {
    alignItems: "center",
    gap: 4,
    width: 52,
    position: "relative",
  },
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
  selectedName: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  contactName: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
});
