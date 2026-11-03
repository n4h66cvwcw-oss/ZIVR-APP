import { Feather, Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import React, { useRef, useState } from "react";
import {
  Animated,
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
import type {
  AudioAttachment,
  ImageAttachment,
  MessageFormatting,
  MusicAttachment,
} from "@/context/MessagingContext";
import { AudioClipEditor } from "@/components/AudioClipEditor";
import { GifPickerModal } from "@/components/GifPickerModal";
import { SecurePictureModal } from "@/components/SecurePictureModal";
import { MusicalMessageModal } from "@/components/MusicalMessageModal";
import { SelfDestructPicker } from "@/components/SelfDestructPicker";
import type { SelfDestructConfig } from "@/context/MessagingContext";

interface ChatInputProps {
  onSend: (
    text: string,
    audio?: AudioAttachment,
    image?: ImageAttachment,
    formatting?: MessageFormatting,
    music?: MusicAttachment,
    selfDestruct?: SelfDestructConfig
  ) => void;
  placeholder?: string;
  onTextChange?: (text: string) => void;
  /** When set, populates the text field with this value (e.g. AI suggestion) */
  suggestedText?: string;
  onSuggestedTextConsumed?: () => void;
}

type FontSize = "sm" | "md" | "lg" | "xl";

const FONT_SIZES: FontSize[] = ["sm", "md", "lg", "xl"];
const FONT_SIZE_LABELS: Record<FontSize, string> = { sm: "A", md: "A", lg: "A", xl: "A" };
const FONT_SIZE_VALUES: Record<FontSize, number> = { sm: 10, md: 13, lg: 17, xl: 22 };
const INPUT_LINE_HEIGHT = 22;
const INPUT_MIN_HEIGHT = INPUT_LINE_HEIGHT;
const COMPOSER_MAX_LINES = 5;

const TEXT_COLORS = [
  "#FFFFFF",
  "#000000",
  "#FF3B30",
  "#FF9F0A",
  "#FFD60A",
  "#32D74B",
  "#0A84FF",
  "#BF5AF2",
  "#FF375F",
  "#64D2FF",
];

export function ChatInput({ onSend, placeholder = "Message...", onTextChange, suggestedText, onSuggestedTextConsumed }: ChatInputProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;

  const [text, setText] = useState("");
  const [inputHeight, setInputHeight] = useState(INPUT_MIN_HEIGHT);
  const textLenRef = useRef(0);

  // Populate input when a suggestion is injected from the parent
  React.useEffect(() => {
    if (suggestedText) {
      textLenRef.current = suggestedText.length;
      setText(suggestedText);
      onTextChange?.(suggestedText);
      onSuggestedTextConsumed?.();
    }
  }, [suggestedText]);
  const [attachedAudio, setAttachedAudio] = useState<AudioAttachment | null>(null);
  const [attachedMusic, setAttachedMusic] = useState<MusicAttachment | null>(null);
  const [pendingImageUri, setPendingImageUri] = useState<string | null>(null);
  const [pendingImageBase64, setPendingImageBase64] = useState<string | null>(null);
  const [pendingImageMime, setPendingImageMime] = useState<string>("image/jpeg");
  const [pendingImageSize, setPendingImageSize] = useState<{ w?: number; h?: number }>({});
  const [showClipEditor, setShowClipEditor] = useState(false);
  const [showSecurePicture, setShowSecurePicture] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showFormatBar, setShowFormatBar] = useState(false);
  const [showMusicModal, setShowMusicModal] = useState(false);
  const [showSelfDestructPicker, setShowSelfDestructPicker] = useState(false);
  const [selfDestructConfig, setSelfDestructConfig] = useState<SelfDestructConfig | null>(null);

  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);
  const [underline, setUnderline] = useState(false);
  const [fontSize, setFontSize] = useState<FontSize>("md");
  const [textColor, setTextColor] = useState<string>("");
  const [backgroundGifUrl, setBackgroundGifUrl] = useState<string>("");

  // Composer grow. On RN 0.81 Fabric iOS, TextInput.onContentSizeChange fires
  // once at mount and then stops while height is fixed, and the reported
  // contentSize stays capped at that height (facebook/react-native#52854,
  // #54570, #53625). TF build 29 ASC AHrW0N4I20KFwkP7MjR9J74 stayed one line.
  // A hidden Text mirror's onLayout is the driver. minHeight / maxHeight only
  // constrain the field (~5 lines, then it scrolls). No fixed height.
  const lineHeight =
    fontSize === "md" ? INPUT_LINE_HEIGHT : Math.ceil(FONT_SIZE_VALUES[fontSize] * 1.4);
  const minInputHeight = Math.max(INPUT_MIN_HEIGHT, lineHeight);
  const maxInputHeight = lineHeight * COMPOSER_MAX_LINES;
  const mirrorHeightRef = useRef(0);
  const applyMeasuredHeight = (measured: number, source: "mirror" | "content") => {
    // contentSize is secondary. Once the mirror has laid out, ignore it so a
    // capped iOS contentSize cannot shrink the field back to one line.
    if (source === "content" && mirrorHeightRef.current > 0) return;
    if (textLenRef.current === 0) {
      mirrorHeightRef.current = 0;
      setInputHeight((prev) => (prev === minInputHeight ? prev : minInputHeight));
      return;
    }
    const rounded = Math.ceil(measured);
    if (!Number.isFinite(rounded) || rounded <= 0) return;
    if (source === "mirror") mirrorHeightRef.current = rounded;
    const next = Math.min(Math.max(rounded, minInputHeight), maxInputHeight);
    setInputHeight((prev) => (Math.abs(prev - next) < 2 ? prev : next));
  };
  const effectiveInputHeight = Math.min(Math.max(inputHeight, minInputHeight), maxInputHeight);
  const textTypography = [
    bold && { fontFamily: "Inter_700Bold" },
    italic && { fontStyle: "italic" as const },
    underline && { textDecorationLine: "underline" as const },
    fontSize !== "md" && { fontSize: FONT_SIZE_VALUES[fontSize], lineHeight },
  ];

  const sendScale = useRef(new Animated.Value(1)).current;

  const hasFormatting = bold || italic || underline || fontSize !== "md" || !!textColor || !!backgroundGifUrl;

  const buildFormatting = (): MessageFormatting | undefined => {
    if (!hasFormatting) return undefined;
    return {
      bold: bold || undefined,
      italic: italic || undefined,
      underline: underline || undefined,
      fontSize: fontSize !== "md" ? fontSize : undefined,
      textColor: textColor || undefined,
      backgroundGifUrl: backgroundGifUrl || undefined,
    };
  };

  const handleSend = () => {
    if (!text.trim() && !attachedAudio && !attachedMusic) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.timing(sendScale, { toValue: 0.85, duration: 80, useNativeDriver: true }),
      Animated.spring(sendScale, { toValue: 1, useNativeDriver: true, tension: 200, friction: 8 }),
    ]).start();
    onSend(text.trim(), attachedAudio || undefined, undefined, buildFormatting(), attachedMusic || undefined, selfDestructConfig || undefined);
    textLenRef.current = 0;
    setText("");
    setInputHeight(INPUT_MIN_HEIGHT);
    setAttachedAudio(null);
    setAttachedMusic(null);
    setSelfDestructConfig(null);
  };

  const pickAudio = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["audio/*"],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        setAttachedAudio({ uri: asset.uri, name: asset.name, duration: undefined });
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
        // Quality under 1 transcodes to JPEG and keeps most photos under the
        // 2 MiB decoded cap stored in vm_messages.media.
        quality: 0.4,
        base64: true,
        exif: false,
      });
      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        setPendingImageUri(asset.uri);
        setPendingImageBase64(asset.base64 ?? null);
        setPendingImageMime(asset.mimeType ?? "image/jpeg");
        setPendingImageSize({ w: asset.width, h: asset.height });
        setShowSecurePicture(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) {
      console.log("Image pick error:", e);
    }
  };

  const cycleFontSize = () => {
    Haptics.selectionAsync();
    const idx = FONT_SIZES.indexOf(fontSize);
    setFontSize(FONT_SIZES[(idx + 1) % FONT_SIZES.length]);
  };

  const toggleFormat = (type: "bold" | "italic" | "underline") => {
    Haptics.selectionAsync();
    if (type === "bold") setBold((v) => !v);
    else if (type === "italic") setItalic((v) => !v);
    else setUnderline((v) => !v);
  };

  const canSend = text.trim().length > 0 || !!attachedAudio || !!attachedMusic;

  return (
    <View style={[styles.wrapper, { borderTopColor: colors.border }]}>
      {attachedMusic && (
        <View style={[styles.audioPreview, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <View style={styles.audioPreviewLeft}>
            <View style={[styles.audioIconBg, { backgroundColor: "#BF5AF222" }]}>
              <Text style={{ fontSize: 16 }}>{attachedMusic.emoji}</Text>
            </View>
            <View style={styles.audioPreviewInfo}>
              <Text style={[styles.audioPreviewName, { color: colors.text }]} numberOfLines={1}>
                {attachedMusic.title}
              </Text>
              <Text style={[styles.audioPreviewLabel, { color: "#BF5AF2" }]}>
                {attachedMusic.artist} · {attachedMusic.genre}
              </Text>
            </View>
          </View>
          <Pressable onPress={() => setAttachedMusic(null)} hitSlop={8}>
            <Feather name="x" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>
      )}
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
                  Clip: {fmt(attachedAudio.startTime)} – {fmt(attachedAudio.endTime)}
                </Text>
              ) : (
                <Text style={[styles.audioPreviewLabel, { color: colors.audioAccent }]}>
                  Audio attached
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
              <Text style={[styles.editClipText, { color: colors.primary }]}>Trim</Text>
            </Pressable>
            <Pressable onPress={() => setAttachedAudio(null)} hitSlop={8}>
              <Feather name="x" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>
        </View>
      )}

      {showFormatBar && (
        <View
          style={[
            styles.formatBar,
            { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
          ]}
        >
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.formatBarContent}>
            <FormatBtn
              label="B"
              active={bold}
              style={{ fontWeight: "700" }}
              onPress={() => toggleFormat("bold")}
              colors={colors}
            />
            <FormatBtn
              label="I"
              active={italic}
              style={{ fontStyle: "italic" }}
              onPress={() => toggleFormat("italic")}
              colors={colors}
            />
            <FormatBtn
              label="U"
              active={underline}
              style={{ textDecorationLine: "underline" }}
              onPress={() => toggleFormat("underline")}
              colors={colors}
            />

            <View style={[styles.formatDivider, { backgroundColor: colors.border }]} />

            {FONT_SIZES.map((sz) => (
              <Pressable
                key={sz}
                onPress={() => { setFontSize(sz); Haptics.selectionAsync(); }}
                style={[
                  styles.fontSizeBtn,
                  {
                    backgroundColor: fontSize === sz ? colors.primary : "transparent",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.fontSizeBtnText,
                    {
                      fontSize: FONT_SIZE_VALUES[sz],
                      color: fontSize === sz ? "#FFF" : colors.text,
                    },
                  ]}
                >
                  A
                </Text>
              </Pressable>
            ))}

            <View style={[styles.formatDivider, { backgroundColor: colors.border }]} />

            {TEXT_COLORS.map((c) => (
              <Pressable
                key={c}
                onPress={() => {
                  setTextColor(textColor === c ? "" : c);
                  Haptics.selectionAsync();
                }}
                style={[
                  styles.colorSwatch,
                  { backgroundColor: c, borderColor: colors.border },
                  textColor === c && { borderColor: colors.primary, borderWidth: 2.5 },
                  c === "#FFFFFF" && { borderColor: colors.border },
                ]}
              />
            ))}

            <View style={[styles.formatDivider, { backgroundColor: colors.border }]} />

            <Pressable
              onPress={() => setShowGifPicker(true)}
              style={[
                styles.gifBtn,
                {
                  backgroundColor: backgroundGifUrl
                    ? colors.primary + "22"
                    : colors.surfaceSecondary,
                  borderColor: backgroundGifUrl ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.gifBtnLabel,
                  { color: backgroundGifUrl ? colors.primary : colors.textSecondary },
                ]}
              >
                GIF BG
              </Text>
              {backgroundGifUrl && (
                <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
              )}
            </Pressable>

            {hasFormatting && (
              <Pressable
                onPress={() => {
                  setBold(false);
                  setItalic(false);
                  setUnderline(false);
                  setFontSize("md");
                  setTextColor("");
                  setBackgroundGifUrl("");
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                }}
                style={[styles.clearBtn, { borderColor: colors.border }]}
                hitSlop={6}
              >
                <Ionicons name="close-circle" size={14} color={colors.textSecondary} />
                <Text style={[styles.clearBtnText, { color: colors.textSecondary }]}>Clear</Text>
              </Pressable>
            )}
          </ScrollView>
        </View>
      )}

      <View style={[styles.actionRow, { backgroundColor: colors.background }]}>
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
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowMusicModal(true);
          }}
          style={[
            styles.iconBtn,
            {
              backgroundColor: attachedMusic
                ? "#BF5AF222"
                : colors.surfaceSecondary,
            },
          ]}
          hitSlop={8}
        >
          <Ionicons
            name="disc"
            size={20}
            color={attachedMusic ? "#BF5AF2" : colors.textSecondary}
          />
        </Pressable>

        <Pressable
          onPress={pickImage}
          style={[styles.iconBtn, { backgroundColor: colors.surfaceSecondary }]}
          hitSlop={8}
        >
          <Ionicons name="image" size={20} color={colors.textSecondary} />
        </Pressable>

        <Pressable
          onPress={() => setShowFormatBar((v) => !v)}
          style={[
            styles.iconBtn,
            {
              backgroundColor: showFormatBar || hasFormatting
                ? colors.secondary + "22"
                : colors.surfaceSecondary,
            },
          ]}
          hitSlop={8}
        >
          <Ionicons
            name="text"
            size={18}
            color={showFormatBar || hasFormatting ? colors.secondary : colors.textSecondary}
          />
          {hasFormatting && <View style={[styles.formatDot, { backgroundColor: colors.secondary }]} />}
        </Pressable>

        <Pressable
          onPress={() => setShowSelfDestructPicker(true)}
          style={[
            styles.iconBtn,
            { backgroundColor: selfDestructConfig ? "#FF3B3022" : colors.surfaceSecondary },
          ]}
          hitSlop={8}
        >
          <Text style={{ fontSize: 18 }}>{selfDestructConfig ? "💣" : "💣"}</Text>
          {selfDestructConfig && (
            <View style={[styles.formatDot, { backgroundColor: "#FF3B30" }]} />
          )}
        </Pressable>
      </View>

      <View style={[styles.inputRow, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.inputContainer,
            { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
          ]}
        >
          <View
            pointerEvents="none"
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            collapsable={false}
            style={styles.inputMirror}
            onLayout={(event) => applyMeasuredHeight(event.nativeEvent.layout.height, "mirror")}
          >
            <Text selectable={false} style={[styles.inputText, textTypography]}>
              {/* A trailing newline needs a glyph after it or the line has no height. */}
              {text.endsWith("\n") ? `${text}\u200B` : text || " "}
            </Text>
          </View>
          <TextInput
            style={[
              styles.inputText,
              styles.input,
              textTypography,
              {
                color: textColor || colors.text,
                minHeight: effectiveInputHeight,
                maxHeight: maxInputHeight,
              },
            ]}
            value={text}
            onChangeText={(t) => {
              textLenRef.current = t.length;
              setText(t);
              onTextChange?.(t);
              if (t.length === 0) setInputHeight(minInputHeight);
            }}
            onContentSizeChange={(event) => {
              applyMeasuredHeight(event.nativeEvent.contentSize.height, "content");
            }}
            placeholder={placeholder}
            placeholderTextColor={colors.textTertiary}
            multiline
            scrollEnabled={effectiveInputHeight >= maxInputHeight}
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
            const caption = text.trim();
            onSend(caption, undefined, {
              ...attachment,
              ...(pendingImageBase64 ? { base64: pendingImageBase64, mimeType: pendingImageMime } : {}),
            }, buildFormatting());
            textLenRef.current = 0;
            setText("");
            setInputHeight(INPUT_MIN_HEIGHT);
            onTextChange?.("");
            setPendingImageUri(null);
            setPendingImageBase64(null);
            setShowSecurePicture(false);
          }}
          onCancel={() => {
            setPendingImageUri(null);
            setPendingImageBase64(null);
            setShowSecurePicture(false);
          }}
        />
      )}

      <GifPickerModal
        visible={showGifPicker}
        currentUrl={backgroundGifUrl}
        onSelect={(url) => setBackgroundGifUrl(url)}
        onRemove={() => setBackgroundGifUrl("")}
        onClose={() => setShowGifPicker(false)}
      />

      <MusicalMessageModal
        visible={showMusicModal}
        onClose={() => setShowMusicModal(false)}
        onSelect={(track) => setAttachedMusic(track)}
      />

      <SelfDestructPicker
        visible={showSelfDestructPicker}
        onClose={() => setShowSelfDestructPicker(false)}
        onConfirm={(config) => setSelfDestructConfig(config)}
      />
    </View>
  );
}

function FormatBtn({
  label,
  active,
  style,
  onPress,
  colors,
}: {
  label: string;
  active: boolean;
  style?: object;
  onPress: () => void;
  colors: typeof Colors.light;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.formatBtnBase,
        { backgroundColor: active ? colors.primary : "transparent" },
      ]}
    >
      <Text
        style={[
          styles.formatBtnText,
          style,
          { color: active ? "#FFF" : colors.text },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function fmt(secs: number) {
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
  formatBar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
  },
  formatBarContent: {
    paddingHorizontal: 12,
    alignItems: "center",
    gap: 6,
  },
  formatBtnBase: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  formatBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  formatDivider: {
    width: StyleSheet.hairlineWidth,
    height: 24,
    marginHorizontal: 2,
  },
  fontSizeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  fontSizeBtnText: {
    fontFamily: "Inter_600SemiBold",
    lineHeight: 28,
  },
  colorSwatch: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  gifBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  gifBtnLabel: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  clearBtnText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 10,
    gap: 8,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  formatDot: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  inputContainer: {
    flex: 1,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 8,
    justifyContent: "center",
  },
  inputText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    lineHeight: INPUT_LINE_HEIGHT,
    paddingHorizontal: 0,
    paddingVertical: 0,
    margin: 0,
    textAlignVertical: "top",
  },
  input: {
    width: "100%",
  },
  // Absolute so it doesn't stretch the row. left/right match inputContainer
  // padding so the wrap width matches the TextInput. No maxHeight: the mirror
  // must measure past the cap; the field itself clamps to ~5 lines.
  inputMirror: {
    position: "absolute",
    left: 14,
    right: 14,
    top: 8,
    opacity: 0,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
});
