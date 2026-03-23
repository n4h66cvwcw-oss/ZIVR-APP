import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
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
const CLIP_PRESETS = [5, 10, 15, 20, 30];

const GENRE_COLORS: Record<string, [string, string]> = {
  "Pop":          ["#FF375F", "#FF6B9D"],
  "Rock":         ["#636366", "#1C1C1E"],
  "Hip-Hop":      ["#FF6B35", "#FF3B30"],
  "Hip-Hop/Rap":  ["#FF6B35", "#FF3B30"],
  "R&B/Soul":     ["#5E5CE6", "#0A84FF"],
  "R&B":          ["#5E5CE6", "#0A84FF"],
  "Country":      ["#FF9F0A", "#FFD60A"],
  "Jazz":         ["#004E7C", "#0A84FF"],
  "Electronic":   ["#BF5AF2", "#FF375F"],
  "Dance":        ["#BF5AF2", "#5E5CE6"],
  "Alternative":  ["#30D158", "#0A84FF"],
  "Indie Pop":    ["#32ADE6", "#30D158"],
  "Classical":    ["#FFD60A", "#FF9F0A"],
  "Soul":         ["#FF2D55", "#FF6B9D"],
  "Funk":         ["#30D158", "#FFD60A"],
  "Reggae":       ["#30D158", "#FFD60A"],
  "Latin":        ["#FF9F0A", "#FF375F"],
  "K-Pop":        ["#FF375F", "#BF5AF2"],
  "Gospel":       ["#FFD60A", "#FF9F0A"],
  "Metal":        ["#1C1C1E", "#636366"],
};
const GENRE_EMOJI: Record<string, string> = {
  "Pop": "🌟", "Rock": "🎸", "Hip-Hop": "🔥", "Hip-Hop/Rap": "🎤",
  "R&B/Soul": "💜", "R&B": "💜", "Country": "🤠", "Jazz": "🎷",
  "Electronic": "⚡", "Dance": "💃", "Alternative": "🎭", "Indie Pop": "🌿",
  "Classical": "🎻", "Soul": "💕", "Funk": "🕺", "Reggae": "🌴",
  "Latin": "🌶️", "K-Pop": "✨", "Gospel": "🙏", "Metal": "🤘",
};

function genreColors(genre: string): [string, string] {
  for (const key of Object.keys(GENRE_COLORS)) {
    if (genre.toLowerCase().includes(key.toLowerCase())) return GENRE_COLORS[key];
  }
  return ["#5E5CE6", "#BF5AF2"];
}
function genreEmoji(genre: string): string {
  for (const key of Object.keys(GENRE_EMOJI)) {
    if (genre.toLowerCase().includes(key.toLowerCase())) return GENRE_EMOJI[key];
  }
  return "🎵";
}

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.round(s) % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

interface ItunesTrack {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName: string;
  previewUrl?: string;
  artworkUrl100?: string;
  trackTimeMillis?: number;
  primaryGenreName: string;
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

  const [source, setSource] = useState<"vibebeats" | "itunes">("itunes");
  const [step, setStep] = useState<"pick" | "configure">("pick");
  const [activeMood, setActiveMood] = useState("All");
  const [selectedTrack, setSelectedTrack] = useState<BaseTrack | null>(null);

  const [clipStart, setClipStart] = useState(0);
  const [clipLength, setClipLength] = useState(20);
  const [playMode, setPlayMode] = useState<MusicPlayMode>("once");
  const [delaySeconds, setDelaySeconds] = useState(3);

  const [itunesQuery, setItunesQuery] = useState("");
  const [itunesResults, setItunesResults] = useState<ItunesTrack[]>([]);
  const [itunesLoading, setItunesLoading] = useState(false);
  const [itunesSearched, setItunesSearched] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [barWidth, setBarWidth] = useState(0);

  const filtered = activeMood === "All" ? MUSIC_LIBRARY : MUSIC_LIBRARY.filter((t) => t.mood === activeMood);

  const clipEnd = Math.min(clipStart + clipLength, selectedTrack?.duration ?? 9999);
  const actualClipLen = clipEnd - clipStart;
  const maxStart = selectedTrack ? Math.max(0, selectedTrack.duration - clipLength) : 0;

  const searchItunes = useCallback(async (query: string) => {
    if (!query.trim()) {
      setItunesResults([]);
      setItunesSearched(false);
      return;
    }
    setItunesLoading(true);
    try {
      const encoded = encodeURIComponent(query.trim());
      const url = `https://itunes.apple.com/search?term=${encoded}&media=music&entity=song&limit=30&country=US`;
      const res = await fetch(url);
      const json = await res.json();
      const results: ItunesTrack[] = (json.results || []).filter((r: any) => r.previewUrl);
      setItunesResults(results);
      setItunesSearched(true);
    } catch {
      setItunesResults([]);
      setItunesSearched(true);
    } finally {
      setItunesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (itunesQuery.length > 1) {
      searchTimeout.current = setTimeout(() => searchItunes(itunesQuery), 600);
    } else {
      setItunesResults([]);
      setItunesSearched(false);
    }
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [itunesQuery]);

  const handleItunesSelect = (item: ItunesTrack) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const durationSec = item.trackTimeMillis ? Math.floor(item.trackTimeMillis / 1000) : 30;
    const track: BaseTrack = {
      id: `itunes-${item.trackId}`,
      title: item.trackName,
      artist: item.artistName,
      genre: item.primaryGenreName,
      mood: "iTunes",
      colors: genreColors(item.primaryGenreName),
      emoji: genreEmoji(item.primaryGenreName),
      duration: durationSec,
      uri: item.previewUrl,
      artworkUrl: item.artworkUrl100,
    };
    setSelectedTrack(track);
    setClipStart(0);
    setClipLength(Math.min(20, durationSec));
    setPlayMode("once");
    setDelaySeconds(3);
    setStep("configure");
  };

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
    if (!base) {
      setSelectedTrack(clip);
    } else {
      setSelectedTrack(base);
    }
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
            <View style={[styles.sourceTabs, { borderBottomColor: colors.border }]}>
              <Pressable
                onPress={() => { Haptics.selectionAsync(); setSource("itunes"); }}
                style={[styles.sourceTab, source === "itunes" && { borderBottomColor: "#BF5AF2", borderBottomWidth: 2 }]}
              >
                <Ionicons name="logo-apple" size={15} color={source === "itunes" ? "#BF5AF2" : colors.textSecondary} />
                <Text style={[styles.sourceTabText, { color: source === "itunes" ? "#BF5AF2" : colors.textSecondary }]}>
                  iTunes Search
                </Text>
              </Pressable>
              <Pressable
                onPress={() => { Haptics.selectionAsync(); setSource("vibebeats"); }}
                style={[styles.sourceTab, source === "vibebeats" && { borderBottomColor: "#BF5AF2", borderBottomWidth: 2 }]}
              >
                <Ionicons name="musical-notes" size={15} color={source === "vibebeats" ? "#BF5AF2" : colors.textSecondary} />
                <Text style={[styles.sourceTabText, { color: source === "vibebeats" ? "#BF5AF2" : colors.textSecondary }]}>
                  VibeBeats
                </Text>
              </Pressable>
            </View>

            {recentClips.length > 0 && (
              <View style={[styles.quickAddSection, { borderBottomColor: colors.border }]}>
                <View style={styles.quickAddHeader}>
                  <Ionicons name="flash" size={14} color="#FF9F0A" />
                  <Text style={[styles.quickAddTitle, { color: colors.text }]}>Recent</Text>
                  <Text style={[styles.quickAddSub, { color: colors.textSecondary }]}>Tap to reuse · Hold to remove</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickAddRow}>
                  {recentClips.map((clip, i) => {
                    const clipLen = Math.round((clip.clipEnd ?? clip.duration) - (clip.clipStart ?? 0));
                    const modeLabels: Record<string, string> = { once: "1x", loop: "∞", delayed: `+${clip.delaySeconds ?? 0}s` };
                    const isItunesClip = clip.id.startsWith("itunes-");
                    return (
                      <Pressable
                        key={`${clip.id}-${i}`}
                        onPress={() => handleQuickAttach(clip)}
                        onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); removeClip(clip); }}
                        delayLongPress={500}
                        style={styles.quickCard}
                      >
                        {isItunesClip && clip.artworkUrl ? (
                          <View style={styles.quickCardGradient}>
                            <Image source={{ uri: clip.artworkUrl }} style={StyleSheet.absoluteFillObject} blurRadius={3} />
                            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.35)", borderRadius: 14 }]} />
                            <View style={styles.quickCardTop}>
                              <Text style={styles.quickCardEmoji}>{clip.emoji}</Text>
                              <View style={styles.quickModeBadge}>
                                <Text style={styles.quickModeBadgeText}>{modeLabels[clip.playMode]}</Text>
                              </View>
                            </View>
                            <Text style={styles.quickCardTitle} numberOfLines={1}>{clip.title}</Text>
                            <Text style={styles.quickCardClip}>{clipLen}s · iTunes</Text>
                            <Pressable onPress={() => handleQuickConfigure(clip)} hitSlop={6} style={styles.quickEditBtn}>
                              <Ionicons name="create-outline" size={11} color="rgba(255,255,255,0.75)" />
                            </Pressable>
                          </View>
                        ) : (
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
                            <Pressable onPress={() => handleQuickConfigure(clip)} hitSlop={6} style={styles.quickEditBtn}>
                              <Ionicons name="create-outline" size={11} color="rgba(255,255,255,0.75)" />
                            </Pressable>
                          </LinearGradient>
                        )}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {source === "itunes" ? (
              <View style={styles.itunesContainer}>
                <View style={[styles.itunesSearchBar, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                  <Ionicons name="search" size={16} color={colors.textSecondary} />
                  <TextInput
                    style={[styles.itunesInput, { color: colors.text }]}
                    placeholder="Search artist, song, or album…"
                    placeholderTextColor={colors.textTertiary}
                    value={itunesQuery}
                    onChangeText={setItunesQuery}
                    autoCorrect={false}
                    returnKeyType="search"
                    onSubmitEditing={() => searchItunes(itunesQuery)}
                  />
                  {itunesQuery.length > 0 && (
                    <Pressable onPress={() => { setItunesQuery(""); setItunesResults([]); setItunesSearched(false); }} hitSlop={8}>
                      <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
                    </Pressable>
                  )}
                </View>

                {itunesLoading ? (
                  <View style={styles.itunesCenter}>
                    <ActivityIndicator color="#BF5AF2" size="large" />
                    <Text style={[styles.itunesHint, { color: colors.textSecondary }]}>Searching iTunes…</Text>
                  </View>
                ) : itunesSearched && itunesResults.length === 0 ? (
                  <View style={styles.itunesCenter}>
                    <Ionicons name="musical-note-outline" size={48} color={colors.textTertiary} />
                    <Text style={[styles.itunesHint, { color: colors.textSecondary }]}>No results found</Text>
                    <Text style={[styles.itunesHintSub, { color: colors.textTertiary }]}>Try a different search</Text>
                  </View>
                ) : !itunesSearched ? (
                  <View style={styles.itunesCenter}>
                    <Ionicons name="logo-apple" size={52} color={colors.textTertiary} />
                    <Text style={[styles.itunesHint, { color: colors.textSecondary }]}>Search any artist or song</Text>
                    <Text style={[styles.itunesHintSub, { color: colors.textTertiary }]}>
                      Sends a 30-second iTunes preview with your message
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={itunesResults}
                    keyExtractor={(item) => String(item.trackId)}
                    contentContainerStyle={styles.itunesList}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => {
                      const durationSec = item.trackTimeMillis ? Math.floor(item.trackTimeMillis / 1000) : 30;
                      const gc = genreColors(item.primaryGenreName);
                      return (
                        <Pressable
                          onPress={() => handleItunesSelect(item)}
                          style={({ pressed }) => [
                            styles.itunesRow,
                            { backgroundColor: pressed ? colors.surfaceSecondary : colors.surface },
                          ]}
                        >
                          <View style={[styles.itunesArtworkWrap, { borderColor: colors.border }]}>
                            {item.artworkUrl100 ? (
                              <Image source={{ uri: item.artworkUrl100 }} style={styles.itunesArtwork} />
                            ) : (
                              <LinearGradient colors={gc} style={styles.itunesArtwork}>
                                <Text style={{ fontSize: 22 }}>{genreEmoji(item.primaryGenreName)}</Text>
                              </LinearGradient>
                            )}
                          </View>
                          <View style={styles.itunesTrackInfo}>
                            <Text style={[styles.itunesTrackName, { color: colors.text }]} numberOfLines={1}>
                              {item.trackName}
                            </Text>
                            <Text style={[styles.itunesArtistName, { color: colors.textSecondary }]} numberOfLines={1}>
                              {item.artistName}
                            </Text>
                            <Text style={[styles.itunesAlbum, { color: colors.textTertiary }]} numberOfLines={1}>
                              {item.collectionName} · {fmtTime(durationSec)}
                            </Text>
                          </View>
                          <View style={[styles.itunesGenreTag, { backgroundColor: gc[0] + "20" }]}>
                            <Text style={[styles.itunesGenreText, { color: gc[0] }]} numberOfLines={1}>
                              {item.primaryGenreName.split("/")[0]}
                            </Text>
                          </View>
                          <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                        </Pressable>
                      );
                    }}
                  />
                )}
              </View>
            ) : (
              <>
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
            )}
          </>
        ) : selectedTrack ? (
          <ScrollView contentContainerStyle={styles.configScroll} showsVerticalScrollIndicator={false}>
            {selectedTrack.artworkUrl ? (
              <View style={styles.configTrackBanner}>
                <Image source={{ uri: selectedTrack.artworkUrl }} style={StyleSheet.absoluteFillObject} blurRadius={8} />
                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.45)" }]} />
                <Image source={{ uri: selectedTrack.artworkUrl }} style={styles.configArtworkImg} />
                <View style={styles.configTrackInfo}>
                  <Text style={styles.configTrackTitle} numberOfLines={1}>{selectedTrack.title}</Text>
                  <Text style={styles.configTrackArtist} numberOfLines={1}>{selectedTrack.artist} · {selectedTrack.genre}</Text>
                  <View style={styles.previewBadge}>
                    <Ionicons name="logo-apple" size={11} color="rgba(255,255,255,0.8)" />
                    <Text style={styles.previewBadgeText}>30s iTunes Preview</Text>
                  </View>
                </View>
              </View>
            ) : (
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
            )}

            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Clip Selection</Text>
              <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>
                Tap the bar to set start · Adjust length with presets
              </Text>

              <Pressable
                onPress={(e) => {
                  if (!selectedTrack || !barWidth) return;
                  const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / barWidth));
                  const newStart = Math.round(ratio * selectedTrack.duration);
                  setClipStart(Math.min(newStart, maxStart));
                  Haptics.selectionAsync();
                }}
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
                <View style={[styles.timelineThumb, { left: `${startRatio * 100}%` as any, backgroundColor: "#fff", borderColor: selectedTrack.colors[0] }]} />
                <View style={[styles.timelineThumb, { left: `${Math.min((startRatio + lengthRatio) * 100, 100)}%` as any, backgroundColor: "#fff", borderColor: selectedTrack.colors[1] }]} />
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
                  {[-10, -5].map((d) => (
                    <Pressable key={d} onPress={() => nudgeStart(d)} style={[styles.stepperBtn, { backgroundColor: colors.surfaceSecondary }]}>
                      <Text style={[styles.stepperBtnText, { color: colors.text }]}>{d}s</Text>
                    </Pressable>
                  ))}
                  <Text style={[styles.stepperValue, { color: colors.text }]}>{fmtTime(clipStart)}</Text>
                  {[5, 10].map((d) => (
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
                        style={[styles.presetChip, { backgroundColor: clipLength === p ? selectedTrack.colors[0] : colors.surfaceSecondary }]}
                      >
                        <Text style={[styles.presetChipText, { color: clipLength === p ? "#fff" : colors.textSecondary }]}>{p}s</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>

            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Playback</Text>
              <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>How the clip plays when the message is opened</Text>

              <View style={styles.playModeRow}>
                {(["once", "loop", "delayed"] as MusicPlayMode[]).map((mode) => {
                  const labels: Record<MusicPlayMode, string> = { once: "Play Once", loop: "Loop", delayed: "Delayed" };
                  const icons: Record<MusicPlayMode, string> = { once: "play-circle", loop: "repeat", delayed: "timer" };
                  const active = playMode === mode;
                  return (
                    <Pressable
                      key={mode}
                      onPress={() => { Haptics.selectionAsync(); setPlayMode(mode); }}
                      style={[styles.playModeChip, { backgroundColor: active ? "#BF5AF2" : colors.surfaceSecondary, borderColor: active ? "#BF5AF2" : colors.border }]}
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
                    <Pressable onPress={() => { Haptics.selectionAsync(); setDelaySeconds((v) => Math.max(1, v - 1)); }} style={[styles.delayBtn, { backgroundColor: colors.surfaceSecondary }]}>
                      <Ionicons name="remove" size={18} color={colors.text} />
                    </Pressable>
                    <Text style={[styles.delayValue, { color: colors.text }]}>{delaySeconds}s</Text>
                    <Pressable onPress={() => { Haptics.selectionAsync(); setDelaySeconds((v) => Math.min(30, v + 1)); }} style={[styles.delayBtn, { backgroundColor: colors.surfaceSecondary }]}>
                      <Ionicons name="add" size={18} color={colors.text} />
                    </Pressable>
                  </View>
                  <Text style={[styles.delayHint, { color: colors.textSecondary }]}>Clip starts {delaySeconds}s after message is opened</Text>
                </View>
              )}
              {playMode === "loop" && (
                <Text style={[styles.playModeHint, { color: colors.textSecondary }]}>Clip loops continuously while the message is open</Text>
              )}
              {playMode === "once" && (
                <Text style={[styles.playModeHint, { color: colors.textSecondary }]}>Clip plays once automatically when the message is opened</Text>
              )}
            </View>

            <Pressable onPress={handleAttach} style={[styles.attachBtn, { backgroundColor: "#BF5AF2" }]}>
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
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { minWidth: 60 },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: 6 },
  headerTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  headerBtnText: { fontSize: 16, fontFamily: "Inter_400Regular" },
  sourceTabs: {
    flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sourceTab: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 11,
  },
  sourceTabText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  quickAddSection: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 12 },
  quickAddHeader: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6 },
  quickAddTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  quickAddSub: { fontSize: 11, fontFamily: "Inter_400Regular" },
  quickAddRow: { paddingHorizontal: 14, gap: 10 },
  quickCard: { width: 110, height: 100, borderRadius: 14, overflow: "hidden" },
  quickCardGradient: { flex: 1, padding: 10, borderRadius: 14, justifyContent: "space-between" },
  quickCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  quickCardEmoji: { fontSize: 18 },
  quickModeBadge: { backgroundColor: "rgba(0,0,0,0.3)", borderRadius: 8, paddingHorizontal: 5, paddingVertical: 2 },
  quickModeBadgeText: { color: "#fff", fontSize: 10, fontFamily: "Inter_600SemiBold" },
  quickCardTitle: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },
  quickCardClip: { color: "rgba(255,255,255,0.75)", fontSize: 10, fontFamily: "Inter_400Regular" },
  quickEditBtn: { position: "absolute", bottom: 8, right: 8 },
  itunesContainer: { flex: 1 },
  itunesSearchBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 14, marginVertical: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 14, borderWidth: StyleSheet.hairlineWidth,
  },
  itunesInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", padding: 0 },
  itunesCenter: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingBottom: 60 },
  itunesHint: { fontSize: 15, fontFamily: "Inter_500Medium", textAlign: "center" },
  itunesHintSub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 32 },
  itunesList: { paddingHorizontal: 14, paddingVertical: 8, gap: 4 },
  itunesRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14,
  },
  itunesArtworkWrap: { width: 52, height: 52, borderRadius: 10, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth },
  itunesArtwork: { width: 52, height: 52, alignItems: "center", justifyContent: "center" },
  itunesTrackInfo: { flex: 1 },
  itunesTrackName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  itunesArtistName: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  itunesAlbum: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  itunesGenreTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  itunesGenreText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  moodBar: { maxHeight: 56, flexShrink: 0 },
  moodBarContent: { paddingHorizontal: 14, paddingVertical: 10, gap: 8, alignItems: "center" },
  moodChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 13, paddingVertical: 6, borderRadius: 20 },
  moodEmoji: { fontSize: 14 },
  moodLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  grid: { padding: 14, gap: 12 },
  gridRow: { gap: 12, justifyContent: "space-between" },
  trackCard: { flex: 1, maxWidth: "48%", borderRadius: 18, overflow: "hidden" },
  trackGradient: { padding: 14, minHeight: 140, justifyContent: "space-between" },
  trackEmoji: { fontSize: 30 },
  trackBottom: { gap: 2 },
  trackTitle: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  trackArtist: { color: "rgba(255,255,255,0.8)", fontSize: 11, fontFamily: "Inter_400Regular" },
  trackMeta: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  trackGenre: { color: "rgba(255,255,255,0.65)", fontSize: 10, fontFamily: "Inter_500Medium" },
  trackDuration: { color: "rgba(255,255,255,0.65)", fontSize: 10, fontFamily: "Inter_400Regular" },
  configScroll: { padding: 16, gap: 16, paddingBottom: 48 },
  configTrackBanner: {
    flexDirection: "row", alignItems: "center", gap: 14, padding: 18,
    borderRadius: 18, overflow: "hidden", minHeight: 90,
  },
  configArtworkImg: { width: 56, height: 56, borderRadius: 10 },
  configTrackEmoji: { fontSize: 36 },
  configTrackInfo: { flex: 1 },
  configTrackTitle: { color: "#fff", fontSize: 17, fontFamily: "Inter_700Bold" },
  configTrackArtist: { color: "rgba(255,255,255,0.75)", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  previewBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  previewBadgeText: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontFamily: "Inter_500Medium" },
  section: { borderRadius: 18, padding: 16, borderWidth: StyleSheet.hairlineWidth, gap: 12 },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  sectionSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  timelineBar: { height: 36, borderRadius: 18, overflow: "hidden", position: "relative" },
  timelineClip: { position: "absolute", top: 0, bottom: 0, opacity: 0.7 },
  timelineThumb: { position: "absolute", top: "50%", marginTop: -8, width: 16, height: 16, borderRadius: 8, borderWidth: 2, marginLeft: -8 },
  clipTimeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  clipTimeLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  clipDurationBadge: { fontSize: 12, fontFamily: "Inter_600SemiBold", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  startAdjustRow: { gap: 8 },
  adjLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  stepperRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  stepperBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  stepperBtnText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  stepperValue: { fontSize: 14, fontFamily: "Inter_700Bold", flex: 1, textAlign: "center" },
  presetRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  presetChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12 },
  presetChipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  playModeRow: { flexDirection: "row", gap: 8 },
  playModeChip: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 14, borderWidth: 1 },
  playModeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  delayRow: { paddingTop: 12, gap: 10, borderTopWidth: StyleSheet.hairlineWidth },
  delayControl: { flexDirection: "row", alignItems: "center", gap: 16, justifyContent: "center" },
  delayBtn: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  delayValue: { fontSize: 20, fontFamily: "Inter_700Bold", minWidth: 60, textAlign: "center" },
  delayHint: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
  playModeHint: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
  attachBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, borderRadius: 18 },
  attachBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
});
