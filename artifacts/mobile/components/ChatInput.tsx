import { Feather, Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import React, { useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import Colors from "@/constants/colors";
import type { AudioAttachment, ImageAttachment } from "@/context/MessagingContext";
import { AudioClipEditor } from "@/components/AudioClipEditor";
import { SecurePictureModal } from "@/components/SecurePictureModal";

interface ChatInputProps {
  onSend: (text: string, audio?: AudioAttachment, image?: ImageAttachment) => void;
  placeholder?: string;
}

export function ChatInput({ onSend, placeholder = "Message..." }: ChatInputProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const [text, setText] = useState("");
  const [attachedAudio, setAttachedAudio] = useState<AudioAttachment | null>(null);
  const [pendingImageUri, setPendingImageUri] = useState<string | null>(null);
  const [pendingImageSize, setPendingImageSize] = useState<{ w?: number; h?: number }>({});
  const [showClipEditor, setShowClipEditor] = useState(false);
  const [showSecurePicture, setShowSecurePicture] = useState(false);
  const sendScale = useRef(new Animated.Value(1)).current;

  const handleSend = () => {
    if (!text.trim() && !attachedAudio) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.timing(sendScale, { toValue: 0.85, duration: 80, useNativeDriver: true }),
      Animated.spring(sendScale, { toValue: 1, useNativeDriver: true, tension: 200, friction: 8 }),
    ]).start();
    onSend(text.trim(), attachedAudio || undefined);
    setText("");
    setAttachedAudio(null);
  };

  const pickAudio = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["audio/*"],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        const audio: AudioAttachment = {
          uri: asset.uri,
          name: asset.name,
          duration: undefined,
        };
        setAttachedAudio(audio);
        setShowClipEditor(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) {
      console.log("Audio pick error:", e);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.85,
      });
      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        setPendingImageUri(asset.uri);
        setPendingImageSize({ w: asset.width, h: asset.height });
        setShowSecurePicture(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) {
      console.log("Image pick error:", e);
    }
  };

  const canSend = text.trim().length > 0 || !!attachedAudio;

  return (
    <View style={[styles.wrapper, { borderTopColor: colors.border }]}>
      {attachedAudio && !showClipEditor && (
        <View
          style={[
            styles.audioPreview,
            { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
          ]}
        >
          <View style={styles.audioPreviewLeft}>
            <View style={[styles.audioIconBg, { backgroundColor: colors.audioAccent + "22" }]}>
              <Ionicons name="musical-notes" size={16} color={colors.audioAccent} />
            </View>
            <View style={styles.audioPreviewInfo}>
              <Text style={[styles.audioPreviewName, { color: colors.text }]} numberOfLines={1}>
                {attachedAudio.name}
              </Text>
              {attachedAudio.startTime !== undefined && attachedAudio.endTime !== undefined ? (
                <Text style={[styles.audioPreviewLabel, { color: colors.audioAccent }]}>
                  Clip: {formatTime(attachedAudio.startTime)} – {formatTime(attachedAudio.endTime)}
                </Text>
              ) : (
                <Text style={[styles.audioPreviewLabel, { color: colors.audioAccent }]}>
                  Audio will play when message opens
                </Text>
              )}
            </View>
          </View>
          <View style={styles.audioPreviewActions}>
            <Pressable
              onPress={() => setShowClipEditor(true)}
              hitSlop={8}
              style={[styles.editClipBtn, { backgroundColor: colors.primary + "18" }]}
            >
              <Ionicons name="cut" size={14} color={colors.primary} />
              <Text style={[styles.editClipText, { color: colors.primary }]}>Edit</Text>
            </Pressable>
            <Pressable onPress={() => setAttachedAudio(null)} hitSlop={8}>
              <Feather name="x" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>
        </View>
      )}

      <View style={[styles.inputRow, { backgroundColor: colors.background }]}>
        <Pressable
          onPress={pickAudio}
          style={[
            styles.iconBtn,
            {
              backgroundColor: attachedAudio
                ? colors.audioAccent + "22"
                : colors.surfaceSecondary,
            },
          ]}
          hitSlop={8}
        >
          <Ionicons
            name="musical-notes"
            size={20}
            color={attachedAudio ? colors.audioAccent : colors.textSecondary}
          />
        </Pressable>

        <Pressable
          onPress={pickImage}
          style={[styles.iconBtn, { backgroundColor: colors.surfaceSecondary }]}
          hitSlop={8}
        >
          <Ionicons name="image" size={20} color={colors.textSecondary} />
        </Pressable>

        <View
          style={[
            styles.inputContainer,
            { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
          ]}
        >
          <TextInput
            style={[styles.input, { color: colors.text }]}
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            placeholderTextColor={colors.textTertiary}
            multiline
            maxLength={2000}
            onSubmitEditing={Platform.OS === "web" ? handleSend : undefined}
            blurOnSubmit={false}
          />
        </View>

        <Animated.View style={{ transform: [{ scale: sendScale }] }}>
          <Pressable
            onPress={handleSend}
            disabled={!canSend}
            style={[
              styles.sendBtn,
              { backgroundColor: canSend ? colors.primary : colors.surfaceSecondary },
            ]}
          >
            <Feather name="send" size={18} color={canSend ? "#FFFFFF" : colors.textTertiary} />
          </Pressable>
        </Animated.View>
      </View>

      {showClipEditor && attachedAudio && (
        <AudioClipEditor
          audio={attachedAudio}
          onSave={(updated) => {
            setAttachedAudio(updated);
            setShowClipEditor(false);
          }}
          onCancel={() => setShowClipEditor(false)}
        />
      )}

      {showSecurePicture && pendingImageUri && (
        <SecurePictureModal
          imageUri={pendingImageUri}
          imageWidth={pendingImageSize.w}
          imageHeight={pendingImageSize.h}
          onSend={(attachment) => {
            onSend("", undefined, attachment);
            setPendingImageUri(null);
            setShowSecurePicture(false);
          }}
          onCancel={() => {
            setPendingImageUri(null);
            setShowSecurePicture(false);
          }}
        />
      )}
    </View>
  );
}

function formatTime(secs: number) {
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  wrapper: { borderTopWidth: StyleSheet.hairlineWidth },
  audioPreview: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  audioPreviewLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
  },
  audioIconBg: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  audioPreviewInfo: { flex: 1 },
  audioPreviewName: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  audioPreviewLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  audioPreviewActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  editClipBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  editClipText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  inputContainer: {
    flex: 1,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  input: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
    minHeight: 22,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
});
