import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useMessaging } from "@/context/MessagingContext";
import { useServer } from "@/context/ServerContext";

function parts(timestamp: number) {
  const date = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, "0");
  return { date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`, time: `${pad(date.getHours())}:${pad(date.getMinutes())}` };
}

export default function ScheduleMessageScreen() {
  const { chatId, scheduledId } = useLocalSearchParams<{ chatId?: string; scheduledId?: string }>();
  const colors = useColorScheme() === "dark" ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const { chats } = useMessaging();
  const { listScheduledMessages, createScheduledMessage, updateScheduledMessage } = useServer();
  const availableChats = useMemo(() => chats.filter((chat) => chat.isServerChat && (chat.type === "direct" || chat.type === "group")), [chats]);
  const initial = parts(Date.now() + 60 * 60 * 1000);
  const [selectedChatId, setSelectedChatId] = useState(chatId ?? "");
  const [text, setText] = useState("");
  const [dateText, setDateText] = useState(initial.date);
  const [timeText, setTimeText] = useState(initial.time);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!scheduledId) return;
    listScheduledMessages().then((items) => {
      const item = items.find((candidate) => candidate.id === scheduledId);
      if (!item) return;
      const value = parts(item.scheduledFor);
      setSelectedChatId(item.chatId);
      setText(item.text);
      setDateText(value.date);
      setTimeText(value.time);
    }).catch(() => Alert.alert("Couldn't load message", "It may already have been sent or cancelled."));
  }, [listScheduledMessages, scheduledId]);

  const save = async () => {
    const timestamp = new Date(`${dateText}T${timeText}:00`).getTime();
    if (!selectedChatId) return Alert.alert("Choose a conversation", "Select who should receive this message.");
    if (!text.trim()) return Alert.alert("Write a message", "Scheduled messages can't be empty.");
    if (!Number.isFinite(timestamp) || timestamp < Date.now() + 30_000) {
      return Alert.alert("Choose a future time", "Enter a valid date and time at least 30 seconds from now.");
    }
    setSaving(true);
    try {
      if (scheduledId) await updateScheduledMessage(scheduledId, { text: text.trim(), scheduledFor: timestamp });
      else await createScheduledMessage({ chatId: selectedChatId, text: text.trim(), scheduledFor: timestamp });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/scheduled");
    } catch (error) {
      Alert.alert("Couldn't schedule message", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()}><Text style={[styles.headerAction, { color: colors.primary }]}>Cancel</Text></Pressable>
        <Text style={[styles.title, { color: colors.text }]}>{scheduledId ? "Edit Scheduled" : "Schedule Message"}</Text>
        <Pressable onPress={save} disabled={saving}><Text style={[styles.headerAction, { color: saving ? colors.textTertiary : colors.primary }]}>Save</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.label, { color: colors.textSecondary }]}>CONVERSATION</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {availableChats.map((chat) => {
            const active = chat.id === selectedChatId;
            return (
              <Pressable key={chat.id} disabled={!!scheduledId} onPress={() => setSelectedChatId(chat.id)}
                style={[styles.chip, { backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primary : colors.border }]}>
                <Ionicons name={chat.type === "group" ? "people-outline" : "person-outline"} size={16} color={active ? "#fff" : colors.textSecondary} />
                <Text style={[styles.chipText, { color: active ? "#fff" : colors.text }]}>{chat.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        {!availableChats.length && <Text style={[styles.help, { color: colors.textSecondary }]}>Start a live conversation before scheduling a message.</Text>}

        <Text style={[styles.label, { color: colors.textSecondary }]}>MESSAGE</Text>
        <TextInput value={text} onChangeText={setText} multiline maxLength={2000} placeholder="Type the message to send later"
          placeholderTextColor={colors.textTertiary} style={[styles.messageInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} />
        <Text style={[styles.count, { color: colors.textTertiary }]}>{text.length}/2000</Text>

        <Text style={[styles.label, { color: colors.textSecondary }]}>SEND DATE & TIME</Text>
        <View style={styles.timeRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Date</Text>
            <TextInput value={dateText} onChangeText={setDateText} placeholder="YYYY-MM-DD" autoCapitalize="none"
              style={[styles.field, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} />
          </View>
          <View style={{ width: 120 }}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Time</Text>
            <TextInput value={timeText} onChangeText={setTimeText} placeholder="HH:MM" keyboardType="numbers-and-punctuation"
              style={[styles.field, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} />
          </View>
        </View>
        <Text style={[styles.help, { color: colors.textSecondary }]}>Uses this device's local time. The message will send even if the app is closed.</Text>
        <Pressable onPress={save} disabled={saving} style={[styles.saveButton, { backgroundColor: saving ? colors.textTertiary : colors.primary }]}>
          <Ionicons name="time-outline" size={20} color="#fff" />
          <Text style={styles.saveText}>{saving ? "Saving…" : scheduledId ? "Update scheduled message" : "Schedule message"}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 17, fontFamily: "Inter_700Bold" },
  headerAction: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  content: { padding: 20, gap: 10 },
  label: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginTop: 12, letterSpacing: 0.6 },
  chips: { gap: 8, paddingVertical: 2 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth },
  chipText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  messageInput: { minHeight: 130, borderRadius: 15, borderWidth: StyleSheet.hairlineWidth, padding: 14, fontSize: 16, lineHeight: 22, textAlignVertical: "top" },
  count: { textAlign: "right", fontSize: 11 },
  timeRow: { flexDirection: "row", gap: 12 },
  fieldLabel: { fontSize: 12, marginBottom: 5 },
  field: { height: 48, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, fontSize: 16 },
  help: { fontSize: 13, lineHeight: 18 },
  saveButton: { marginTop: 20, height: 52, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  saveText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});