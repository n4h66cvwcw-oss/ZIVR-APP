import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useParental, type ChildAccount } from "@/context/ParentalContext";
import { useServer } from "@/context/ServerContext";
import { Avatar } from "@/components/Avatar";

const DAYS = [
  { key: "mon", label: "M" },
  { key: "tue", label: "T" },
  { key: "wed", label: "W" },
  { key: "thu", label: "T" },
  { key: "fri", label: "F" },
  { key: "sat", label: "S" },
  { key: "sun", label: "S" },
];

function ChildCard({
  child,
  colors,
  onPress,
}: {
  child: ChildAccount;
  colors: typeof Colors.dark;
  onPress: () => void;
}) {
  const hasAlerts = child.unflaggedCount > 0;
  return (
    <Pressable
      style={[styles.childCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={onPress}
    >
      <Avatar
        name={child.displayName}
        avatar={child.avatar ?? undefined}
        size={50}
      />
      <View style={styles.childInfo}>
        <Text style={[styles.childName, { color: colors.text }]}>{child.displayName}</Text>
        <Text style={[styles.childSub, { color: colors.textSecondary }]}>
          {child.isOnline ? "🟢 Online" : "⚫ Offline"}
          {child.username ? `  •  @${child.username}` : ""}
        </Text>
      </View>
      {hasAlerts && (
        <View style={styles.flagBadge}>
          <Text style={styles.flagBadgeText}>{child.unflaggedCount}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

export default function ParentalDashboard() {
  const isDark = useColorScheme() === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const { children, loadChildren, createChildAccount, isParentMode } = useParental();
  const { serverUserId } = useServer();

  const [showAddChild, setShowAddChild] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [adding, setAdding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    void loadChildren();
  }, [loadChildren]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadChildren();
    setRefreshing(false);
  }, [loadChildren]);

  const handleAddChild = async () => {
    if (!newName.trim()) {
      Alert.alert("Name required", "Please enter a display name for the child account.");
      return;
    }
    setAdding(true);
    const id = await createChildAccount({
      displayName: newName.trim(),
      username: newUsername.trim() || undefined,
    });
    setAdding(false);
    if (id) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowAddChild(false);
      setNewName("");
      setNewUsername("");
    } else {
      Alert.alert("Error", "Could not create child account. The username may already be taken.");
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Family Controls</Text>
        <Pressable onPress={() => setShowAddChild(true)} hitSlop={12}>
          <Ionicons name="person-add-outline" size={24} color="#6C63FF" />
        </Pressable>
      </View>

      {/* Info banner */}
      <View style={[styles.banner, { backgroundColor: "#6C63FF18", borderColor: "#6C63FF30" }]}>
        <Ionicons name="shield-checkmark-outline" size={18} color="#6C63FF" />
        <Text style={[styles.bannerText, { color: colors.textSecondary }]}>
          Monitor activity, set screen time, and approve contacts for your kids.
        </Text>
      </View>

      {/* Children list */}
      <FlatList
        data={children}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No child accounts yet</Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
              Tap the + button to add your first child.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <ChildCard
            child={item}
            colors={colors}
            onPress={() => router.push(`/parental/${item.id}` as never)}
          />
        )}
      />

      {/* Add child modal */}
      <Modal visible={showAddChild} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Add Child Account</Text>
            <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
              Create a monitored account for your child. You'll be able to set screen time, approve contacts, and review flagged messages.
            </Text>

            <Text style={[styles.label, { color: colors.textSecondary }]}>Display Name *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              value={newName}
              onChangeText={setNewName}
              placeholder="e.g. Emma"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>Username (optional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              value={newUsername}
              onChangeText={setNewUsername}
              placeholder="e.g. emma_2014"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
            />

            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: colors.background }]}
                onPress={() => { setShowAddChild(false); setNewName(""); setNewUsername(""); }}
              >
                <Text style={[styles.modalBtnText, { color: colors.textSecondary }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnPrimary, { opacity: adding ? 0.6 : 1 }]}
                onPress={handleAddChild}
                disabled={adding}
              >
                <Text style={styles.modalBtnPrimaryText}>{adding ? "Creating…" : "Create Account"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    margin: 16,
    marginBottom: 0,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  bannerText: { fontSize: 13, flex: 1, lineHeight: 18 },
  childCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  childInfo: { flex: 1 },
  childName: { fontSize: 16, fontWeight: "600" },
  childSub: { fontSize: 13, marginTop: 2 },
  flagBadge: {
    backgroundColor: "#FF6B6B",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  flagBadgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  empty: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "600" },
  emptySub: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 12,
  },
  modalTitle: { fontSize: 20, fontWeight: "700" },
  modalSub: { fontSize: 14, lineHeight: 20 },
  label: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
  },
  modalButtons: { flexDirection: "row", gap: 10, marginTop: 8 },
  modalBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: "center" },
  modalBtnText: { fontSize: 15, fontWeight: "600" },
  modalBtnPrimary: { backgroundColor: "#6C63FF" },
  modalBtnPrimaryText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
