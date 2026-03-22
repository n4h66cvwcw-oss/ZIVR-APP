import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import Colors from "@/constants/colors";
import type { MusicAttachment } from "@/context/MessagingContext";

export const MUSIC_LIBRARY: MusicAttachment[] = [
  { id: "m1",  title: "On Fire",         artist: "VibeBeats",       genre: "Hip-Hop",  mood: "Energy",    colors: ["#FF6B35", "#FF3B30"], emoji: "🔥", duration: 185, uri: undefined },
  { id: "m2",  title: "Level Up",        artist: "DriveWave",       genre: "Trap",     mood: "Energy",    colors: ["#FF9F0A", "#FF6B35"], emoji: "⚡", duration: 212, uri: undefined },
  { id: "m3",  title: "Beast Mode",      artist: "PulseRiot",       genre: "EDM",      mood: "Energy",    colors: ["#BF5AF2", "#FF375F"], emoji: "💪", duration: 198, uri: undefined },
  { id: "m4",  title: "Late Night",      artist: "LoLux",           genre: "R&B",      mood: "Vibe",      colors: ["#5E5CE6", "#0A84FF"], emoji: "🌙", duration: 224, uri: undefined },
  { id: "m5",  title: "City Lights",     artist: "NeonDrift",       genre: "Synthpop", mood: "Vibe",      colors: ["#0A84FF", "#32ADE6"], emoji: "✨", duration: 201, uri: undefined },
  { id: "m6",  title: "Slow Motion",     artist: "ChillWaves",      genre: "R&B",      mood: "Vibe",      colors: ["#30D158", "#0A84FF"], emoji: "🎭", duration: 237, uri: undefined },
  { id: "m7",  title: "Ocean Drive",     artist: "SunsetKid",       genre: "Indie",    mood: "Chill",     colors: ["#32ADE6", "#30D158"], emoji: "🌊", duration: 195, uri: undefined },
  { id: "m8",  title: "Midnight Blue",   artist: "AzureGroove",     genre: "Jazz",     mood: "Chill",     colors: ["#004E7C", "#0A84FF"], emoji: "🎷", duration: 268, uri: undefined },
  { id: "m9",  title: "Easy",            artist: "FlowState",       genre: "Acoustic", mood: "Chill",     colors: ["#30D158", "#32ADE6"], emoji: "🍃", duration: 183, uri: undefined },
  { id: "m10", title: "Sweet Thing",     artist: "VelvetSoul",      genre: "Soul",     mood: "Love",      colors: ["#FF2D55", "#FF6B9D"], emoji: "💕", duration: 249, uri: undefined },
  { id: "m11", title: "Only You",        artist: "SoftEcho",        genre: "Pop",      mood: "Love",      colors: ["#FF375F", "#BF5AF2"], emoji: "❤️", duration: 215, uri: undefined },
  { id: "m12", title: "Close",           artist: "IntimateKey",     genre: "R&B",      mood: "Love",      colors: ["#FF2D55", "#FF9F0A"], emoji: "🥰", duration: 231, uri: undefined },
  { id: "m13", title: "Sunshine",        artist: "BreezyDays",      genre: "Pop",      mood: "Good Mood", colors: ["#FFD60A", "#FF9F0A"], emoji: "☀️", duration: 190, uri: undefined },
  { id: "m14", title: "Breezy",          artist: "SummerCut",       genre: "Funk",     mood: "Good Mood", colors: ["#30D158", "#FFD60A"], emoji: "🌟", duration: 205, uri: undefined },
  { id: "m15", title: "Weekend",         artist: "GoldVibes",       genre: "Pop",      mood: "Good Mood", colors: ["#FF9F0A", "#FFD60A"], emoji: "🎉", duration: 218, uri: undefined },
  { id: "m16", title: "Watch Me",        artist: "StatementPlay",   genre: "Hip-Hop",  mood: "Attitude",  colors: ["#1C1C1E", "#5E5CE6"], emoji: "😤", duration: 197, uri: undefined },
  { id: "m17", title: "Boss Up",         artist: "CrownVibe",       genre: "Trap",     mood: "Attitude",  colors: ["#FF9F0A", "#1C1C1E"], emoji: "👑", duration: 210, uri: undefined },
  { id: "m18", title: "Statement",       artist: "LoudAndClear",    genre: "EDM",      mood: "Attitude",  colors: ["#BF5AF2", "#5E5CE6"], emoji: "💎", duration: 203, uri: undefined },
];

const MOODS = ["All", "Energy", "Vibe", "Chill", "Love", "Good Mood", "Attitude"];

const MOOD_ICONS: Record<string, string> = {
  All: "🎵",
  Energy: "🔥",
  Vibe: "🌙",
  Chill: "🌊",
  Love: "💕",
  "Good Mood": "☀️",
  Attitude: "👑",
};

function fmtDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (track: MusicAttachment) => void;
}

export function MusicalMessageModal({ visible, onClose, onSelect }: Props) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;

  const [activeMood, setActiveMood] = useState("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = activeMood === "All" ? MUSIC_LIBRARY : MUSIC_LIBRARY.filter((t) => t.mood === activeMood);
  const selected = MUSIC_LIBRARY.find((t) => t.id === selectedId);

  const handlePick = (track: MusicAttachment) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedId(track.id);
  };

  const handleSend = () => {
    if (!selected) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSelect(selected);
    setSelectedId(null);
    setActiveMood("All");
    onClose();
  };

  const handleClose = () => {
    setSelectedId(null);
    setActiveMood("All");
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={handleClose} hitSlop={8} style={styles.headerBtn}>
            <Text style={[styles.headerBtnText, { color: colors.textSecondary }]}>Cancel</Text>
          </Pressable>
          <View style={styles.headerCenter}>
            <Ionicons name="musical-notes" size={18} color="#BF5AF2" />
            <Text style={[styles.headerTitle, { color: colors.text }]}>Musical Messages</Text>
          </View>
          <Pressable
            onPress={handleSend}
            disabled={!selected}
            hitSlop={8}
            style={styles.headerBtn}
          >
            <Text style={[styles.headerBtnText, { color: selected ? "#BF5AF2" : colors.textSecondary, fontFamily: "Inter_600SemiBold" }]}>
              Send
            </Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.moodBar} contentContainerStyle={styles.moodBarContent}>
          {MOODS.map((mood) => (
            <Pressable
              key={mood}
              onPress={() => {
                Haptics.selectionAsync();
                setActiveMood(mood);
              }}
              style={[
                styles.moodChip,
                {
                  backgroundColor: activeMood === mood ? "#BF5AF2" : colors.surfaceSecondary,
                },
              ]}
            >
              <Text style={styles.moodEmoji}>{MOOD_ICONS[mood]}</Text>
              <Text style={[styles.moodLabel, { color: activeMood === mood ? "#fff" : colors.textSecondary }]}>{mood}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {selected && (
          <LinearGradient
            colors={[selected.colors[0] + "33", selected.colors[1] + "22"]}
            style={[styles.selectedBanner, { borderColor: selected.colors[0] + "55" }]}
          >
            <Text style={styles.selectedEmoji}>{selected.emoji}</Text>
            <View style={styles.selectedInfo}>
              <Text style={[styles.selectedTitle, { color: colors.text }]} numberOfLines={1}>{selected.title}</Text>
              <Text style={[styles.selectedArtist, { color: colors.textSecondary }]} numberOfLines={1}>{selected.artist} · {selected.genre} · {fmtDuration(selected.duration)}</Text>
            </View>
            <View style={[styles.selectedCheck, { backgroundColor: selected.colors[0] }]}>
              <Ionicons name="checkmark" size={14} color="#fff" />
            </View>
          </LinearGradient>
        )}

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.gridRow}
          renderItem={({ item }) => {
            const isSelected = item.id === selectedId;
            return (
              <Pressable
                onPress={() => handlePick(item)}
                style={[styles.trackCard, { opacity: isSelected ? 1 : 0.92 }]}
              >
                <LinearGradient
                  colors={item.colors}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[
                    styles.trackGradient,
                    isSelected && styles.trackSelected,
                  ]}
                >
                  <Text style={styles.trackEmoji}>{item.emoji}</Text>
                  <View style={styles.trackBottom}>
                    <Text style={styles.trackTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.trackArtist} numberOfLines={1}>{item.artist}</Text>
                    <View style={styles.trackMeta}>
                      <Text style={styles.trackGenre}>{item.genre}</Text>
                      <Text style={styles.trackDuration}>{fmtDuration(item.duration)}</Text>
                    </View>
                  </View>
                  {isSelected && (
                    <View style={styles.checkOverlay}>
                      <Ionicons name="checkmark-circle" size={22} color="#fff" />
                    </View>
                  )}
                </LinearGradient>
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    minWidth: 60,
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  headerBtnText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  moodBar: {
    maxHeight: 56,
    flexShrink: 0,
  },
  moodBarContent: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    alignItems: "center",
  },
  moodChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 20,
  },
  moodEmoji: {
    fontSize: 14,
  },
  moodLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  selectedBanner: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 4,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  selectedEmoji: {
    fontSize: 26,
  },
  selectedInfo: {
    flex: 1,
  },
  selectedTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  selectedArtist: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  selectedCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  grid: {
    padding: 14,
    gap: 12,
  },
  gridRow: {
    gap: 12,
    justifyContent: "space-between",
  },
  trackCard: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
    maxWidth: "48%",
  },
  trackGradient: {
    padding: 14,
    minHeight: 140,
    justifyContent: "space-between",
  },
  trackSelected: {
    borderWidth: 2.5,
    borderColor: "rgba(255,255,255,0.7)",
  },
  trackEmoji: {
    fontSize: 30,
    alignSelf: "flex-start",
  },
  trackBottom: {
    gap: 2,
  },
  trackTitle: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  trackArtist: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  trackMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  trackGenre: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  trackDuration: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  checkOverlay: {
    position: "absolute",
    top: 10,
    right: 10,
  },
});
