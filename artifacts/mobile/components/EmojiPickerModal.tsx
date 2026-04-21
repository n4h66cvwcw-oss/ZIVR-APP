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

const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  {
    label: "Default (dots)",
    emojis: [""],
  },
  {
    label: "Faces & People",
    emojis: ["😊","😂","🤔","😎","🥳","🤩","😍","🥺","😤","🤣","😅","😭","🙄","🤗","🫡","🫶","✌️","👍","🙌","👏"],
  },
  {
    label: "Animals",
    emojis: ["🐶","🐱","🐻","🦊","🐸","🐼","🦁","🐯","🐻‍❄️","🦋","🐝","🦄","🐙","🦈","🦭","🐧","🦜","🐬","🦅","🦔"],
  },
  {
    label: "Food & Drink",
    emojis: ["🍕","🍔","🍟","🌮","🍣","🍜","☕","🧋","🍺","🍻","🎂","🍰","🍩","🍪","🧁","🍫","🍭","🍦","🥤","🫖"],
  },
  {
    label: "Activities",
    emojis: ["🎮","🎯","🎲","⚽","🏀","🎸","🎵","🎤","🎬","✈️","🚀","⚡","🔥","💎","🏆","🎪","🎭","🎨","🎻","🥊"],
  },
  {
    label: "Objects & Symbols",
    emojis: ["💡","🔮","💣","⚙️","🔑","🛡️","👑","💰","💯","❤️","💜","💙","🖤","🤍","⭐","🌟","✨","🌈","☁️","🌙"],
  },
];

interface Props {
  visible: boolean;
  current?: string;
  title?: string;
  onClose: () => void;
  onSelect: (emoji: string) => void;
}

export function EmojiPickerModal({ visible, current, title = "Choose Typing Emoji", onClose, onSelect }: Props) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const [search, setSearch] = useState("");

  const handleSelect = (emoji: string) => {
    Haptics.selectionAsync();
    onSelect(emoji);
    onClose();
  };

  const allEmojis = EMOJI_CATEGORIES.flatMap((c) => c.emojis).filter(Boolean);
  const filtered = search.trim()
    ? allEmojis.filter((e) => e.includes(search.trim()))
    : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <View style={styles.handle} />
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>

        <View style={[styles.searchBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search emoji…"
            placeholderTextColor={colors.textTertiary}
            style={[styles.searchInput, { color: colors.text }]}
          />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {filtered ? (
            <View style={styles.emojiGrid}>
              {filtered.map((e, i) => (
                <Pressable
                  key={i}
                  style={[styles.emojiBtn, current === e && styles.emojiBtnActive]}
                  onPress={() => handleSelect(e)}
                >
                  <Text style={styles.emojiChar}>{e}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            EMOJI_CATEGORIES.map((cat) => (
              <View key={cat.label} style={styles.category}>
                <Text style={[styles.categoryLabel, { color: colors.textSecondary }]}>
                  {cat.label.toUpperCase()}
                </Text>
                <View style={styles.emojiGrid}>
                  {cat.emojis.map((e, i) => (
                    <Pressable
                      key={i}
                      style={[
                        styles.emojiBtn,
                        { backgroundColor: colors.surfaceSecondary },
                        current === e && styles.emojiBtnActive,
                      ]}
                      onPress={() => handleSelect(e || "")}
                    >
                      {e ? (
                        <Text style={styles.emojiChar}>{e}</Text>
                      ) : (
                        <View style={styles.dotsPreview}>
                          {[0, 1, 2].map((d) => (
                            <View key={d} style={[styles.dotPreviewDot, { backgroundColor: colors.textSecondary }]} />
                          ))}
                        </View>
                      )}
                    </Pressable>
                  ))}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    paddingBottom: 34,
    maxHeight: "80%",
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
  title: {
    fontSize: 17,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    paddingVertical: 10,
  },
  searchBox: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  searchInput: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  category: {
    marginBottom: 16,
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.7,
    marginBottom: 8,
  },
  emojiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  emojiBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiBtnActive: {
    backgroundColor: "#5E6AD2",
  },
  emojiChar: {
    fontSize: 26,
  },
  dotsPreview: {
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
  },
  dotPreviewDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
