import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useMessaging } from "@/context/MessagingContext";
import { Avatar } from "@/components/Avatar";

export default function WidgetSettingsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const { chats } = useMessaging();
  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  const [selectedChats, setSelectedChats] = useState<string[]>([]);

  const toggleChat = (id: string) => {
    setSelectedChats((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : prev.length < 4 ? [...prev, id] : prev
    );
  };

  const visibleChats = chats.filter((c) => c.type !== "checkin").slice(0, 20);

  const WIDGET_TYPES = [
    {
      id: "small",
      title: "Small Widget",
      description: "Shows 1 shortcut (1×1)",
      icon: "grid-outline",
      slots: 1,
    },
    {
      id: "medium",
      title: "Medium Widget",
      description: "Shows up to 2 shortcuts (2×1)",
      icon: "apps-outline",
      slots: 2,
    },
    {
      id: "large",
      title: "Large Widget",
      description: "Shows up to 4 shortcuts (2×2)",
      icon: "tablet-landscape-outline",
      slots: 4,
    },
  ];

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
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.primary} />
          <Text style={[styles.backText, { color: colors.primary }]}>Back</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Home Widgets</Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <View style={[styles.banner, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "30" }]}>
          <Ionicons name="phone-portrait-outline" size={28} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.bannerTitle, { color: colors.text }]}>Home Screen Shortcuts</Text>
            <Text style={[styles.bannerSubtitle, { color: colors.textSecondary }]}>
              Add quick-reply widgets to your home screen to message your favorite people with one tap.
            </Text>
          </View>
        </View>

        {Platform.OS !== "web" && (
          <View style={[styles.infoBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              Widgets require a custom development build. Configure your selections here, then follow the setup guide after installing a ZIVR development build.
            </Text>
          </View>
        )}

        <Text style={[styles.sectionHeader, { color: colors.textTertiary }]}>WIDGET SIZES</Text>
        {WIDGET_TYPES.map((wt) => (
          <View key={wt.id} style={[styles.widgetCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.widgetIconWrap, { backgroundColor: colors.primary + "15" }]}>
              <Ionicons name={wt.icon as any} size={24} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.widgetTitle, { color: colors.text }]}>{wt.title}</Text>
              <Text style={[styles.widgetDesc, { color: colors.textSecondary }]}>{wt.description}</Text>
            </View>
            <View style={styles.widgetPreview}>
              {Array.from({ length: wt.slots }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.widgetSlot,
                    {
                      backgroundColor:
                        i < selectedChats.length ? colors.primary + "20" : colors.surfaceSecondary,
                      borderColor: i < selectedChats.length ? colors.primary : colors.border,
                    },
                  ]}
                />
              ))}
            </View>
          </View>
        ))}

        <Text style={[styles.sectionHeader, { color: colors.textTertiary, marginTop: 8 }]}>
          SELECT CHATS FOR WIDGET ({selectedChats.length}/4)
        </Text>
        <Text style={[styles.sectionNote, { color: colors.textSecondary }]}>
          Select up to 4 chats to pin as widget shortcuts
        </Text>

        {visibleChats.map((chat) => {
          const selected = selectedChats.includes(chat.id);
          const idx = selectedChats.indexOf(chat.id);
          return (
            <Pressable
              key={chat.id}
              onPress={() => toggleChat(chat.id)}
              style={({ pressed }) => [
                styles.chatRow,
                {
                  backgroundColor: selected ? colors.primary + "10" : colors.surface,
                  borderColor: selected ? colors.primary : colors.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Avatar name={chat.name} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.chatName, { color: colors.text }]}>{chat.name}</Text>
                <Text style={[styles.chatType, { color: colors.textSecondary }]}>
                  {chat.type === "direct" ? "Direct Message" : "Group"}
                </Text>
              </View>
              {selected ? (
                <View style={[styles.selectedBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.selectedBadgeText}>{idx + 1}</Text>
                </View>
              ) : (
                <View style={[styles.emptyCheck, { borderColor: colors.border }]} />
              )}
            </Pressable>
          );
        })}

        {selectedChats.length > 0 && (
          <>
            <Text style={[styles.sectionHeader, { color: colors.textTertiary, marginTop: 8 }]}>WIDGET PREVIEW</Text>
            <View style={[styles.widgetPreviewBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <View style={styles.widgetGrid}>
                {selectedChats.map((chatId, i) => {
                  const chat = chats.find((c) => c.id === chatId);
                  return (
                    <View key={chatId} style={[styles.widgetItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <Avatar name={chat?.name || "?"} size={32} />
                      <Text style={[styles.widgetItemName, { color: colors.text }]} numberOfLines={1}>
                        {chat?.name?.split(" ")[0]}
                      </Text>
                      <Ionicons name="paper-plane" size={12} color={colors.primary} />
                    </View>
                  );
                })}
              </View>
              <Text style={[styles.previewLabel, { color: colors.textTertiary }]}>
                Widget preview — tap to message instantly
              </Text>
            </View>
          </>
        )}

        <Pressable
          style={[
            styles.addBtn,
            { backgroundColor: selectedChats.length > 0 ? colors.primary : colors.surfaceSecondary },
          ]}
          onPress={() => {
            if (selectedChats.length === 0) return;
            router.back();
          }}
        >
          <Ionicons
            name="add-circle-outline"
            size={20}
            color={selectedChats.length > 0 ? "#FFF" : colors.textTertiary}
          />
          <Text
            style={[
              styles.addBtnText,
              { color: selectedChats.length > 0 ? "#FFF" : colors.textTertiary },
            ]}
          >
            {selectedChats.length > 0
              ? `Save ${selectedChats.length} Widget Shortcut${selectedChats.length > 1 ? "s" : ""}`
              : "Select chats above"}
          </Text>
        </Pressable>

        <Text style={[styles.helpText, { color: colors.textTertiary }]}>
          After saving, go to your home screen → long press → Add Widget → ZIVR to place your shortcuts.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    justifyContent: "space-between",
  },
  backBtn: { flexDirection: "row", alignItems: "center" },
  backText: { fontSize: 16, fontFamily: "Inter_400Regular" },
  headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  content: { paddingTop: 20, gap: 6 },
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    padding: 16,
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 8,
  },
  bannerTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  bannerSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 4,
  },
  infoText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  sectionHeader: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  sectionNote: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  widgetCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 6,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  widgetIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  widgetTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  widgetDesc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  widgetPreview: { flexDirection: "row", gap: 4, flexWrap: "wrap", width: 44 },
  widgetSlot: { width: 18, height: 18, borderRadius: 4, borderWidth: 1 },
  chatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 6,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  chatName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  chatType: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  selectedBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedBadgeText: { color: "#FFF", fontSize: 14, fontFamily: "Inter_700Bold" },
  emptyCheck: { width: 28, height: 28, borderRadius: 14, borderWidth: 2 },
  widgetPreviewBox: {
    marginHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  widgetGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  widgetItem: {
    width: 80,
    alignItems: "center",
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
  },
  widgetItemName: { fontSize: 11, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  previewLabel: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 12,
  },
  addBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  helpText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 32,
    marginTop: 12,
  },
});
