import { Feather, Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  FlatList,
  Image,
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
import {
  AI_GRADIENTS,
  useProfile,
  type CaptureGuardType,
} from "@/context/ProfileContext";

const GUARD_TYPES: { type: CaptureGuardType; icon: string; label: string }[] = [
  { type: "ai_gradient", icon: "color-palette",    label: "AI Background" },
  { type: "custom_image", icon: "image",            label: "Image / GIF" },
  { type: "custom_text",  icon: "text",             label: "Custom Text" },
  { type: "custom_sound", icon: "musical-notes",    label: "Sound" },
];

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const { profile, updateProfile } = useProfile();
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [status, setStatus] = useState(profile.statusMessage);
  const [customText, setCustomText] = useState(profile.captureGuardText);
  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  const selectedGradient =
    AI_GRADIENTS.find((g) => g.id === profile.captureGuardGradientId) ?? AI_GRADIENTS[0];

  const handleSaveProfile = () => {
    updateProfile({ displayName, statusMessage: status });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "livePhotos"],
      allowsEditing: false,
    });
    if (!result.canceled && result.assets.length > 0) {
      await updateProfile({
        captureGuardType: "custom_image",
        captureGuardImageUri: result.assets[0].uri,
      });
    }
  };

  const handlePickSound = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["audio/*"],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets.length > 0) {
      await updateProfile({
        captureGuardType: "custom_sound",
        captureGuardSoundUri: result.assets[0].uri,
      });
    }
  };

  const renderGradientPreview = () => {
    if (profile.captureGuardType === "custom_image" && profile.captureGuardImageUri) {
      return (
        <Image
          source={{ uri: profile.captureGuardImageUri }}
          style={styles.guardPreview}
          resizeMode="cover"
        />
      );
    }
    return (
      <LinearGradient
        colors={selectedGradient.colors as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.guardPreview}
      >
        {profile.captureGuardType === "custom_text" && (
          <Text style={styles.guardPreviewText}>
            {profile.captureGuardText || "🔒"}
          </Text>
        )}
        {profile.captureGuardType === "ai_gradient" && (
          <>
            <Text style={styles.guardPreviewEmoji}>🔒</Text>
            <Text style={styles.guardPreviewName}>{selectedGradient.name}</Text>
          </>
        )}
        {profile.captureGuardType === "custom_sound" && (
          <Ionicons name="musical-notes" size={40} color="rgba(255,255,255,0.8)" />
        )}
      </LinearGradient>
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
        <Pressable onPress={handleSaveProfile}>
          <Text style={[styles.saveText, { color: colors.primary }]}>Save</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>
            MY PROFILE
          </Text>
          <View style={[styles.field, { borderBottomColor: colors.border }]}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Name</Text>
            <TextInput
              style={[styles.fieldInput, { color: colors.text }]}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Display name"
              placeholderTextColor={colors.textTertiary}
            />
          </View>
          <View style={[styles.field, { borderBottomColor: "transparent" }]}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Status</Text>
            <TextInput
              style={[styles.fieldInput, { color: colors.text }]}
              value={status}
              onChangeText={setStatus}
              placeholder="Status message"
              placeholderTextColor={colors.textTertiary}
            />
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>
              SCREEN CAPTURE SHIELD
            </Text>
            <Switch
              value={profile.captureGuardEnabled}
              onValueChange={(v) => updateProfile({ captureGuardEnabled: v })}
              trackColor={{ true: colors.primary }}
            />
          </View>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
            Customise what appears when someone tries to screenshot or record your screen.
          </Text>

          {renderGradientPreview()}

          <Text style={[styles.fieldLabel, { color: colors.textTertiary, marginBottom: 8 }]}>
            STYLE
          </Text>
          <View style={styles.guardTypeRow}>
            {GUARD_TYPES.map((g) => {
              const active = profile.captureGuardType === g.type;
              return (
                <Pressable
                  key={g.type}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    if (g.type === "custom_image") {
                      handlePickImage();
                    } else if (g.type === "custom_sound") {
                      handlePickSound();
                    } else {
                      updateProfile({ captureGuardType: g.type });
                    }
                  }}
                  style={[
                    styles.guardTypeBtn,
                    {
                      backgroundColor: active ? colors.primary + "18" : colors.surfaceSecondary,
                      borderColor: active ? colors.primary : "transparent",
                      borderWidth: active ? 1.5 : 0,
                    },
                  ]}
                >
                  <Ionicons
                    name={g.icon as any}
                    size={18}
                    color={active ? colors.primary : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.guardTypeText,
                      { color: active ? colors.primary : colors.textSecondary },
                    ]}
                  >
                    {g.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {profile.captureGuardType === "custom_text" && (
            <View
              style={[
                styles.textGuardInput,
                { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
              ]}
            >
              <TextInput
                style={[styles.fieldInput, { color: colors.text, flex: 1 }]}
                value={customText}
                onChangeText={setCustomText}
                onBlur={() => updateProfile({ captureGuardText: customText })}
                placeholder="Enter text or emoji..."
                placeholderTextColor={colors.textTertiary}
                multiline
              />
            </View>
          )}

          {profile.captureGuardType === "custom_sound" && profile.captureGuardSoundUri && (
            <View style={[styles.soundPill, { backgroundColor: colors.surfaceSecondary }]}>
              <Ionicons name="musical-notes" size={16} color={colors.audioAccent} />
              <Text style={[styles.soundPillText, { color: colors.text }]} numberOfLines={1}>
                Custom sound loaded
              </Text>
              <Pressable onPress={handlePickSound}>
                <Text style={[styles.changeText, { color: colors.primary }]}>Change</Text>
              </Pressable>
            </View>
          )}
        </View>

        {profile.captureGuardType === "ai_gradient" && (
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>
              AI GENERATED BACKGROUNDS
            </Text>
            <FlatList
              data={AI_GRADIENTS}
              keyExtractor={(item) => String(item.id)}
              numColumns={3}
              scrollEnabled={false}
              columnWrapperStyle={{ gap: 8 }}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              renderItem={({ item }) => {
                const active = profile.captureGuardGradientId === item.id;
                return (
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      updateProfile({ captureGuardGradientId: item.id });
                    }}
                    style={[
                      styles.gradientThumb,
                      active && { borderColor: colors.primary, borderWidth: 3 },
                    ]}
                  >
                    <LinearGradient
                      colors={item.colors as [string, string, ...string[]]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={styles.gradientThumbLabel}>
                      <Text style={styles.gradientThumbText} numberOfLines={1}>
                        {item.name}
                      </Text>
                    </View>
                    {active && (
                      <View style={styles.gradientCheckmark}>
                        <Ionicons name="checkmark-circle" size={22} color="#FFF" />
                      </View>
                    )}
                  </Pressable>
                );
              }}
            />
          </View>
        )}
      </ScrollView>
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
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { flexDirection: "row", alignItems: "center" },
  backText: { fontSize: 16, fontFamily: "Inter_400Regular" },
  headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  saveText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  section: {
    marginTop: 20,
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  sectionSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
    marginTop: -4,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    gap: 12,
  },
  fieldLabel: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    width: 56,
  },
  fieldInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  guardPreview: {
    width: "100%",
    height: 140,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  guardPreviewText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    paddingHorizontal: 16,
  },
  guardPreviewEmoji: {
    fontSize: 36,
    color: "rgba(255,255,255,0.9)",
  },
  guardPreviewName: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginTop: 8,
  },
  guardTypeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  guardTypeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
  },
  guardTypeText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  textGuardInput: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 70,
  },
  soundPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
  },
  soundPillText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  changeText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  gradientThumb: {
    flex: 1,
    height: 90,
    borderRadius: 12,
    overflow: "hidden",
    justifyContent: "flex-end",
    borderWidth: 0,
  },
  gradientThumbLabel: {
    backgroundColor: "rgba(0,0,0,0.3)",
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  gradientThumbText: {
    color: "#FFF",
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  gradientCheckmark: {
    position: "absolute",
    top: 6,
    right: 6,
  },
});
