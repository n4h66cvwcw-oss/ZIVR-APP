import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import Colors from "@/constants/colors";
import type { AudioAttachment } from "@/context/MessagingContext";

interface AudioClipEditorProps {
  audio: AudioAttachment;
  onSave: (updated: AudioAttachment) => void;
  onCancel: () => void;
}

const TRACK_WIDTH = 280;
const MAX_CLIP_DURATION = 60;

function fmt(secs: number) {
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AudioClipEditor({ audio, onSave, onCancel }: AudioClipEditorProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;

  const totalDuration = audio.duration ?? 60;
  const [startTime, setStartTime] = useState(audio.startTime ?? 0);
  const [endTime, setEndTime] = useState(
    audio.endTime ?? Math.min(totalDuration, MAX_CLIP_DURATION)
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const clipDuration = endTime - startTime;

  const player = useAudioPlayer({ uri: audio.uri });
  const status = useAudioPlayerStatus(player);

  const startPct = totalDuration > 0 ? startTime / totalDuration : 0;
  const endPct = totalDuration > 0 ? endTime / totalDuration : 1;

  const startX = useRef(new Animated.Value(startPct * TRACK_WIDTH)).current;
  const endX = useRef(new Animated.Value(endPct * TRACK_WIDTH)).current;
  const startXVal = useRef(startPct * TRACK_WIDTH);
  const endXVal = useRef(endPct * TRACK_WIDTH);

  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    startX.setValue(startPct * TRACK_WIDTH);
    endX.setValue(endPct * TRACK_WIDTH);
    startXVal.current = startPct * TRACK_WIDTH;
    endXVal.current = endPct * TRACK_WIDTH;
  }, []);

  useEffect(() => {
    if (!status.playing) setIsPlaying(false);
  }, [status.playing]);

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  const startPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
      onPanResponderMove: (_, gs) => {
        const newX = clamp(startXVal.current + gs.dx, 0, endXVal.current - 20);
        startX.setValue(newX);
        const t = (newX / TRACK_WIDTH) * totalDuration;
        setStartTime(Math.round(t * 10) / 10);
      },
      onPanResponderRelease: (_, gs) => {
        const newX = clamp(startXVal.current + gs.dx, 0, endXVal.current - 20);
        startXVal.current = newX;
        const t = (newX / TRACK_WIDTH) * totalDuration;
        setStartTime(Math.round(t * 10) / 10);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
    })
  ).current;

  const endPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
      onPanResponderMove: (_, gs) => {
        const maxX = Math.min(
          TRACK_WIDTH,
          startXVal.current + (MAX_CLIP_DURATION / totalDuration) * TRACK_WIDTH + 20
        );
        const newX = clamp(endXVal.current + gs.dx, startXVal.current + 20, maxX);
        endX.setValue(newX);
        const t = (newX / TRACK_WIDTH) * totalDuration;
        setEndTime(Math.round(t * 10) / 10);
      },
      onPanResponderRelease: (_, gs) => {
        const maxX = Math.min(
          TRACK_WIDTH,
          startXVal.current + (MAX_CLIP_DURATION / totalDuration) * TRACK_WIDTH + 20
        );
        const newX = clamp(endXVal.current + gs.dx, startXVal.current + 20, maxX);
        endXVal.current = newX;
        const t = (newX / TRACK_WIDTH) * totalDuration;
        setEndTime(Math.round(t * 10) / 10);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
    })
  ).current;

  const previewClip = useCallback(async () => {
    if (isPlaying) {
      player.pause();
      setIsPlaying(false);
      if (stopTimer.current) clearTimeout(stopTimer.current);
      return;
    }
    try {
      player.seekTo(startTime);
      player.play();
      setIsPlaying(true);
      if (stopTimer.current) clearTimeout(stopTimer.current);
      stopTimer.current = setTimeout(() => {
        player.pause();
        setIsPlaying(false);
      }, clipDuration * 1000);
    } catch (e) {
      console.log("Preview error:", e);
    }
  }, [isPlaying, player, startTime, clipDuration]);

  useEffect(() => {
    return () => {
      if (stopTimer.current) clearTimeout(stopTimer.current);
      try { player.pause(); } catch {}
    };
  }, []);

  const handleSave = () => {
    onSave({ ...audio, startTime, endTime, duration: clipDuration });
  };

  const barBg = isDark ? "#2C2C2E" : "#E5E5EA";
  const selectedColor = colors.primary;

  return (
    <Modal transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel} />
      <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
        <View style={styles.handle} />
        <Text style={[styles.title, { color: colors.text }]}>Trim Audio Clip</Text>
        <Text style={[styles.filename, { color: colors.textSecondary }]} numberOfLines={1}>
          {audio.name}
        </Text>

        <View style={styles.timesRow}>
          <View style={styles.timeBox}>
            <Text style={[styles.timeLabel, { color: colors.textTertiary }]}>Start</Text>
            <Text style={[styles.timeValue, { color: colors.primary }]}>{fmt(startTime)}</Text>
          </View>
          <Pressable
            onPress={previewClip}
            style={[styles.previewBtn, { backgroundColor: colors.primary }]}
          >
            <Ionicons
              name={isPlaying ? "pause" : "play"}
              size={20}
              color="#FFF"
            />
            <Text style={styles.previewBtnText}>
              {isPlaying ? "Stop" : "Preview"}
            </Text>
          </Pressable>
          <View style={[styles.timeBox, { alignItems: "flex-end" }]}>
            <Text style={[styles.timeLabel, { color: colors.textTertiary }]}>End</Text>
            <Text style={[styles.timeValue, { color: colors.primary }]}>{fmt(endTime)}</Text>
          </View>
        </View>

        <View style={styles.trackWrap}>
          <View style={[styles.track, { width: TRACK_WIDTH, backgroundColor: barBg }]}>
            <Animated.View
              style={[
                styles.selection,
                {
                  left: startX,
                  width: Animated.subtract(endX, startX),
                  backgroundColor: selectedColor + "40",
                  borderColor: selectedColor,
                },
              ]}
            />
            {Array.from({ length: 32 }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.waveBarBg,
                  {
                    height: 8 + Math.sin(i * 0.7) * 10 + (i % 3) * 3,
                    backgroundColor: isDark ? "#555" : "#C7C7CC",
                  },
                ]}
              />
            ))}
            <Animated.View
              style={[styles.thumb, styles.thumbLeft, { left: startX, borderColor: selectedColor }]}
              {...startPan.panHandlers}
            >
              <View style={[styles.thumbLine, { backgroundColor: selectedColor }]} />
            </Animated.View>
            <Animated.View
              style={[styles.thumb, styles.thumbRight, { left: Animated.subtract(endX, 16), borderColor: selectedColor }]}
              {...endPan.panHandlers}
            >
              <View style={[styles.thumbLine, { backgroundColor: selectedColor }]} />
            </Animated.View>
          </View>
        </View>

        <View style={[styles.durationPill, { backgroundColor: colors.primary + "18" }]}>
          <Ionicons name="time-outline" size={14} color={colors.primary} />
          <Text style={[styles.durationText, { color: colors.primary }]}>
            Clip duration: {fmt(clipDuration)}
            {clipDuration >= MAX_CLIP_DURATION ? " (max)" : ""}
          </Text>
        </View>

        <View style={styles.presets}>
          {[15, 30, 45, 60].map((sec) => (
            <Pressable
              key={sec}
              onPress={() => {
                const newEnd = Math.min(totalDuration, startTime + sec);
                setEndTime(newEnd);
                const newEndX = (newEnd / totalDuration) * TRACK_WIDTH;
                endX.setValue(newEndX);
                endXVal.current = newEndX;
              }}
              style={[
                styles.presetChip,
                {
                  backgroundColor:
                    Math.abs(clipDuration - sec) < 1
                      ? colors.primary
                      : colors.surfaceSecondary,
                },
              ]}
            >
              <Text
                style={[
                  styles.presetText,
                  {
                    color:
                      Math.abs(clipDuration - sec) < 1 ? "#FFF" : colors.textSecondary,
                  },
                ]}
              >
                {sec}s
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={onCancel}
            style={[styles.actionBtn, { backgroundColor: colors.surfaceSecondary }]}
          >
            <Text style={[styles.actionBtnText, { color: colors.text }]}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleSave}
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.actionBtnText, { color: "#FFF" }]}>Use Clip</Text>
          </Pressable>
        </View>
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    gap: 20,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#C7C7CC",
    alignSelf: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  filename: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: -12,
  },
  timesRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timeBox: {
    gap: 2,
    minWidth: 56,
  },
  timeLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  timeValue: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  previewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  previewBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  trackWrap: {
    alignItems: "center",
  },
  track: {
    height: 48,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    overflow: "visible",
    justifyContent: "space-around",
    paddingHorizontal: 4,
  },
  selection: {
    position: "absolute",
    top: 0,
    bottom: 0,
    borderWidth: 2,
    borderRadius: 4,
    zIndex: 1,
  },
  waveBarBg: {
    width: 3,
    borderRadius: 2,
    opacity: 0.6,
  },
  thumb: {
    position: "absolute",
    width: 24,
    height: 60,
    borderRadius: 6,
    borderWidth: 2,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
    top: -6,
  },
  thumbLeft: {},
  thumbRight: {},
  thumbLine: {
    width: 2,
    height: 24,
    borderRadius: 1,
  },
  durationPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "center",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
  },
  durationText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  presets: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
  },
  presetChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  presetText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 14,
  },
  actionBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
