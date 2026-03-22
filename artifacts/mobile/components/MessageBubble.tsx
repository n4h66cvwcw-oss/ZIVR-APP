import { Feather, Ionicons } from "@expo/vector-icons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import Colors from "@/constants/colors";
import type { AudioAttachment, Message } from "@/context/MessagingContext";

interface MessageBubbleProps {
  message: Message;
  isMine: boolean;
  showSender?: boolean;
  senderName?: string;
  onLongPress?: () => void;
  onReact?: (emoji: string) => void;
}

const REACTION_EMOJIS = ["❤️", "😂", "😮", "😢", "🎉", "👍"];

function AudioPlayer({
  audio,
  isMine,
  colors,
}: {
  audio: AudioAttachment;
  isMine: boolean;
  colors: typeof Colors.light;
}) {
  const player = useAudioPlayer({ uri: audio.uri });
  const status = useAudioPlayerStatus(player);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const isPlaying = status.playing;
  const position = status.currentTime ?? 0;
  const duration = status.duration ?? audio.duration ?? 0;

  useEffect(() => {
    if (isPlaying) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isPlaying]);

  const togglePlay = () => {
    try {
      if (isPlaying) {
        player.pause();
      } else {
        player.play();
      }
    } catch (e) {
      console.log("Audio error:", e);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const textColor = isMine
    ? colors.messageTextSent
    : colors.messageTextReceived;
  const mutedColor = isMine
    ? "rgba(255,255,255,0.7)"
    : colors.textSecondary;
  const bgColor = isMine ? "rgba(255,255,255,0.2)" : colors.surfaceSecondary;
  const accentColor = isMine ? "#FFFFFF" : colors.audioAccent;
  const progress = duration > 0 ? position / duration : 0;

  return (
    <View style={[styles.audioPlayer, { backgroundColor: bgColor }]}>
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <Pressable
          onPress={togglePlay}
          style={[styles.audioPlayBtn, { backgroundColor: accentColor }]}
        >
          <Ionicons
            name={isPlaying ? "pause" : "play"}
            size={18}
            color={isMine ? colors.primary : "#FFFFFF"}
          />
        </Pressable>
      </Animated.View>

      <View style={styles.audioInfo}>
        <View style={styles.waveformContainer}>
          {Array.from({ length: 20 }).map((_, i) => {
            const barProgress = i / 20;
            const barActive = barProgress <= progress;
            const barHeight = 4 + Math.sin(i * 0.9) * 8 + Math.random() * 4;
            return (
              <View
                key={i}
                style={[
                  styles.waveBar,
                  {
                    height: barHeight,
                    backgroundColor: barActive
                      ? accentColor
                      : isMine
                      ? "rgba(255,255,255,0.35)"
                      : colors.textTertiary,
                  },
                ]}
              />
            );
          })}
        </View>
        <View style={styles.audioMeta}>
          <Text style={[styles.audioName, { color: textColor }]} numberOfLines={1}>
            {audio.name}
          </Text>
          <Text style={[styles.audioDuration, { color: mutedColor }]}>
            {isPlaying ? formatTime(position) : formatTime(duration)}
          </Text>
        </View>
      </View>
    </View>
  );
}

export function MessageBubble({
  message,
  isMine,
  showSender,
  senderName,
  onLongPress,
  onReact,
}: MessageBubbleProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const [showReactions, setShowReactions] = useState(false);
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const bubbleScale = useRef(new Animated.Value(0.9)).current;
  const bubbleOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(bubbleScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }),
      Animated.timing(bubbleOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleLongPress = useCallback(() => {
    setShowReactions(true);
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
    onLongPress?.();
  }, [onLongPress, scaleAnim]);

  const handleReact = useCallback(
    (emoji: string) => {
      setShowReactions(false);
      scaleAnim.setValue(0);
      onReact?.(emoji);
    },
    [onReact, scaleAnim]
  );

  const time = new Date(message.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const bubbleBg = isMine ? colors.messageSent : colors.messageReceived;
  const textColor = isMine ? colors.messageTextSent : colors.messageTextReceived;
  const mutedText = isMine ? "rgba(255,255,255,0.7)" : colors.textSecondary;

  const totalReactions = Object.entries(message.reactions || {}).filter(
    ([, users]) => users.length > 0
  );

  return (
    <Animated.View
      style={[
        styles.container,
        isMine ? styles.myContainer : styles.theirContainer,
        { opacity: bubbleOpacity, transform: [{ scale: bubbleScale }] },
      ]}
    >
      {showReactions && (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => {
            setShowReactions(false);
            scaleAnim.setValue(0);
          }}
        />
      )}

      {showSender && senderName && !isMine && (
        <Text style={[styles.senderName, { color: colors.primary }]}>
          {senderName}
        </Text>
      )}

      <Pressable onLongPress={handleLongPress} delayLongPress={300}>
        <View
          style={[
            styles.bubble,
            { backgroundColor: bubbleBg },
            isMine ? styles.myBubble : styles.theirBubble,
          ]}
        >
          {message.audioAttachment && (
            <AudioPlayer
              audio={message.audioAttachment}
              isMine={isMine}
              colors={colors}
            />
          )}
          {message.text ? (
            <Text style={[styles.messageText, { color: textColor }]}>
              {message.text}
            </Text>
          ) : null}
          <View style={isMine ? styles.metaRight : styles.metaLeft}>
            <Text style={[styles.timestamp, { color: mutedText }]}>{time}</Text>
            {isMine && (
              <Ionicons
                name="checkmark-done"
                size={14}
                color={
                  message.read ? "#64D2FF" : "rgba(255,255,255,0.6)"
                }
                style={{ marginLeft: 4 }}
              />
            )}
          </View>
        </View>

        {totalReactions.length > 0 && (
          <View
            style={[
              styles.reactionsContainer,
              isMine ? styles.reactionsRight : styles.reactionsLeft,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            {totalReactions.map(([emoji, users]) => (
              <Pressable
                key={emoji}
                onPress={() => handleReact(emoji)}
                style={styles.reactionChip}
              >
                <Text style={styles.reactionEmoji}>{emoji}</Text>
                {users.length > 1 && (
                  <Text
                    style={[styles.reactionCount, { color: colors.textSecondary }]}
                  >
                    {users.length}
                  </Text>
                )}
              </Pressable>
            ))}
          </View>
        )}
      </Pressable>

      {showReactions && (
        <Animated.View
          style={[
            styles.reactionPicker,
            isMine ? styles.reactionPickerRight : styles.reactionPickerLeft,
            {
              backgroundColor: colors.surface,
              transform: [{ scale: scaleAnim }],
              shadowColor: colors.shadow,
              shadowOpacity: 0.25,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
            },
          ]}
        >
          {REACTION_EMOJIS.map((emoji) => (
            <Pressable
              key={emoji}
              onPress={() => handleReact(emoji)}
              style={({ pressed }) => [
                styles.reactionOption,
                pressed && { transform: [{ scale: 1.3 }] },
              ]}
            >
              <Text style={styles.reactionOptionEmoji}>{emoji}</Text>
            </Pressable>
          ))}
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    marginBottom: 4,
    maxWidth: "80%",
  },
  myContainer: {
    alignSelf: "flex-end",
  },
  theirContainer: {
    alignSelf: "flex-start",
  },
  bubble: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 60,
  },
  myBubble: {
    borderBottomRightRadius: 6,
  },
  theirBubble: {
    borderBottomLeftRadius: 6,
  },
  senderName: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 4,
    marginLeft: 4,
  },
  messageText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },
  metaRight: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 4,
  },
  metaLeft: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    marginTop: 4,
  },
  timestamp: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  audioPlayer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: 10,
    marginBottom: 6,
    gap: 10,
    minWidth: 200,
  },
  audioPlayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  audioInfo: {
    flex: 1,
  },
  waveformContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: 30,
    gap: 2,
    marginBottom: 4,
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
  },
  audioMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  audioName: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    flex: 1,
    marginRight: 8,
  },
  audioDuration: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  reactionsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
    gap: 4,
  },
  reactionsRight: {
    alignSelf: "flex-end",
  },
  reactionsLeft: {
    alignSelf: "flex-start",
  },
  reactionChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  reactionEmoji: {
    fontSize: 16,
  },
  reactionCount: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginLeft: 3,
  },
  reactionPicker: {
    position: "absolute",
    top: -52,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 24,
    gap: 4,
    zIndex: 100,
    elevation: 10,
  },
  reactionPickerRight: {
    right: 0,
  },
  reactionPickerLeft: {
    left: 0,
  },
  reactionOption: {
    padding: 4,
  },
  reactionOptionEmoji: {
    fontSize: 24,
  },
});
