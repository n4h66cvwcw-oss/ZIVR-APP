import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as MailComposer from "expo-mail-composer";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Modal,
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
import { PasscodeModal } from "@/components/PasscodeModal";
import { NOTIFICATION_SOUNDS, getSoundLabel } from "@/utils/notifications";

export default function ChatSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const {
    chats,
    setChatPasscode,
    removeChatPasscode,
    verifyChatPasscode,
    enableChatEncryption,
    disableChatEncryption,
    generateChatPdfHtml,
    deleteChat,
    pinChat,
    muteChat,
    setNotificationSound,
    setReadReceiptsEnabled,
  } = useMessaging();

  const chat = chats.find((c) => c.id === id);
  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  const [showSetPasscode, setShowSetPasscode] = useState(false);
  const [showVerifyOld, setShowVerifyOld] = useState(false);
  const [newPasscode, setNewPasscode] = useState("");
  const [newPasscodeRepeat, setNewPasscodeRepeat] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState(chat?.recoveryEmail || "");
  const [hint, setHint] = useState(chat?.passcodeHint || "");
  const [passcodeStep, setPasscodeStep] = useState<"enter" | "repeat">("enter");
  const [exporting, setExporting] = useState(false);
  const [showSoundPicker, setShowSoundPicker] = useState(false);

  if (!chat) return null;

  const hasPasscode = !!chat.passcodeHash;

  const handleToggleEncryption = async () => {
    if (chat.isEncrypted) {
      Alert.alert(
        "Disable Encryption",
        "Messages will be stored as plain text. Existing messages will be decrypted.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Disable",
            style: "destructive",
            onPress: async () => {
              await disableChatEncryption(id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            },
          },
        ]
      );
    } else {
      try {
        await enableChatEncryption(id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          "🔐 Encryption Enabled",
          "All messages in this chat are now end-to-end encrypted. The encryption key is stored locally on your device.",
          [{ text: "Got it" }]
        );
      } catch (e: any) {
        Alert.alert("Encryption Error", e?.message || "Could not enable encryption. Please try again.");
      }
    }
  };

  const handleRemovePasscode = () => {
    Alert.alert("Remove Passcode", "Are you sure you want to remove the passcode lock?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await removeChatPasscode(id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  };

  const handleSavePasscode = async () => {
    if (newPasscode.length < 4) {
      Alert.alert("Invalid passcode", "Please enter at least 4 digits.");
      return;
    }
    if (newPasscode !== newPasscodeRepeat) {
      Alert.alert("Passcodes don't match", "Please try again.");
      setNewPasscodeRepeat("");
      setPasscodeStep("enter");
      return;
    }
    await setChatPasscode(id, newPasscode, recoveryEmail || undefined, hint || undefined);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowSetPasscode(false);
    setNewPasscode("");
    setNewPasscodeRepeat("");
    setPasscodeStep("enter");
  };

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const html = generateChatPdfHtml(id);
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: `${chat.name} — Message Thread`,
        UTI: "com.adobe.pdf",
      });
    } catch (e) {
      Alert.alert("Export failed", "Could not generate PDF. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const handleSendRecoveryEmail = async () => {
    if (!chat.recoveryEmail) {
      Alert.alert("No recovery email set", "Please set a recovery email first.");
      return;
    }
    const available = await MailComposer.isAvailableAsync();
    if (!available) {
      Alert.alert(
        "Recovery Code",
        "Your passcode hint: " + (chat.passcodeHint || "No hint set.\n\nNote: For security, we cannot display the actual passcode. Please use your hint or reset the passcode."),
        [{ text: "OK" }]
      );
      return;
    }
    await MailComposer.composeAsync({
      recipients: [chat.recoveryEmail],
      subject: "ZIVR — Chat Passcode Recovery",
      body: `Hi,\n\nYou requested passcode recovery for your ZIVR chat "${chat.name}".\n\nYour passcode hint: ${chat.passcodeHint || "No hint set."}\n\nIf you cannot remember your passcode, open ZIVR → Chat Settings → Reset Passcode.\n\nZIVR Team`,
    });
  };

  const handleDeleteChat = () => {
    Alert.alert(
      "Delete Chat",
      "This will permanently delete all messages. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteChat(id);
            router.replace("/");
          },
        },
      ]
    );
  };

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
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.primary} />
          <Text style={[styles.backText, { color: colors.primary }]}>Back</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Chat Settings</Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.chatName, { color: colors.text }]}>{chat.name}</Text>
        <Text style={[styles.chatType, { color: colors.textSecondary }]}>
          {chat.type === "direct" ? "Direct Message" : "Group Chat"}
        </Text>

        <SectionHeader title="Security" colors={colors} />

        <SettingRow
          icon="lock-closed-outline"
          label="End-to-End Encryption"
          subtitle={chat.isEncrypted ? "Messages are encrypted on device" : "Enable AES-256 encryption"}
          colors={colors}
          right={
            <Switch
              value={!!chat.isEncrypted}
              onValueChange={handleToggleEncryption}
              trackColor={{ false: colors.border, true: colors.primary + "80" }}
              thumbColor={chat.isEncrypted ? colors.primary : colors.textTertiary}
            />
          }
        />

        <SettingRow
          icon="keypad-outline"
          label={hasPasscode ? "Change Passcode" : "Set Passcode Lock"}
          subtitle={hasPasscode ? "Tap to change your 4-6 digit passcode" : "Protect this chat with a passcode"}
          colors={colors}
          onPress={() => {
            setPasscodeStep("enter");
            setNewPasscode("");
            setNewPasscodeRepeat("");
            setShowSetPasscode(true);
          }}
        />

        {hasPasscode && (
          <>
            <SettingRow
              icon="mail-outline"
              label="Send Recovery Email"
              subtitle={chat.recoveryEmail ? `Recovery sent to ${chat.recoveryEmail.replace(/(.{2}).*(@.*)/, "$1***$2")}` : "No recovery email set"}
              colors={colors}
              onPress={handleSendRecoveryEmail}
            />
            <SettingRow
              icon="lock-open-outline"
              label="Remove Passcode"
              subtitle="Unlock this chat for everyone"
              colors={colors}
              onPress={handleRemovePasscode}
              danger
            />
          </>
        )}

        <SectionHeader title="Export" colors={colors} />

        <SettingRow
          icon="document-text-outline"
          label={exporting ? "Generating PDF..." : "Export to PDF"}
          subtitle="Save this thread with dates and times"
          colors={colors}
          onPress={handleExportPDF}
          disabled={exporting}
        />

        <SectionHeader title="Organization" colors={colors} />

        <SettingRow
          icon={chat.isPinned ? "pin" : "pin-outline"}
          label={chat.isPinned ? "Unpin Chat" : "Pin to Top"}
          subtitle={chat.isPinned ? "Remove from pinned" : "Always show at the top"}
          colors={colors}
          onPress={() => pinChat(id)}
        />

        <SectionHeader title="Notifications" colors={colors} />

        <SettingRow
          icon={chat.isMuted ? "notifications-off-outline" : "notifications-outline"}
          label={chat.isMuted ? "Unmute Chat" : "Mute Chat"}
          subtitle={chat.isMuted ? "Notifications are silenced" : "Receive alerts for new messages"}
          colors={colors}
          right={
            <Switch
              value={!chat.isMuted}
              onValueChange={() => { Haptics.selectionAsync(); muteChat(id); }}
              trackColor={{ false: colors.border, true: colors.primary + "80" }}
              thumbColor={!chat.isMuted ? colors.primary : colors.textTertiary}
            />
          }
        />

        <SettingRow
          icon="musical-note-outline"
          label="Notification Sound"
          subtitle={getSoundLabel(chat.notificationSound ?? "default")}
          colors={colors}
          onPress={() => setShowSoundPicker(true)}
        />

        <SettingRow
          icon="checkmark-done-outline"
          label="Read Receipts"
          subtitle={chat.readReceiptsEnabled !== false ? "Others can see when you've read their messages" : "Read receipts are hidden"}
          colors={colors}
          right={
            <Switch
              value={chat.readReceiptsEnabled !== false}
              onValueChange={(v) => { Haptics.selectionAsync(); setReadReceiptsEnabled(id, v); }}
              trackColor={{ false: colors.border, true: colors.primary + "80" }}
              thumbColor={chat.readReceiptsEnabled !== false ? colors.primary : colors.textTertiary}
            />
          }
        />

        <SectionHeader title="Danger Zone" colors={colors} />

        <SettingRow
          icon="trash-outline"
          label="Delete Chat"
          subtitle="Permanently delete all messages"
          colors={colors}
          onPress={handleDeleteChat}
          danger
        />
      </ScrollView>

      <Modal visible={showSoundPicker} animationType="slide" presentationStyle="pageSheet" transparent>
        <Pressable style={styles.soundPickerOverlay} onPress={() => setShowSoundPicker(false)}>
          <Pressable style={[styles.soundPickerSheet, { backgroundColor: colors.surface }]}>
            <View style={[styles.soundPickerHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.soundPickerTitle, { color: colors.text }]}>Notification Sound</Text>
            {NOTIFICATION_SOUNDS.map((sound) => {
              const selected = (chat.notificationSound ?? "default") === sound.id;
              return (
                <Pressable
                  key={sound.id}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setNotificationSound(id, sound.id);
                    setShowSoundPicker(false);
                  }}
                  style={({ pressed }) => [
                    styles.soundRow,
                    { backgroundColor: selected ? colors.primary + "14" : "transparent", opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <View style={[styles.soundIcon, { backgroundColor: selected ? colors.primary + "20" : colors.surfaceSecondary }]}>
                    <Ionicons name={sound.icon as any} size={18} color={selected ? colors.primary : colors.textSecondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.soundLabel, { color: selected ? colors.primary : colors.text }]}>{sound.label}</Text>
                    <Text style={[styles.soundDesc, { color: colors.textSecondary }]}>{sound.description}</Text>
                  </View>
                  {selected && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showSetPasscode} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Pressable onPress={() => setShowSetPasscode(false)}>
              <Text style={[styles.cancelText, { color: colors.primary }]}>Cancel</Text>
            </Pressable>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Set Passcode</Text>
            <Pressable onPress={handleSavePasscode}>
              <Text style={[styles.saveText, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
                Save
              </Text>
            </Pressable>
          </View>

          <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
            <View style={[styles.inputSection, { backgroundColor: colors.surface }]}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                {passcodeStep === "enter" ? "NEW PASSCODE (4-6 DIGITS)" : "REPEAT PASSCODE"}
              </Text>
              <TextInput
                style={[styles.passcodeInput, { color: colors.text, borderColor: colors.border }]}
                value={passcodeStep === "enter" ? newPasscode : newPasscodeRepeat}
                onChangeText={(v) => {
                  const digits = v.replace(/\D/g, "").slice(0, 6);
                  if (passcodeStep === "enter") setNewPasscode(digits);
                  else setNewPasscodeRepeat(digits);
                }}
                placeholder="••••••"
                placeholderTextColor={colors.textTertiary}
                secureTextEntry
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />
              {passcodeStep === "enter" && newPasscode.length >= 4 && (
                <Pressable
                  style={[styles.nextBtn, { backgroundColor: colors.primary }]}
                  onPress={() => setPasscodeStep("repeat")}
                >
                  <Text style={styles.nextBtnText}>Next</Text>
                </Pressable>
              )}
            </View>

            <View style={[styles.inputSection, { backgroundColor: colors.surface, marginTop: 16 }]}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>RECOVERY EMAIL (OPTIONAL)</Text>
              <TextInput
                style={[styles.textInput, { color: colors.text, borderColor: colors.border }]}
                value={recoveryEmail}
                onChangeText={setRecoveryEmail}
                placeholder="your@email.com"
                placeholderTextColor={colors.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={[styles.inputSection, { backgroundColor: colors.surface, marginTop: 16 }]}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>PASSCODE HINT (OPTIONAL)</Text>
              <TextInput
                style={[styles.textInput, { color: colors.text, borderColor: colors.border }]}
                value={hint}
                onChangeText={setHint}
                placeholder="e.g. My favorite year"
                placeholderTextColor={colors.textTertiary}
              />
            </View>

            <Text style={[styles.infoText, { color: colors.textTertiary }]}>
              The passcode is hashed and stored locally. We never have access to your passcode.
              If you forget it, use your recovery email or hint to reset.
            </Text>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function SectionHeader({ title, colors }: { title: string; colors: any }) {
  return (
    <Text style={[styles.sectionHeader, { color: colors.textTertiary }]}>{title.toUpperCase()}</Text>
  );
}

function SettingRow({
  icon,
  label,
  subtitle,
  colors,
  onPress,
  right,
  danger,
  disabled,
}: {
  icon: string;
  label: string;
  subtitle: string;
  colors: any;
  onPress?: () => void;
  right?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      style={({ pressed }) => [
        styles.settingRow,
        { backgroundColor: colors.surface, opacity: pressed ? 0.7 : disabled ? 0.5 : 1 },
      ]}
    >
      <View style={[styles.settingIcon, { backgroundColor: danger ? "#FF453A20" : colors.primary + "18" }]}>
        <Ionicons
          name={icon as any}
          size={20}
          color={danger ? "#FF453A" : colors.primary}
        />
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingLabel, { color: danger ? "#FF453A" : colors.text }]}>{label}</Text>
        <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
      </View>
      {right || (onPress && !right && <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />)}
    </Pressable>
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
  content: { paddingTop: 24, paddingBottom: 48, gap: 4 },
  chatName: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginBottom: 4,
  },
  chatType: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 6,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 2,
    borderRadius: 14,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  settingContent: { flex: 1 },
  settingLabel: { fontSize: 15, fontFamily: "Inter_500Medium" },
  settingSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  cancelText: { fontSize: 16, fontFamily: "Inter_400Regular" },
  saveText: { fontSize: 16 },
  modalContent: { flex: 1, padding: 20 },
  inputSection: {
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  inputLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
  },
  passcodeInput: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    borderBottomWidth: 2,
    paddingVertical: 8,
    letterSpacing: 12,
  },
  textInput: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
  },
  nextBtn: {
    alignSelf: "flex-end",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  nextBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  infoText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
    textAlign: "center",
    marginTop: 24,
    paddingHorizontal: 20,
  },
  soundPickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  soundPickerSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 12,
    gap: 2,
  },
  soundPickerHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  soundPickerTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginBottom: 12,
  },
  soundRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  soundIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  soundLabel: { fontSize: 15, fontFamily: "Inter_500Medium" },
  soundDesc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
});
