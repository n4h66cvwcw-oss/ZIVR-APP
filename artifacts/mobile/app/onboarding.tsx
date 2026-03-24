import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  KeyboardAvoidingView,
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
import { useProfile } from "@/context/ProfileContext";
import { useMessaging } from "@/context/MessagingContext";
import { useServer } from "@/context/ServerContext";
import { useContactSync } from "@/hooks/useContactSync";
import { ContactCardWidget } from "@/components/ContactCardWidget";

export default function OnboardingScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  const { updateProfile } = useProfile();
  const { updateContacts } = useMessaging();
  const { registerOnServer } = useServer();
  const { status, syncedCount, syncContacts } = useContactSync();

  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [avatarUri, setAvatarUri] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
    autoSync();
  }, []);

  async function autoSync() {
    const result = await syncContacts();
    if (result.length > 0) await updateContacts(result);
  }

  async function handlePickAvatar() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!res.canceled && res.assets[0]) setAvatarUri(res.assets[0].uri);
  }

  async function handleManualSync() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const result = await syncContacts();
    if (result.length > 0) await updateContacts(result);
  }

  function goToStep2() {
    if (!name.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStep(2);
  }

  async function handleFinish() {
    setSaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const displayName = name.trim();
    await updateProfile({
      displayName,
      phone: phone.trim() || undefined,
      username: username.trim() || undefined,
      avatar: avatarUri,
      onboardingComplete: true,
    });
    registerOnServer({
      displayName,
      username: username.trim() || undefined,
      phone: phone.trim() || undefined,
      statusMessage: "Hey there! I'm on ZIVR",
    }).catch(() => {});
    router.replace("/(tabs)");
  }

  async function handleSkip() {
    Haptics.selectionAsync();
    const displayName = name.trim() || "Me";
    await updateProfile({
      displayName,
      phone: phone.trim() || undefined,
      username: username.trim() || undefined,
      avatar: avatarUri,
      onboardingComplete: true,
    });
    registerOnServer({
      displayName,
      username: username.trim() || undefined,
      phone: phone.trim() || undefined,
    }).catch(() => {});
    router.replace("/(tabs)");
  }

  const isSyncing = status === "requesting" || status === "syncing";
  const syncColor = status === "done" ? "#34C759" : status === "denied" || status === "error" ? "#FF453A" : "#0A84FF";

  return (
    <LinearGradient
      colors={isDark ? ["#0A0A1A", "#0D1B2A", "#0A0A1A"] : ["#F0F4FF", "#EAF1FF", "#F5F0FF"]}
      style={styles.gradient}
    >
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

            <View style={styles.logoRow}>
              <LinearGradient colors={["#0A84FF", "#5E5CE6"]} style={styles.logoCircle}>
                <Ionicons name="chatbubbles" size={32} color="#fff" />
              </LinearGradient>
              <Text style={[styles.appName, { color: colors.text }]}>ZIVR</Text>
            </View>

            <View style={styles.stepIndicator}>
              <View style={[styles.stepDot, step >= 1 && styles.stepDotActive]} />
              <View style={[styles.stepLine, step >= 2 && styles.stepLineActive]} />
              <View style={[styles.stepDot, step >= 2 && styles.stepDotActive]} />
            </View>

            {step === 1 ? (
              <>
                <Text style={[styles.headline, { color: colors.text }]}>Set up your profile</Text>
                <Text style={[styles.subline, { color: colors.textSecondary }]}>Tell people who you are</Text>

                <Pressable onPress={handlePickAvatar} style={styles.avatarPicker}>
                  {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                  ) : (
                    <LinearGradient colors={["#0A84FF30", "#5E5CE630"]} style={styles.avatarPlaceholder}>
                      <Ionicons name="camera" size={28} color="#0A84FF" />
                      <Text style={styles.avatarLabel}>Add photo</Text>
                    </LinearGradient>
                  )}
                  <View style={[styles.avatarEditBadge, { backgroundColor: "#0A84FF" }]}>
                    <Ionicons name="camera" size={12} color="#fff" />
                  </View>
                </Pressable>

                <View style={[styles.inputCard, { backgroundColor: colors.surface }]}>
                  <Ionicons name="person-outline" size={20} color={colors.textSecondary} style={{ marginRight: 10 }} />
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Display name *"
                    placeholderTextColor={colors.textSecondary}
                    style={[styles.inputField, { color: colors.text }]}
                    maxLength={40}
                    returnKeyType="next"
                    autoCapitalize="words"
                  />
                </View>

                <View style={[styles.inputCard, { backgroundColor: colors.surface }]}>
                  <Ionicons name="call-outline" size={20} color={colors.textSecondary} style={{ marginRight: 10 }} />
                  <TextInput
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="Phone number (optional)"
                    placeholderTextColor={colors.textSecondary}
                    style={[styles.inputField, { color: colors.text }]}
                    keyboardType="phone-pad"
                    returnKeyType="next"
                    maxLength={20}
                  />
                </View>

                <View style={[styles.inputCard, { backgroundColor: colors.surface }]}>
                  <Text style={{ fontSize: 16, color: colors.textSecondary, marginRight: 6 }}>@</Text>
                  <TextInput
                    value={username}
                    onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9_.]/g, ""))}
                    placeholder="username (optional)"
                    placeholderTextColor={colors.textSecondary}
                    style={[styles.inputField, { color: colors.text }]}
                    autoCapitalize="none"
                    returnKeyType="done"
                    maxLength={30}
                  />
                </View>

                <Pressable
                  onPress={handleManualSync}
                  disabled={isSyncing}
                  style={[
                    styles.syncCard,
                    {
                      backgroundColor: status === "done" ? "#34C75915" : status === "denied" || status === "error" ? "#FF453A15" : isDark ? "#1C1C1E" : "#F2F2F7",
                      borderColor: syncColor + "40",
                    },
                  ]}
                >
                  <View style={[styles.syncIconWrap, { backgroundColor: syncColor + "20" }]}>
                    {isSyncing ? <ActivityIndicator size="small" color={syncColor} /> : (
                      <Ionicons name={status === "done" ? "checkmark-circle" : status === "denied" || status === "error" ? "alert-circle" : "sync"} size={20} color={syncColor} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.syncTitle, { color: colors.text }]}>
                      {status === "requesting" ? "Requesting permission…" : status === "syncing" ? "Reading contacts…" : status === "done" ? `${syncedCount} contacts synced` : status === "denied" ? "Permission denied — tap to retry" : status === "error" ? "Sync failed — tap to retry" : "Sync with phone contacts"}
                    </Text>
                    {status === "idle" && <Text style={[styles.syncSub, { color: colors.textSecondary }]}>Automatically finds who's on ZIVR</Text>}
                    {status === "done" && <Text style={[styles.syncSub, { color: "#34C759" }]}>Tap to sync again</Text>}
                  </View>
                  {status === "idle" && (
                    <View style={[styles.autoSyncBadge, { backgroundColor: "#0A84FF" }]}>
                      <Text style={styles.autoSyncText}>Auto</Text>
                    </View>
                  )}
                </Pressable>

                <Pressable
                  onPress={goToStep2}
                  disabled={!name.trim()}
                  style={[styles.continueBtn, { opacity: name.trim() ? 1 : 0.45 }]}
                >
                  <LinearGradient colors={["#0A84FF", "#5E5CE6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.continueBtnGrad}>
                    <Text style={styles.continueBtnText}>Next</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                  </LinearGradient>
                </Pressable>

                <Pressable onPress={handleSkip} style={styles.skipBtn}>
                  <Text style={[styles.skipText, { color: colors.textSecondary }]}>Skip for now</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={[styles.headline, { color: colors.text }]}>Your Contact Card</Text>
                <Text style={[styles.subline, { color: colors.textSecondary }]}>
                  Put your phones together to share — or let them scan your QR code
                </Text>

                <ContactCardWidget
                  data={{
                    name: name.trim(),
                    phone: phone.trim() || undefined,
                    username: username.trim() || undefined,
                    avatarUri,
                    statusMessage: "Hey there! I'm on ZIVR",
                  }}
                />

                <Pressable
                  onPress={handleFinish}
                  disabled={saving}
                  style={styles.continueBtn}
                >
                  <LinearGradient colors={["#0A84FF", "#5E5CE6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.continueBtnGrad}>
                    {saving ? <ActivityIndicator color="#fff" /> : (
                      <>
                        <Text style={styles.continueBtnText}>Enter ZIVR</Text>
                        <Ionicons name="arrow-forward" size={18} color="#fff" />
                      </>
                    )}
                  </LinearGradient>
                </Pressable>

                <Pressable onPress={() => setStep(1)} style={styles.skipBtn}>
                  <Text style={[styles.skipText, { color: colors.textSecondary }]}>← Back</Text>
                </Pressable>
              </>
            )}

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24 },
  content: { gap: 14 },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 },
  logoCircle: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  appName: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  stepIndicator: { flexDirection: "row", alignItems: "center", gap: 0, alignSelf: "flex-start", marginBottom: 4 },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#C7C7CC" },
  stepDotActive: { backgroundColor: "#0A84FF" },
  stepLine: { width: 24, height: 2, backgroundColor: "#C7C7CC" },
  stepLineActive: { backgroundColor: "#0A84FF" },
  headline: { fontSize: 24, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  subline: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20, marginTop: -4 },
  avatarPicker: { alignSelf: "center", position: "relative", marginVertical: 4 },
  avatarImage: { width: 88, height: 88, borderRadius: 44 },
  avatarPlaceholder: {
    width: 88, height: 88, borderRadius: 44,
    alignItems: "center", justifyContent: "center", gap: 4,
    borderWidth: 2, borderColor: "#0A84FF40", borderStyle: "dashed",
  },
  avatarLabel: { fontSize: 11, color: "#0A84FF", fontFamily: "Inter_500Medium" },
  avatarEditBadge: {
    position: "absolute", bottom: 0, right: 0,
    width: 26, height: 26, borderRadius: 13,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#fff",
  },
  inputCard: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  inputField: { flex: 1, fontSize: 16, fontFamily: "Inter_400Regular" },
  syncCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    borderRadius: 14, padding: 14, borderWidth: 1,
  },
  syncIconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  syncTitle: { fontSize: 15, fontFamily: "Inter_500Medium" },
  syncSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  autoSyncBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  autoSyncText: { fontSize: 11, color: "#fff", fontFamily: "Inter_700Bold" },
  continueBtn: { marginTop: 4 },
  continueBtnGrad: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderRadius: 16, paddingVertical: 16,
  },
  continueBtnText: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: "#fff" },
  skipBtn: { alignItems: "center", paddingVertical: 8 },
  skipText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
