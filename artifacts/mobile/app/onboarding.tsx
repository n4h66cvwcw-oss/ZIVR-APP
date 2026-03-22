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
import { useContactSync } from "@/hooks/useContactSync";

export default function OnboardingScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  const { updateProfile } = useProfile();
  const { updateContacts } = useMessaging();
  const { status, syncedCount, syncContacts } = useContactSync();

  const [name, setName] = useState("");
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
    if (result.length > 0) {
      await updateContacts(result);
    }
  }

  async function handlePickAvatar() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!res.canceled && res.assets[0]) {
      setAvatarUri(res.assets[0].uri);
    }
  }

  async function handleManualSync() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const result = await syncContacts();
    if (result.length > 0) {
      await updateContacts(result);
    }
  }

  async function handleContinue() {
    if (!name.trim()) return;
    setSaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await updateProfile({
      displayName: name.trim(),
      avatar: avatarUri,
      onboardingComplete: true,
    });
    router.replace("/(tabs)");
  }

  async function handleSkip() {
    Haptics.selectionAsync();
    const finalName = name.trim() || "Me";
    await updateProfile({
      displayName: finalName,
      avatar: avatarUri,
      onboardingComplete: true,
    });
    router.replace("/(tabs)");
  }

  const syncLabel = () => {
    switch (status) {
      case "requesting": return "Requesting permission…";
      case "syncing": return "Reading contacts…";
      case "done": return `${syncedCount} contact${syncedCount !== 1 ? "s" : ""} synced`;
      case "denied": return "Permission denied — tap to try again";
      case "error": return "Sync failed — tap to retry";
      default: return "Sync with phone contacts";
    }
  };

  const syncIcon = () => {
    if (status === "done") return "checkmark-circle";
    if (status === "denied" || status === "error") return "alert-circle";
    return "sync";
  };

  const syncColor = () => {
    if (status === "done") return "#34C759";
    if (status === "denied" || status === "error") return "#FF453A";
    return "#0A84FF";
  };

  const isSyncing = status === "requesting" || status === "syncing";

  return (
    <LinearGradient
      colors={isDark ? ["#0A0A1A", "#0D1B2A", "#0A0A1A"] : ["#F0F4FF", "#EAF1FF", "#F5F0FF"]}
      style={styles.gradient}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16 }]}>
          <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

            <View style={styles.logoRow}>
              <LinearGradient colors={["#0A84FF", "#5E5CE6"]} style={styles.logoCircle}>
                <Ionicons name="chatbubbles" size={32} color="#fff" />
              </LinearGradient>
              <Text style={[styles.appName, { color: colors.text }]}>VibeMsg</Text>
            </View>

            <Text style={[styles.headline, { color: colors.text }]}>Set up your profile</Text>
            <Text style={[styles.subline, { color: colors.textSecondary }]}>
              Tell people who you are
            </Text>

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
                placeholder="Your display name"
                placeholderTextColor={colors.textSecondary}
                style={[styles.nameInput, { color: colors.text }]}
                maxLength={40}
                returnKeyType="done"
                autoCapitalize="words"
              />
            </View>

            <Pressable
              onPress={handleManualSync}
              disabled={isSyncing}
              style={[
                styles.syncCard,
                {
                  backgroundColor: status === "done"
                    ? "#34C75915"
                    : status === "denied" || status === "error"
                    ? "#FF453A15"
                    : isDark ? "#1C1C1E" : "#F2F2F7",
                  borderColor: syncColor() + "40",
                },
              ]}
            >
              <View style={[styles.syncIconWrap, { backgroundColor: syncColor() + "20" }]}>
                {isSyncing ? (
                  <ActivityIndicator size="small" color={syncColor()} />
                ) : (
                  <Ionicons name={syncIcon()} size={20} color={syncColor()} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.syncTitle, { color: colors.text }]}>
                  {syncLabel()}
                </Text>
                {status === "idle" && (
                  <Text style={[styles.syncSub, { color: colors.textSecondary }]}>
                    Automatically finds who's on VibeMsg
                  </Text>
                )}
                {status === "done" && (
                  <Text style={[styles.syncSub, { color: "#34C759" }]}>
                    Tap to sync again
                  </Text>
                )}
              </View>
              {status === "idle" && (
                <View style={[styles.autoSyncBadge, { backgroundColor: "#0A84FF" }]}>
                  <Text style={styles.autoSyncText}>Auto</Text>
                </View>
              )}
            </Pressable>

            <Pressable
              onPress={handleContinue}
              disabled={!name.trim() || saving}
              style={[
                styles.continueBtn,
                { opacity: name.trim() ? 1 : 0.45 },
              ]}
            >
              <LinearGradient
                colors={["#0A84FF", "#5E5CE6"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.continueBtnGrad}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.continueBtnText}>Get Started</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                  </>
                )}
              </LinearGradient>
            </Pressable>

            <Pressable onPress={handleSkip} style={styles.skipBtn}>
              <Text style={[styles.skipText, { color: colors.textSecondary }]}>
                Skip for now
              </Text>
            </Pressable>

          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 24 },
  content: { flex: 1, justifyContent: "center", gap: 16 },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  logoCircle: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  appName: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  headline: { fontSize: 24, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  subline: { fontSize: 15, fontFamily: "Inter_400Regular", marginTop: -8 },
  avatarPicker: { alignSelf: "center", position: "relative", marginVertical: 8 },
  avatarImage: { width: 96, height: 96, borderRadius: 48 },
  avatarPlaceholder: {
    width: 96, height: 96, borderRadius: 48,
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
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  nameInput: { flex: 1, fontSize: 16, fontFamily: "Inter_400Regular" },
  syncCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    borderRadius: 14, padding: 14, borderWidth: 1,
  },
  syncIconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  syncTitle: { fontSize: 15, fontFamily: "Inter_500Medium" },
  syncSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  autoSyncBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  autoSyncText: { fontSize: 11, color: "#fff", fontFamily: "Inter_700Bold" },
  continueBtn: { marginTop: 8 },
  continueBtnGrad: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderRadius: 16, paddingVertical: 16,
  },
  continueBtnText: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: "#fff" },
  skipBtn: { alignItems: "center", paddingVertical: 8 },
  skipText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
