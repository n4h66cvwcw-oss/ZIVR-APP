import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
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
import Colors from "@/constants/colors";
import type { ImageAttachment } from "@/context/MessagingContext";

interface SecurePictureModalProps {
  imageUri: string;
  imageWidth?: number;
  imageHeight?: number;
  onSend: (attachment: ImageAttachment) => void;
  onCancel: () => void;
}

type SecurityMode = "none" | "password" | "single-view" | "timed";

const SECURITY_OPTIONS: {
  mode: SecurityMode;
  icon: string;
  label: string;
  description: string;
  color: string;
}[] = [
  {
    mode: "none",
    icon: "image-outline",
    label: "Regular",
    description: "Anyone can view anytime",
    color: "#636366",
  },
  {
    mode: "password",
    icon: "lock-closed",
    label: "Password",
    description: "Requires a password to open",
    color: "#0A84FF",
  },
  {
    mode: "single-view",
    icon: "eye",
    label: "Single View",
    description: "Auto-deletes after opening once",
    color: "#FF9F0A",
  },
  {
    mode: "timed",
    icon: "timer-outline",
    label: "Timed Open",
    description: "Available after a set delay",
    color: "#30D158",
  },
];

const TIMER_PRESETS = [
  { label: "5 min",  secs: 300 },
  { label: "1 hour", secs: 3600 },
  { label: "6 hrs",  secs: 21600 },
  { label: "1 day",  secs: 86400 },
];

export function SecurePictureModal({
  imageUri,
  imageWidth,
  imageHeight,
  onSend,
  onCancel,
}: SecurePictureModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;

  const [mode, setMode] = useState<SecurityMode>("none");
  const [password, setPassword] = useState("");
  const [timerSecs, setTimerSecs] = useState(3600);

  const handleSend = () => {
    if (mode === "password" && !password.trim()) return;
    const attachment: ImageAttachment = {
      uri: imageUri,
      width: imageWidth,
      height: imageHeight,
      security: mode,
      password: mode === "password" ? password.trim() : undefined,
      viewAfter: mode === "timed" ? Date.now() + timerSecs * 1000 : undefined,
      viewedBy: [],
    };
    onSend(attachment);
  };

  const canSend = mode !== "password" || password.trim().length >= 1;

  return (
    <Modal transparent animationType="slide" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <Pressable style={styles.backdrop} onPress={onCancel} />
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={styles.handle} />
          <Text style={[styles.title, { color: colors.text }]}>Send Photo</Text>

          <Image
            source={{ uri: imageUri }}
            style={styles.preview}
            resizeMode="cover"
          />

          <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>
            PHOTO SECURITY
          </Text>
          <View style={styles.optionsGrid}>
            {SECURITY_OPTIONS.map((opt) => {
              const active = mode === opt.mode;
              return (
                <Pressable
                  key={opt.mode}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setMode(opt.mode);
                  }}
                  style={[
                    styles.optionCard,
                    {
                      backgroundColor: active ? opt.color + "18" : colors.surfaceSecondary,
                      borderColor: active ? opt.color : "transparent",
                      borderWidth: active ? 1.5 : 0,
                    },
                  ]}
                >
                  <Ionicons name={opt.icon as any} size={22} color={active ? opt.color : colors.textSecondary} />
                  <Text style={[styles.optionLabel, { color: active ? opt.color : colors.text }]}>
                    {opt.label}
                  </Text>
                  <Text style={[styles.optionDesc, { color: colors.textTertiary }]} numberOfLines={2}>
                    {opt.description}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {mode === "password" && (
            <View style={[styles.passwordWrap, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.textSecondary} />
              <TextInput
                style={[styles.passwordInput, { color: colors.text }]}
                placeholder="Set a password..."
                placeholderTextColor={colors.textTertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoFocus
              />
            </View>
          )}

          {mode === "timed" && (
            <View style={styles.timerRow}>
              {TIMER_PRESETS.map((p) => (
                <Pressable
                  key={p.secs}
                  onPress={() => setTimerSecs(p.secs)}
                  style={[
                    styles.timerChip,
                    {
                      backgroundColor:
                        timerSecs === p.secs ? "#30D158" : colors.surfaceSecondary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.timerChipText,
                      { color: timerSecs === p.secs ? "#FFF" : colors.textSecondary },
                    ]}
                  >
                    {p.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          <View style={styles.actions}>
            <Pressable
              onPress={onCancel}
              style={[styles.actionBtn, { backgroundColor: colors.surfaceSecondary }]}
            >
              <Text style={[styles.actionBtnText, { color: colors.text }]}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleSend}
              disabled={!canSend}
              style={[
                styles.actionBtn,
                { backgroundColor: canSend ? colors.primary : colors.surfaceSecondary },
              ]}
            >
              <Ionicons name="send" size={16} color={canSend ? "#FFF" : colors.textTertiary} />
              <Text
                style={[styles.actionBtnText, { color: canSend ? "#FFF" : colors.textTertiary }]}
              >
                Send
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    gap: 16,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#C7C7CC",
    alignSelf: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  preview: {
    width: "100%",
    height: 180,
    borderRadius: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    marginBottom: -8,
  },
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  optionCard: {
    width: "47%",
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  optionLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  optionDesc: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    lineHeight: 15,
  },
  passwordWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  passwordInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  timerRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  timerChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  timerChipText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  actionBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
