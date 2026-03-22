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
  Switch,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useMessaging } from "@/context/MessagingContext";
import { Avatar } from "@/components/Avatar";

export default function NewCheckInScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const { contacts, createCheckInGroup } = useMessaging();
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [anonymous, setAnonymous] = useState(true);

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
    if (!name.trim() || selected.length === 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const groupId = await createCheckInGroup(name.trim(), selected, anonymous);
    router.replace(`/checkin/${groupId}`);
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
          New Check-In Group
        </Text>
        <Pressable
          onPress={handleCreate}
          disabled={!name.trim() || selected.length === 0}
        >
          <Text
            style={[
              styles.createBtn,
              {
                color:
                  name.trim() && selected.length > 0
                    ? colors.broadcastAccent
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
            { backgroundColor: colors.surfaceSecondary },
          ]}
        >
          <Ionicons name="radio" size={20} color={colors.broadcastAccent} />
          <TextInput
            style={[styles.nameInput, { color: colors.text }]}
            placeholder="Group name..."
            placeholderTextColor={colors.textTertiary}
            value={name}
            onChangeText={setName}
            autoFocus
          />
        </View>
      </View>

      <View
        style={[
          styles.optionRow,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.optionInfo}>
          <Ionicons name="eye-off" size={20} color={colors.accent} />
          <View>
            <Text style={[styles.optionTitle, { color: colors.text }]}>
              Private mode
            </Text>
            <Text
              style={[styles.optionDesc, { color: colors.textSecondary }]}
            >
              Members can't see who's in the group
            </Text>
          </View>
        </View>
        <Switch
          value={anonymous}
          onValueChange={setAnonymous}
          trackColor={{ false: colors.border, true: colors.accent }}
          thumbColor="#FFFFFF"
        />
      </View>

      <View
        style={[
          styles.explainer,
          {
            backgroundColor: colors.broadcastAccent + "10",
            borderColor: colors.broadcastAccent + "25",
          },
        ]}
      >
        <Ionicons
          name="information-circle"
          size={16}
          color={colors.broadcastAccent}
        />
        <Text style={[styles.explainerText, { color: colors.textSecondary }]}>
          When you send a broadcast, each member receives it as a private message
          and only you can see their replies.
        </Text>
      </View>

      {selected.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.selectedBar, { borderBottomColor: colors.border }]}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingVertical: 10,
            gap: 10,
          }}
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
          {
            backgroundColor: colors.surfaceSecondary,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Feather name="search" size={16} color={colors.textTertiary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Add members..."
          placeholderTextColor={colors.textTertiary}
          value={search}
          onChangeText={setSearch}
        />
        {selected.length > 0 && (
          <View
            style={[
              styles.countBadge,
              { backgroundColor: colors.broadcastAccent },
            ]}
          >
            <Text style={styles.countText}>{selected.length}</Text>
          </View>
        )}
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
                    ? colors.broadcastAccent + "10"
                    : colors.surface,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Avatar name={item.name} size={48} isOnline={item.isOnline} />
              <View style={styles.contactInfo}>
                <Text style={[styles.contactName, { color: colors.text }]}>
                  {item.name}
                </Text>
                {item.status && (
                  <Text
                    style={[
                      styles.contactStatus,
                      { color: colors.textSecondary },
                    ]}
                    numberOfLines={1}
                  >
                    {item.status}
                  </Text>
                )}
              </View>
              <View
                style={[
                  styles.checkCircle,
                  {
                    backgroundColor: isSelected
                      ? colors.broadcastAccent
                      : colors.surfaceSecondary,
                    borderColor: isSelected
                      ? colors.broadcastAccent
                      : colors.border,
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
    fontSize: 16,
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
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  optionTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  optionDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  explainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  explainerText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    flex: 1,
    lineHeight: 17,
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
  countBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
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
