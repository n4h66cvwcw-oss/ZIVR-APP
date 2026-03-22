import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  FlatList,
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

type GifCategory = {
  label: string;
  icon: string;
  gifs: { url: string; label: string }[];
};

const GIF_CATEGORIES: GifCategory[] = [
  {
    label: "Vibes",
    icon: "✨",
    gifs: [
      { url: "https://media.giphy.com/media/26u4exBcimn59VXNK/giphy.gif", label: "Confetti" },
      { url: "https://media.giphy.com/media/l0HlvtIPzPdt2usKs/giphy.gif", label: "Hearts" },
      { url: "https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif", label: "Sparkle" },
      { url: "https://media.giphy.com/media/xT9IgFy0M3bBCPTZ0c/giphy.gif", label: "Glitter" },
      { url: "https://media.giphy.com/media/l3q2Hy2tFHvFDpFAQ/giphy.gif", label: "Party" },
      { url: "https://media.giphy.com/media/xUOwFVJuJ0UwOcZr6E/giphy.gif", label: "Colors" },
    ],
  },
  {
    label: "Nature",
    icon: "🌊",
    gifs: [
      { url: "https://media.giphy.com/media/aE7TUwBNqJuJi/giphy.gif", label: "Rain" },
      { url: "https://media.giphy.com/media/xT5LMHxhOfscZfeinK/giphy.gif", label: "Ocean" },
      { url: "https://media.giphy.com/media/nrXif9YExO9EI/giphy.gif", label: "Fire" },
      { url: "https://media.giphy.com/media/3oriO04qxVReXmZ7ig/giphy.gif", label: "Stars" },
      { url: "https://media.giphy.com/media/xT9IgzoKnwFNmISR8I/giphy.gif", label: "Galaxy" },
      { url: "https://media.giphy.com/media/3oz8xZvvOZRmKay4xy/giphy.gif", label: "Bubbles" },
    ],
  },
  {
    label: "Neon",
    icon: "🌈",
    gifs: [
      { url: "https://media.giphy.com/media/l0HlPwMAzh13pcZ20/giphy.gif", label: "Neon" },
      { url: "https://media.giphy.com/media/xUPGcguWZHRC2HyBRS/giphy.gif", label: "Lofi" },
      { url: "https://media.giphy.com/media/26BkMSMsVBJ8vT1EA/giphy.gif", label: "Aurora" },
      { url: "https://media.giphy.com/media/xT9IgzoKnwFNmISR8I/giphy.gif", label: "Space" },
      { url: "https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif", label: "Glitch" },
      { url: "https://media.giphy.com/media/l3q2Hy2tFHvFDpFAQ/giphy.gif", label: "Disco" },
    ],
  },
];

interface GifPickerModalProps {
  visible: boolean;
  currentUrl?: string;
  onSelect: (url: string) => void;
  onRemove: () => void;
  onClose: () => void;
}

export function GifPickerModal({
  visible,
  currentUrl,
  onSelect,
  onRemove,
  onClose,
}: GifPickerModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const [activeCategory, setActiveCategory] = useState(0);
  const [customUrl, setCustomUrl] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);

  const handleSelect = (url: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(url);
    onClose();
  };

  const handleCustomUrl = () => {
    const url = customUrl.trim();
    if (url) {
      onSelect(url);
      setCustomUrl("");
      setShowUrlInput(false);
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: colors.text }]}>GIF Background</Text>
          <View style={styles.headerActions}>
            {currentUrl && (
              <Pressable
                onPress={() => { onRemove(); onClose(); }}
                style={[styles.removeBtn, { backgroundColor: "#FF3B3022" }]}
                hitSlop={8}
              >
                <Ionicons name="trash-outline" size={16} color="#FF3B30" />
                <Text style={[styles.removeBtnText, { color: "#FF3B30" }]}>Remove</Text>
              </Pressable>
            )}
            <Pressable onPress={() => setShowUrlInput((v) => !v)} hitSlop={8}>
              <Ionicons name="link" size={20} color={colors.primary} />
            </Pressable>
          </View>
        </View>

        {currentUrl && (
          <View style={styles.currentPreview}>
            <Image source={{ uri: currentUrl }} style={styles.currentImg} contentFit="cover" />
            <View style={[styles.currentBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.currentBadgeText}>Active</Text>
            </View>
          </View>
        )}

        {showUrlInput && (
          <View
            style={[
              styles.urlRow,
              { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
            ]}
          >
            <TextInput
              style={[styles.urlInput, { color: colors.text }]}
              value={customUrl}
              onChangeText={setCustomUrl}
              placeholder="Paste GIF URL..."
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleCustomUrl}
            />
            <Pressable onPress={handleCustomUrl} style={[styles.urlApplyBtn, { backgroundColor: colors.primary }]}>
              <Text style={styles.urlApplyText}>Use</Text>
            </Pressable>
          </View>
        )}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryRow}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        >
          {GIF_CATEGORIES.map((cat, i) => (
            <Pressable
              key={cat.label}
              onPress={() => setActiveCategory(i)}
              style={[
                styles.categoryTab,
                {
                  backgroundColor:
                    activeCategory === i ? colors.primary : colors.surfaceSecondary,
                },
              ]}
            >
              <Text style={styles.categoryIcon}>{cat.icon}</Text>
              <Text
                style={[
                  styles.categoryLabel,
                  { color: activeCategory === i ? "#FFF" : colors.text },
                ]}
              >
                {cat.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <FlatList
          data={GIF_CATEGORIES[activeCategory].gifs}
          numColumns={3}
          keyExtractor={(item) => item.url}
          contentContainerStyle={styles.gifGrid}
          renderItem={({ item }) => {
            const isSelected = currentUrl === item.url;
            return (
              <Pressable
                onPress={() => handleSelect(item.url)}
                style={[
                  styles.gifTile,
                  isSelected && { borderColor: colors.primary, borderWidth: 3 },
                ]}
              >
                <Image
                  source={{ uri: item.url }}
                  style={styles.gifImg}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
                {isSelected && (
                  <View style={styles.selectedBadge}>
                    <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                  </View>
                )}
                <View style={styles.gifLabel}>
                  <Text style={styles.gifLabelText}>{item.label}</Text>
                </View>
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const TILE_SIZE = 104;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 32,
    maxHeight: "70%",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  title: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  removeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  removeBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  currentPreview: {
    marginHorizontal: 20,
    marginBottom: 12,
    height: 80,
    borderRadius: 16,
    overflow: "hidden",
  },
  currentImg: {
    width: "100%",
    height: "100%",
  },
  currentBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  currentBadgeText: {
    color: "#FFF",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  urlRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
    gap: 8,
  },
  urlInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  urlApplyBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  urlApplyText: {
    color: "#FFF",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  categoryRow: {
    flexGrow: 0,
    marginBottom: 12,
  },
  categoryTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  categoryIcon: { fontSize: 14 },
  categoryLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  gifGrid: {
    paddingHorizontal: 12,
    gap: 8,
  },
  gifTile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 14,
    overflow: "hidden",
    margin: 4,
  },
  gifImg: {
    width: "100%",
    height: "100%",
  },
  selectedBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 10,
  },
  gifLabel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  gifLabelText: {
    color: "#FFF",
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
});
