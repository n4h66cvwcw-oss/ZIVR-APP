import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import React, { useState, useRef, useCallback } from "react";
import {
  FlatList,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import Colors from "@/constants/colors";
import type { MusicAttachment, MusicPlayMode } from "@/context/MessagingContext";
import { useRecentClips } from "@/hooks/useRecentClips";

export const MUSIC_LIBRARY: Omit<MusicAttachment, "clipStart" | "clipEnd" | "playMode" | "delaySeconds">[] = [
  { id: "m1",  title: "On Fire",       artist: "VibeBeats",    genre: "Hip-Hop",  mood: "Energy",    colors: ["#FF6B35", "#FF3B30"], emoji: "🔥", duration: 185 },
  { id: "m2",  title: "Level Up",      artist: "DriveWave",    genre: "Trap",     mood: "Energy",    colors: ["#FF9F0A", "#FF6B35"], emoji: "⚡", duration: 212 },
  { id: "m3",  title: "Beast Mode",    artist: "PulseRiot",    genre: "EDM",      mood: "Energy",    colors: ["#BF5AF2", "#FF375F"], emoji: "💪", duration: 198 },
  { id: "m4",  title: "Late Night",    artist: "LoLux",        genre: "R&B",      mood: "Vibe",      colors: ["#5E5CE6", "#0A84FF"], emoji: "🌙", duration: 224 },
  { id: "m5",  title: "City Lights",   artist: "NeonDrift",    genre: "Synthpop", mood: "Vibe",      colors: ["#0A84FF", "#32ADE6"], emoji: "✨", duration: 201 },
  { id: "m6",  title: "Slow Motion",   artist: "ChillWaves",   genre: "R&B",      mood: "Vibe",      colors: ["#30D158", "#0A84FF"], emoji: "🎭", duration: 237 },
  { id: "m7",  title: "Ocean Drive",   artist: "SunsetKid",    genre: "Indie",    mood: "Chill",     colors: ["#32ADE6", "#30D158"], emoji: "🌊", duration: 195 },
  { id: "m8",  title: "Midnight Blue", artist: "AzureGroove",  genre: "Jazz",     mood: "Chill",     colors: ["#004E7C", "#0A84FF"], emoji: "🎷", duration: 268 },
  { id: "m9",  title: "Easy",          artist: "FlowState",    genre: "Acoustic", mood: "Chill",     colors: ["#30D158", "#32ADE6"], emoji: "🍃", duration: 183 },
  { id: "m10", title: "Sweet Thing",   artist: "VelvetSoul",   genre: "Soul",     mood: "Love",      colors: ["#FF2D55", "#FF6B9D"], emoji: "💕", duration: 249 },
  { id: "m11", title: "Only You",      artist: "SoftEcho",     genre: "Pop",      mood: "Love",      colors: ["#FF375F", "#BF5AF2"], emoji: "❤️", duration: 215 },
  { id: "m12", title: "Close",         artist: "IntimateKey",  genre: "R&B",      mood: "Love",      colors: ["#FF2D55", "#FF9F0A"], emoji: "🥰", duration: 231 },
  { id: "m13", title: "Sunshine",      artist: "BreezyDays",   genre: "Pop",      mood: "Good Mood", colors: ["#FFD60A", "#FF9F0A"], emoji: "☀️", duration: 190 },
  { id: "m14", title: "Breezy",        artist: "SummerCut",    genre: "Funk",     mood: "Good Mood", colors: ["#30D158", "#FFD60A"], emoji: "🌟", duration: 205 },
  { id: "m15", title: "Weekend",       artist: "GoldVibes",    genre: "Pop",      mood: "Good Mood", colors: ["#FF9F0A", "#FFD60A"], emoji: "🎉", duration: 218 },
  { id: "m16", title: "Watch Me",      artist: "StatementPlay",genre: "Hip-Hop",  mood: "Attitude",  colors: ["#1C1C1E", "#5E5CE6"], emoji: "😤", duration: 197 },
  { id: "m17", title: "Boss Up",       artist: "CrownVibe",    genre: "Trap",     mood: "Attitude",  colors: ["#FF9F0A", "#1C1C1E"], emoji: "👑", duration: 210 },
  { id: "m18", title: "Statement",     artist: "LoudAndClear", genre: "EDM",      mood: "Attitude",  colors: ["#BF5AF2", "#5E5CE6"], emoji: "💎", duration: 203 },
];

const MOODS = ["All", "Energy", "Vibe", "Chill", "Love", "Good Mood", "Attitude"];
const MOOD_ICONS: Record<string, string> = {
  All: "🎵", Energy: "🔥", Vibe: "🌙", Chill: "🌊",
  Love: "💕", "Good Mood": "☀️", Attitude: "👑",
};
const CLIP_PRESETS = [5, 10, 15, 20, 30, 45, 60];

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

type BaseTrack = Omit<MusicAttachment, "clipStart" | "clipEnd" | "playMode" | "delaySeconds">;

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (track: MusicAttachment) => void;
}

export function MusicalMessageModal({ visible, onClose, onSelect }: Props) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const { recentClips, saveClip, removeClip } = useRecentClips();

  const [step, setStep] = useState<"pick" | "configure">("pick");
  const [activeMood, setActiveMood] = useState("All");
  const [selectedTrack, setSelectedTrack] = useState<BaseTrack | null>(null);

  const [clipStart, setClipStart] = useState(0);
  const [clipLength, setClipLength] = useState(20);
  const [playMode, setPlayMode] = useState<MusicPlayMode>("once");
  const [delaySeconds, setDelaySeconds] = useState(3);
  const [barWidth, setBarWidth] = useState(0);

  const filtered = activeMood === "All" ? MUSIC_LIBRARY : MUSIC_LIBRARY.filter((t) => t.mood === activeMood);

  const clipEnd = Math.min(clipStart + clipLength, selectedTrack?.duration ?? 9999);
  const actualClipLen = clipEnd - clipStart;

  const maxStart = selectedTrack ? Math.max(0, selectedTrack.duration - clipLength) : 0;

  const handleTrackSelect = (track: BaseTrack) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedTrack(track);
    setClipStart(0);
    setClipLength(Math.min(20, track.duration));
    setPlayMode("once");
    setDelaySeconds(3);
    setStep("configure");
  };

  const handleAttach = () => {
    if (!selectedTrack) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const clip: MusicAttachment = {
      ...selectedTrack,
      clipStart,
      clipEnd,
      playMode,
      delaySeconds: playMode === "delayed" ? delaySeconds : undefined,
    };
    saveClip(clip);
    onSelect(clip);
    resetAndClose();
  };

  const handleQuickAttach = (clip: MusicAttachment) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    saveClip(clip);
    onSelect(clip);
    resetAndClose();
  };

  const handleQuickConfigure = (clip: MusicAttachment) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const base = MUSIC_LIBRARY.find((t) => t.id === clip.id);
    if (!base) return;
    setSelectedTrack(base);
    setClipStart(clip.clipStart ?? 0);
    setClipLength((clip.clipEnd ?? clip.duration) - (clip.clipStart ?? 0));
    setPlayMode(clip.playMode);
    setDelaySeconds(clip.delaySeconds ?? 3);
    setStep("configure");
  };

  const resetAndClose = () => {
    setStep("pick");
    setSelectedTrack(null);
    setActiveMood("All");
    setClipStart(0);
    setClipLength(20);
    setPlayMode("once");
    setDelaySeconds(3);
    onClose();
  };

  const nudgeStart = (delta: number) => {
    Haptics.selectionAsync();
    setClipStart((v) => Math.max(0, Math.min(maxStart, v + delta)));
  };

  const nudgeLength = (delta: number) => {
    Haptics.selectionAsync();
    const minLen = 5;
    const maxLen = Math.min(60, (selectedTrack?.duration ?? 60) - clipStart);
    setClipLength((v) => Math.max(minLen, Math.min(maxLen, v + delta)));
  };

  const handleBarTap = (locationX: number) => {
    if (!barWidth || !selectedTrack) return;
    const ratio = Math.max(0, Math.min(1, locationX / barWidth));
    const newStart = Math.round(ratio * selectedTrack.duration);
    setClipStart(Math.min(newStart, maxStart));
    Haptics.selectionAsync();
  };

  const startRatio = selectedTrack ? clipStart / selectedTrack.duration : 0;
  const lengthRatio = selectedTrack ? clipLength / selectedTrack.duration : 0;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={resetAndClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable
            onPress={step === "pick" ? resetAndClose : () => setStep("pick")}
            hitSlop={8}
            style={styles.headerBtn}
          >
            <Text style={[styles.headerBtnText, { color: colors.textSecondary }]}>
              {step === "pick" ? "Cancel" : "← Back"}
            </Text>
          </Pressable>
          <View style={styles.headerCenter}>
            <Ionicons name="musical-note" size={18} color="#BF5AF2" />
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {step === "pick" ? "Musical Messages" : "Clip & Playback"}
            </Text>
          </View>
          {step === "configure" ? (
            <Pressable onPress={handleAttach} hitSlop={8} style={styles.headerBtn}>
              <Text style={[styles.headerBtnText, { color: "#BF5AF2", fontFamily: "Inter_600SemiBold" }]}>Attach</Text>
            </Pressable>
          ) : (
            <View style={styles.headerBtn} />
          )}
        </View>

        {step === "pick" ? (
          <>
            {recentClips.length > 0 && (
              <View style={styles.quickAddSection}>
                <View style={styles.quickAddHeader}>
                  <Ionicons name="flash" size={14} color="#FF9F0A" />
                  <Text style={[styles.quickAddTitle, { color: colors.text }]}>Quick Add</Text>
                  <Text style={[styles.quickAddSub, { color: colors.textSecondary }]}>Tap to reuse · Hold to remove</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickAddRow}>
                  {recentClips.map((clip, i) => {
                    const clipLen = Math.round((clip.clipEnd ?? clip.duration) - (clip.clipStart ?? 0));
                    const modeLabels: Record<string, string> = { once: "1x", loop: "∞", delayed: `+${clip.delaySeconds ?? 0}s` };
                    return (
                      <Pressable
                        key={`${clip.id}-${i}`}
                        onPress={() => handleQuickAttach(clip)}
                        onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); removeClip(clip); }}
                        delayLongPress={500}
                        style={styles.quickCard}
                      >
                        <LinearGradient
                          colors={clip.colors as [string, string]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.quickCardGradient}
                        >
                          <View style={styles.quickCardTop}>
                            <Text style={styles.quickCardEmoji}>{clip.emoji}</Text>
                            <View style={styles.quickModeBadge}>
                              <Text style={styles.quickModeBadgeText}>{modeLabels[clip.playMode]}</Text>
                            </View>
                          </View>
                          <Text style={styles.quickCardTitle} numberOfLines={1}>{clip.title}</Text>
                          <Text style={styles.quickCardClip}>{clipLen}s clip</Text>
                          <Pressable
                            onPress={() => handleQuickConfigure(clip)}
                            hitSlop={6}
                            style={styles.quickEditBtn}
                          >
                            <Ionicons name="create-outline" size={11} color="rgba(255,255,255,0.75)" />
                          </Pressable>
                        </LinearGradient>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.moodBar} contentContainerStyle={styles.moodBarContent}>
              {MOODS.map((mood) => (
                <Pressable
                  key={mood}
                  onPress={() => { Haptics.selectionAsync(); setActiveMood(mood); }}
                  style={[styles.moodChip, { backgroundColor: activeMood === mood ? "#BF5AF2" : colors.surfaceSecondary }]}
                >
                  <Text style={styles.moodEmoji}>{MOOD_ICONS[mood]}</Text>
                  <Text style={[styles.moodLabel, { color: activeMood === mood ? "#fff" : colors.textSecondary }]}>{mood}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              numColumns={2}
              contentContainerStyle={styles.grid}
              columnWrapperStyle={styles.gridRow}
              renderItem={({ item }) => (
                <Pressable onPress={() => handleTrackSelect(item)} style={styles.trackCard}>
                  <LinearGradient
                    colors={item.colors as [string, string]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.trackGradient}
                  >
                    <Text style={styles.trackEmoji}>{item.emoji}</Text>
                    <View style={styles.trackBottom}>
                      <Text style={styles.trackTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.trackArtist} numberOfLines={1}>{item.artist}</Text>
                      <View style={styles.trackMeta}>
                        <Text style={styles.trackGenre}>{item.genre}</Text>
                        <Text style={styles.trackDuration}>{fmtTime(item.duration)}</Text>
                      </View>
                    </View>
                  </LinearGradient>
                </Pressable>
              )}
            />
          </>
        ) : selectedTrack ? (
          <ScrollView contentContainerStyle={styles.configScroll} showsVerticalScrollIndicator={false}>
            <LinearGradient
              colors={selectedTrack.colors as [string, string]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.configTrackBanner}
            >
              <Text style={styles.configTrackEmoji}>{selectedTrack.emoji}</Text>
              <View style={styles.configTrackInfo}>
                <Text style={styles.configTrackTitle} numberOfLines={1}>{selectedTrack.title}</Text>
                <Text style={styles.configTrackArtist}>{selectedTrack.artist} · {selectedTrack.genre} · {fmtTime(selectedTrack.duration)}</Text>
              </View>
            </LinearGradient>

            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Clip Selection</Text>
              <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>
                Tap the bar to set start · Adjust length with presets
              </Text>

              <Pressable
                onPress={(e) => handleBarTap(e.nativeEvent.locationX)}
                onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
                style={[styles.timelineBar, { backgroundColor: colors.surfaceSecondary }]}
              >
                <View
                  style={[
                    styles.timelineClip,
                    {
                      left: `${startRatio * 100}%` as any,
                      width: `${Math.min(lengthRatio, 1 - startRatio) * 100}%` as any,
                      backgroundColor: selectedTrack.colors[0],
                    },
                  ]}
                />
                <View
                  style={[
                    styles.timelineThumb,
                    {
                      left: `${startRatio * 100}%` as any,
                      backgroundColor: "#fff",
                      borderColor: selectedTrack.colors[0],
                    },
                  ]}
                />
                <View
                  style={[
                    styles.timelineThumb,
                    {
                      left: `${Math.min((startRatio + lengthRatio) * 100, 100)}%` as any,
                      backgroundColor: "#fff",
                      borderColor: selectedTrack.colors[1],
                    },
                  ]}
                />
              </Pressable>

              <View style={styles.clipTimeRow}>
                <Text style={[styles.clipTimeLabel, { color: colors.textSecondary }]}>
                  {fmtTime(clipStart)} — {fmtTime(clipEnd)}
                </Text>
                <Text style={[styles.clipDurationBadge, { backgroundColor: selectedTrack.colors[0] + "22", color: selectedTrack.colors[0] }]}>
                  {actualClipLen}s clip
                </Text>
              </View>

              <View style={styles.startAdjustRow}>
                <Text style={[styles.adjLabel, { color: colors.textSecondary }]}>Start at</Text>
                <View style={styles.stepperRow}>
                  {[-30, -10, -5].map((d) => (
                    <Pressable key={d} onPress={() => nudgeStart(d)} style={[styles.stepperBtn, { backgroundColor: colors.surfaceSecondary }]}>
                      <Text style={[styles.stepperBtnText, { color: colors.text }]}>{d}s</Text>
                    </Pressable>
                  ))}
                  <Text style={[styles.stepperValue, { color: colors.text }]}>{fmtTime(clipStart)}</Text>
                  {[5, 10, 30].map((d) => (
                    <Pressable key={d} onPress={() => nudgeStart(d)} style={[styles.stepperBtn, { backgroundColor: colors.surfaceSecondary }]}>
                      <Text style={[styles.stepperBtnText, { color: colors.text }]}>+{d}s</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={[styles.startAdjustRow, { marginTop: 12 }]}>
                <Text style={[styles.adjLabel, { color: colors.textSecondary }]}>Clip length</Text>
                <View style={styles.presetRow}>
                  {CLIP_PRESETS.map((p) => {
                    const maxLen = Math.min(p, (selectedTrack.duration - clipStart));
                    if (maxLen < 5) return null;
                    return (
                      <Pressable
                        key={p}
                        onPress={() => { Haptics.selectionAsync(); setClipLength(p); }}
                        style={[
                          styles.presetChip,
                          {
                            backgroundColor: clipLength === p ? selectedTrack.colors[0] : colors.surfaceSecondary,
                          },
                        ]}
                      >
                        <Text style={[styles.presetChipText, { color: clipLength === p ? "#fff" : colors.textSecondary }]}>
                          {p}s
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>

            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Playback</Text>
              <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>How the clip behaves when the message is opened</Text>

              <View style={styles.playModeRow}>
                {(["once", "loop", "delayed"] as MusicPlayMode[]).map((mode) => {
                  const labels: Record<MusicPlayMode, string> = { once: "Play Once", loop: "Loop", delayed: "Delayed" };
                  const icons: Record<MusicPlayMode, string> = { once: "play-circle", loop: "repeat", delayed: "timer" };
                  const active = playMode === mode;
                  return (
                    <Pressable
                      key={mode}
                      onPress={() => { Haptics.selectionAsync(); setPlayMode(mode); }}
                      style={[
                        styles.playModeChip,
                        {
                          backgroundColor: active ? "#BF5AF2" : colors.surfaceSecondary,
                          borderColor: active ? "#BF5AF2" : colors.border,
                        },
                      ]}
                    >
                      <Ionicons name={icons[mode] as any} size={15} color={active ? "#fff" : colors.textSecondary} />
                      <Text style={[styles.playModeText, { color: active ? "#fff" : colors.textSecondary }]}>{labels[mode]}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {playMode === "delayed" && (
                <View style={[styles.delayRow, { borderTopColor: colors.border }]}>
                  <Text style={[styles.adjLabel, { color: colors.textSecondary }]}>Delay (seconds)</Text>
                  <View style={styles.delayControl}>
                    <Pressable
                      onPress={() => { Haptics.selectionAsync(); setDelaySeconds((v) => Math.max(1, v - 1)); }}
                      style={[styles.delayBtn, { backgroundColor: colors.surfaceSecondary }]}
                    >
                      <Ionicons name="remove" size={18} color={colors.text} />
                    </Pressable>
                    <Text style={[styles.delayValue, { color: colors.text }]}>{delaySeconds}s</Text>
                    <Pressable
                      onPress={() => { Haptics.selectionAsync(); setDelaySeconds((v) => Math.min(30, v + 1)); }}
                      style={[styles.delayBtn, { backgroundColor: colors.surfaceSecondary }]}
                    >
                      <Ionicons name="add" size={18} color={colors.text} />
                    </Pressable>
                  </View>
                  <Text style={[styles.delayHint, { color: colors.textSecondary }]}>
                    Clip starts {delaySeconds}s after message is opened
                  </Text>
                </View>
              )}

              {playMode === "loop" && (
                <Text style={[styles.playModeHint, { color: colors.textSecondary }]}>
                  Clip loops continuously while the message is open
                </Text>
              )}
              {playMode === "once" && (
                <Text style={[styles.playModeHint, { color: colors.textSecondary }]}>
                  Clip plays once automatically when the message is opened
                </Text>
              )}
            </View>

            <Pressable
              onPress={handleAttach}
              style={[styles.attachBtn, { backgroundColor: "#BF5AF2" }]}
            >
              <Ionicons name="musical-note" size={18} color="#fff" />
              <Text style={styles.attachBtnText}>Attach to Message</Text>
            </Pressable>
          </ScrollView>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { minWidth: 60 },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: 6 },
  headerTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  headerBtnText: { fontSize: 16, fontFamily: "Inter_400Regular" },
  moodBar: { maxHeight: 56, flexShrink: 0 },
  moodBarContent: { paddingHorizontal: 14, paddingVertical: 10, gap: 8, alignItems: "center" },
  moodChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 13, paddingVertical: 6, borderRadius: 20 },
  moodEmoji: { fontSize: 14 },
  moodLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  grid: { padding: 14, gap: 12 },
  gridRow: { gap: 12, justifyContent: "space-between" },
  trackCard: { flex: 1, borderRadius: 16, overflow: "hidden", maxWidth: "48%" },
  trackGradient: { padding: 14, minHeight: 140, justifyContent: "space-between" },
  trackEmoji: { fontSize: 30, alignSelf: "flex-start" },
  trackBottom: { gap: 2 },
  trackTitle: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  trackArtist: { color: "rgba(255,255,255,0.8)", fontSize: 11, fontFamily: "Inter_400Regular" },
  trackMeta: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  trackGenre: { color: "rgba(255,255,255,0.65)", fontSize: 10, fontFamily: "Inter_500Medium" },
  trackDuration: { color: "rgba(255,255,255,0.65)", fontSize: 10, fontFamily: "Inter_500Medium" },
  configScroll: { padding: 16, gap: 14, paddingBottom: 40 },
  configTrackBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 16,
  },
  configTrackEmoji: { fontSize: 36 },
  configTrackInfo: { flex: 1 },
  configTrackTitle: { color: "#fff", fontSize: 17, fontFamily: "Inter_700Bold" },
  configTrackArtist: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  section: {
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  sectionSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: -6 },
  timelineBar: {
    height: 36,
    borderRadius: 8,
    overflow: "visible",
    position: "relative",
    justifyContent: "center",
  },
  timelineClip: {
    position: "absolute",
    top: 0,
    bottom: 0,
    borderRadius: 8,
    opacity: 0.75,
  },
  timelineThumb: {
    position: "absolute",
    width: 16,
    height: 36,
    borderRadius: 4,
    borderWidth: 2,
    marginLeft: -8,
  },
  clipTimeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: -4,
  },
  clipTimeLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  clipDurationBadge: { fontSize: 12, fontFamily: "Inter_600SemiBold", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  startAdjustRow: { gap: 8 },
  adjLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  stepperRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  stepperBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  stepperBtnText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  stepperValue: { fontSize: 13, fontFamily: "Inter_600SemiBold", minWidth: 36, textAlign: "center" },
  presetRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  presetChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  presetChipText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  playModeRow: { flexDirection: "row", gap: 8 },
  playModeChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  playModeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  playModeHint: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", paddingVertical: 4 },
  delayRow: { gap: 10, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  delayControl: { flexDirection: "row", alignItems: "center", gap: 16, justifyContent: "center" },
  delayBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  delayValue: { fontSize: 22, fontFamily: "Inter_700Bold", minWidth: 48, textAlign: "center" },
  delayHint: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center" },
  attachBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 4,
  },
  attachBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  quickAddSection: { paddingTop: 12, paddingBottom: 4 },
  quickAddHeader: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 16, marginBottom: 8 },
  quickAddTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  quickAddSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginLeft: 4 },
  quickAddRow: { paddingHorizontal: 14, gap: 10 },
  quickCard: { width: 110, borderRadius: 14, overflow: "hidden" },
  quickCardGradient: { padding: 11, minHeight: 110, justifyContent: "space-between" },
  quickCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  quickCardEmoji: { fontSize: 22 },
  quickModeBadge: {
    backgroundColor: "rgba(0,0,0,0.28)",
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  quickModeBadgeText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold" },
  quickCardTitle: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  quickCardClip: { color: "rgba(255,255,255,0.72)", fontSize: 10, fontFamily: "Inter_400Regular" },
  quickEditBtn: {
    alignSelf: "flex-end",
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 6,
    padding: 4,
  },
});
