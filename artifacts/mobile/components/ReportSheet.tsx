import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import Colors from "@/constants/colors";
import { REPORT_REASONS, type ReportReason } from "@/utils/safety";

const REASON_LABELS: Record<ReportReason, string> = {
  spam: "Spam",
  harassment: "Harassment",
  inappropriate: "Inappropriate",
  other: "Other",
};

export function ReportSheet({
  visible,
  title,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  onSubmit: (reason: ReportReason, details: string) => Promise<void>;
}) {
  const colors = useColorScheme() === "dark" ? Colors.dark : Colors.light;
  const [reason, setReason] = useState<ReportReason>("harassment");
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);

  async function submit() {
    if (sending) return;
    setSending(true);
    try {
      await onSubmit(reason, details);
      setDetails("");
      onClose();
    } catch {
      // The caller alerts. Keep the sheet open so the report can be edited.
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]} onPress={() => {}}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Reports are sent to ZIVR moderators. The other person is not told who reported them.
          </Text>
          <View style={styles.reasons}>
            {REPORT_REASONS.map((option) => {
              const selected = option === reason;
              return (
                <Pressable
                  key={option}
                  onPress={() => setReason(option)}
                  style={[
                    styles.reason,
                    {
                      backgroundColor: selected ? colors.primary : colors.background,
                      borderColor: selected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={{ color: selected ? "#fff" : colors.text, fontFamily: "Inter_600SemiBold" }}>
                    {REASON_LABELS[option]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            value={details}
            onChangeText={setDetails}
            placeholder="Optional details"
            placeholderTextColor={colors.textTertiary}
            multiline
            maxLength={2000}
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
          />
          <Pressable
            onPress={() => { void submit(); }}
            disabled={sending}
            style={[styles.submit, { backgroundColor: colors.primary, opacity: sending ? 0.7 : 1 }]}
          >
            {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit report</Text>}
          </Pressable>
          <Pressable onPress={onClose} style={styles.cancel}>
            <Ionicons name="close" size={16} color={colors.textSecondary} />
            <Text style={{ color: colors.textSecondary, fontFamily: "Inter_500Medium" }}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32 },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 12 },
  title: { fontSize: 18, fontFamily: "Inter_700Bold" },
  subtitle: { marginTop: 6, marginBottom: 14, fontSize: 13, lineHeight: 18, fontFamily: "Inter_400Regular" },
  reasons: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  reason: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  input: { minHeight: 80, borderWidth: 1, borderRadius: 12, marginTop: 14, padding: 12, textAlignVertical: "top", fontFamily: "Inter_400Regular" },
  submit: { marginTop: 14, borderRadius: 12, minHeight: 46, alignItems: "center", justifyContent: "center" },
  submitText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
  cancel: { marginTop: 12, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 4 },
});
