import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
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
import type { SelfDestructConfig } from "@/context/MessagingContext";

const DURATIONS: { label: string; value: number }[] = [
  { label: "10s", value: 10 },
  { label: "30s", value: 30 },
  { label: "1m", value: 60 },
  { label: "5m", value: 300 },
  { label: "10m", value: 600 },
  { label: "30m", value: 1800 },
  { label: "1h", value: 3600 },
];

const SHIELD_GIFS = [
  { label: "Eyes Only", url: "https://media.giphy.com/media/l0HlBO7eyXzSZkJri/giphy.gif" },
  { label: "Top Secret", url: "https://media.giphy.com/media/26BRzozg4TCBXv6QU/giphy.gif" },
  { label: "Mission Abort", url: "https://media.giphy.com/media/3o7TKSxduOoGKGlZ8Y/giphy.gif" },
  { label: "Self Destruct", url: "https://media.giphy.com/media/xT9IgG50Lg7rusftDu/giphy.gif" },
  { label: "Classified", url: "https://media.giphy.com/media/26ufnwz3wDUli7GU0/giphy.gif" },
  { label: "Access Denied", url: "https://media.giphy.com/media/xT9IgDECMkNjME19kY/giphy.gif" },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  onConfirm: (config: SelfDestructConfig) => void;
}

export function SelfDestructPicker({ visible, onClose, onConfirm }: Props) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;

  const [selectedDuration, setSelectedDuration] = useState(60);
  const [shieldMode, setShieldMode] = useState<"none" | "text" | "gif">("text");
  const [shieldText, setShieldText] = useState("⚠️ Screenshot blocked — this message is classified.");
  const [shieldGifUrl, setShieldGifUrl] = useState(SHIELD_GIFS[0].url);

  const handleConfirm = () => {
    const config: SelfDestructConfig = {
      duration: selectedDuration,
      shieldText: shieldMode === "text" ? shieldText : undefined,
      shieldGifUrl: shieldMode === "gif" ? shieldGifUrl : undefined,
    };
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onConfirm(config);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <View style={styles.handle} />

        <View style={styles.titleRow}>
          <Text style={styles.titleEmoji}>💣</Text>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>Self-Destruct Message</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Message explodes after the timer runs out</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>SELF-DESTRUCT TIMER</Text>
          <View style={styles.durationRow}>
            {DURATIONS.map((d) => (
              <Pressable
                key={d.value}
                style={[
                  styles.durationBtn,
                  { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                  selectedDuration === d.value && styles.durationBtnActive,
                ]}
                onPress={() => { setSelectedDuration(d.value); Haptics.selectionAsync(); }}
              >
                <Text style={[
                  styles.durationBtnText,
                  { color: colors.textSecondary },
                  selectedDuration === d.value && styles.durationBtnTextActive,
                ]}>
                  {d.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: 20 }]}>
            SCREENSHOT SHIELD
          </Text>
          <Text style={[styles.sectionHint, { color: colors.textTertiary }]}>
            If the receiver takes a screenshot, they'll see this instead
          </Text>

          <View style={styles.shieldModeRow}>
            {(["none", "text", "gif"] as const).map((mode) => (
              <Pressable
                key={mode}
                style={[
                  styles.shieldModeBtn,
                  { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                  shieldMode === mode && styles.shieldModeBtnActive,
                ]}
                onPress={() => { setShieldMode(mode); Haptics.selectionAsync(); }}
              >
                <Text style={[
                  styles.shieldModeBtnText,
                  { color: colors.textSecondary },
                  shieldMode === mode && styles.shieldModeBtnTextActive,
                ]}>
                  {mode === "none" ? "Off" : mode === "text" ? "Message" : "GIF"}
                </Text>
              </Pressable>
            ))}
          </View>

          {shieldMode === "text" && (
            <View style={[styles.shieldTextBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <TextInput
                value={shieldText}
                onChangeText={setShieldText}
                multiline
                style={[styles.shieldTextInput, { color: colors.text }]}
                placeholder="Enter shield message…"
                placeholderTextColor={colors.textTertiary}
              />
            </View>
          )}

          {shieldMode === "gif" && (
            <View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gifRow}>
                {SHIELD_GIFS.map((g) => (
                  <Pressable
                    key={g.url}
                    style={[
                      styles.gifThumb,
                      { borderColor: shieldGifUrl === g.url ? "#FF3B30" : "transparent" },
                    ]}
                    onPress={() => { setShieldGifUrl(g.url); Haptics.selectionAsync(); }}
                  >
                    <ExpoImage source={{ uri: g.url }} style={styles.gifThumbImg} contentFit="cover" />
                    <Text style={[styles.gifThumbLabel, { color: colors.textSecondary }]}>{g.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={[styles.previewBox, { backgroundColor: "#1a1a2e", borderColor: "#FF3B30" + "44" }]}>
            <Ionicons name="eye-off-outline" size={14} color="#FF3B30" />
            <Text style={styles.previewText}>
              Explodes in <Text style={styles.previewHighlight}>
                {DURATIONS.find((d) => d.value === selectedDuration)?.label}
              </Text> · Shield: <Text style={styles.previewHighlight}>
                {shieldMode === "none" ? "Off" : shieldMode === "text" ? "Custom message" : "GIF"}
              </Text>
            </Text>
          </View>
        </ScrollView>

        <View style={styles.btnRow}>
          <Pressable style={[styles.cancelBtn, { backgroundColor: colors.surfaceSecondary }]} onPress={onClose}>
            <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Cancel</Text>
          </Pressable>
          <Pressable style={styles.confirmBtn} onPress={handleConfirm}>
            <Text style={styles.confirmBtnText}>Arm &amp; Send 💣</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    paddingBottom: 34,
    maxHeight: "85%",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#3a3a3c",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  titleEmoji: {
    fontSize: 32,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
    fontFamily: "Inter_400Regular",
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  sectionHint: {
    fontSize: 12,
    marginTop: -6,
    marginBottom: 10,
    fontFamily: "Inter_400Regular",
  },
  durationRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  durationBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  durationBtnActive: {
    backgroundColor: "#FF3B30",
    borderColor: "#FF3B30",
  },
  durationBtnText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  durationBtnTextActive: {
    color: "#fff",
  },
  shieldModeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  shieldModeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  shieldModeBtnActive: {
    backgroundColor: "#5E6AD2",
    borderColor: "#5E6AD2",
  },
  shieldModeBtnText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  shieldModeBtnTextActive: {
    color: "#fff",
  },
  shieldTextBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
    minHeight: 70,
  },
  shieldTextInput: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  gifRow: {
    paddingBottom: 12,
    gap: 8,
  },
  gifThumb: {
    borderRadius: 12,
    borderWidth: 2,
    overflow: "hidden",
    width: 100,
    alignItems: "center",
  },
  gifThumbImg: {
    width: 100,
    height: 70,
  },
  gifThumbLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    paddingVertical: 4,
  },
  previewBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 16,
  },
  previewText: {
    color: "#aaa",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  previewHighlight: {
    color: "#FF3B30",
    fontFamily: "Inter_600SemiBold",
  },
  btnRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  confirmBtn: {
    flex: 2,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#FF3B30",
  },
  confirmBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
});
