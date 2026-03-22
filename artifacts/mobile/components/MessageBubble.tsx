import { Feather, Ionicons } from "@expo/vector-icons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import Colors from "@/constants/colors";
import type { AudioAttachment, ImageAttachment, Message, MessageFormatting, MusicAttachment } from "@/context/MessagingContext";
import type { SkinTheme } from "@/context/SkinContext";
import { useRecentClips } from "@/hooks/useRecentClips";

interface MessageBubbleProps {
  message: Message;
  isMine: boolean;
  showSender?: boolean;
  senderName?: string;
  onLongPress?: () => void;
  onReact?: (emoji: string) => void;
  onVoiceCall?: () => void;
  onVideoCall?: () => void;
  onImageViewed?: (messageId: string) => void;
  myId?: string;
  activeSkin?: SkinTheme;
}

const REACTION_EMOJIS = ["❤️", "😂", "😮", "😢", "🎉", "👍"];

function SecurePhotoMessage({
  image,
  isMine,
  messageId,
  myId,
  onViewed,
  colors,
}: {
  image: ImageAttachment;
  isMine: boolean;
  messageId: string;
  myId?: string;
  onViewed?: (messageId: string) => void;
  colors: typeof Colors.light;
}) {
  const [unlocked, setUnlocked] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [showPwPrompt, setShowPwPrompt] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const alreadyViewed = myId && (image.viewedBy ?? []).includes(myId);
  const isDeleted = image.security === "single-view" && !isMine && alreadyViewed && !image.uri;
  const isTimedLocked = image.security === "timed" && image.viewAfter && Date.now() < image.viewAfter;

  const getTimeRemaining = () => {
    if (!image.viewAfter) return "";
    const diff = image.viewAfter - Date.now();
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const handleUnlock = () => {
    if (image.security === "none") {
      setUnlocked(true);
      onViewed?.(messageId);
    } else if (image.security === "password") {
      setShowPwPrompt(true);
    } else if (image.security === "single-view" && !alreadyViewed) {
      setUnlocked(true);
      onViewed?.(messageId);
    } else if (image.security === "timed" && !isTimedLocked) {
      setUnlocked(true);
      onViewed?.(messageId);
    }
  };

  const handlePwSubmit = () => {
    if (pwInput === image.password) {
      setUnlocked(true);
      setShowPwPrompt(false);
      onViewed?.(messageId);
    } else {
      Alert.alert("Wrong Password", "Incorrect password. Try again.");
      setPwInput("");
    }
  };

  if (isDeleted) {
    return (
      <View style={[photoStyles.container, { backgroundColor: isMine ? "rgba(255,255,255,0.15)" : colors.surfaceSecondary }]}>
        <Ionicons name="eye-off-outline" size={20} color={colors.textTertiary} />
        <Text style={[photoStyles.lockedText, { color: colors.textTertiary }]}>Photo deleted after viewing</Text>
      </View>
    );
  }

  if (unlocked || (isMine && image.security === "none") || (isMine)) {
    return (
      <>
        <Pressable onPress={() => setFullscreen(true)}>
          <Image source={{ uri: image.uri }} style={photoStyles.photo} resizeMode="cover" />
          {image.security !== "none" && (
            <View style={photoStyles.securityBadge}>
              <Ionicons
                name={
                  image.security === "single-view" ? "eye" :
                  image.security === "password" ? "lock-closed" : "timer-outline"
                }
                size={12}
                color="#FFF"
              />
            </View>
          )}
        </Pressable>
        <Modal visible={fullscreen} transparent animationType="fade">
          <Pressable style={photoStyles.fullscreenBg} onPress={() => setFullscreen(false)}>
            <Image source={{ uri: image.uri }} style={photoStyles.fullscreenImg} resizeMode="contain" />
          </Pressable>
        </Modal>
        {showPwPrompt && (
          <Modal transparent animationType="fade">
            <View style={photoStyles.pwBackdrop}>
              <View style={[photoStyles.pwBox, { backgroundColor: colors.surface }]}>
                <Text style={[photoStyles.pwTitle, { color: colors.text }]}>Enter Password</Text>
                <TextInput
                  style={[photoStyles.pwInput, { backgroundColor: colors.surfaceSecondary, color: colors.text }]}
                  value={pwInput}
                  onChangeText={setPwInput}
                  placeholder="Password..."
                  placeholderTextColor={colors.textTertiary}
                  secureTextEntry
                  autoFocus
                />
                <Pressable onPress={handlePwSubmit} style={[photoStyles.pwBtn, { backgroundColor: colors.primary }]}>
                  <Text style={photoStyles.pwBtnText}>Unlock</Text>
                </Pressable>
              </View>
            </View>
          </Modal>
        )}
      </>
    );
  }

  return (
    <>
      <Pressable onPress={handleUnlock} style={[photoStyles.locked, { backgroundColor: isMine ? "rgba(255,255,255,0.15)" : colors.surfaceSecondary }]}>
        <Ionicons
          name={
            isTimedLocked ? "timer-outline" :
            image.security === "password" ? "lock-closed" :
            image.security === "single-view" ? "eye" : "image-outline"
          }
          size={24}
          color={isMine ? "rgba(255,255,255,0.8)" : colors.textSecondary}
        />
        <Text style={[photoStyles.lockedText, { color: isMine ? "rgba(255,255,255,0.8)" : colors.textSecondary }]}>
          {isTimedLocked
            ? `Available in ${getTimeRemaining()}`
            : image.security === "password"
            ? "Tap to enter password"
            : image.security === "single-view"
            ? "Tap to view (once)"
            : "Tap to view"}
        </Text>
      </Pressable>
      {showPwPrompt && (
        <Modal transparent animationType="fade">
          <View style={photoStyles.pwBackdrop}>
            <View style={[photoStyles.pwBox, { backgroundColor: colors.surface }]}>
              <Text style={[photoStyles.pwTitle, { color: colors.text }]}>Enter Password</Text>
              <TextInput
                style={[photoStyles.pwInput, { backgroundColor: colors.surfaceSecondary, color: colors.text }]}
                value={pwInput}
                onChangeText={setPwInput}
                placeholder="Password..."
                placeholderTextColor={colors.textTertiary}
                secureTextEntry
                autoFocus
              />
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable onPress={() => setShowPwPrompt(false)} style={[photoStyles.pwBtn, { backgroundColor: colors.surfaceSecondary, flex: 1 }]}>
                  <Text style={[photoStyles.pwBtnText, { color: colors.text }]}>Cancel</Text>
                </Pressable>
                <Pressable onPress={handlePwSubmit} style={[photoStyles.pwBtn, { backgroundColor: colors.primary, flex: 1 }]}>
                  <Text style={photoStyles.pwBtnText}>Unlock</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

const photoStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    marginBottom: 6,
  },
  photo: {
    width: 200,
    height: 160,
    borderRadius: 12,
    marginBottom: 6,
  },
  securityBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 10,
    padding: 4,
  },
  locked: {
    width: 200,
    height: 120,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 6,
  },
  lockedText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    paddingHorizontal: 12,
  },
  fullscreenBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    alignItems: "center",
    justifyContent: "center",
  },
  fullscreenImg: {
    width: "100%",
    height: "100%",
  },
  pwBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  pwBox: {
    width: 280,
    borderRadius: 20,
    padding: 24,
    gap: 14,
  },
  pwTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  pwInput: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  pwBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  pwBtnText: {
    color: "#FFF",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});

function MusicReelBar({ music, isMine }: { music: MusicAttachment; isMine: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [saved, setSaved] = useState(false);
  const spinAnim = useRef(new Animated.Value(0)).current;
  const { saveClip, recentClips } = useRecentClips();
  const spinLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const stopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clipDuration = (music.clipEnd ?? music.duration) - (music.clipStart ?? 0);

  const clipDurationMs = clipDuration * 1000;
  const playModeRef = useRef(music.playMode);
  const delaySecondsRef = useRef(music.delaySeconds ?? 0);
  playModeRef.current = music.playMode;
  delaySecondsRef.current = music.delaySeconds ?? 0;

  useEffect(() => {
    const doPlay = () => {
      setPlaying(true);
      spinLoopRef.current?.stop();
      spinLoopRef.current = Animated.loop(
        Animated.timing(spinAnim, { toValue: 1, duration: 2000, useNativeDriver: true })
      );
      spinLoopRef.current.start();

      if (playModeRef.current !== "loop") {
        stopRef.current = setTimeout(() => {
          setPlaying(false);
          spinLoopRef.current?.stop();
          Animated.timing(spinAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
        }, clipDurationMs);
      }
    };

    if (playModeRef.current === "delayed" && delaySecondsRef.current > 0) {
      delayRef.current = setTimeout(doPlay, delaySecondsRef.current * 1000);
    } else {
      doPlay();
    }

    return () => {
      if (stopRef.current) clearTimeout(stopRef.current);
      if (delayRef.current) clearTimeout(delayRef.current);
      spinLoopRef.current?.stop();
    };
  }, []);

  const alreadySaved = recentClips.some(
    (c) =>
      c.id === music.id &&
      c.clipStart === music.clipStart &&
      c.clipEnd === music.clipEnd &&
      c.playMode === music.playMode &&
      c.delaySeconds === music.delaySeconds
  );

  useEffect(() => {
    if (alreadySaved) setSaved(true);
  }, [alreadySaved]);

  const handleSave = () => {
    if (saved) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    saveClip(music);
    setSaved(true);
  };

  function fmtTime(s: number) {
    const m = Math.floor(s / 60);
    const sec = Math.round(s) % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  const modeIcon: Record<string, any> = { once: "play-circle-outline", loop: "repeat", delayed: "timer-outline" };
  const modeLabel: Record<string, string> = {
    once: "Once",
    loop: "Loop",
    delayed: `+${music.delaySeconds ?? 0}s`,
  };

  return (
    <View style={styles.reelBar}>
      <Animated.View style={{ transform: [{ rotate: spin }] }}>
        <View style={[styles.reelDisc, { backgroundColor: "rgba(255,255,255,0.22)" }]}>
          <Ionicons name="musical-note" size={11} color="#fff" />
        </View>
      </Animated.View>
      <View style={styles.reelInfo}>
        <Text style={styles.reelTitle} numberOfLines={1}>
          {music.emoji} {music.title} — {music.artist}
        </Text>
        <Text style={styles.reelClip}>
          {fmtTime(music.clipStart ?? 0)}–{fmtTime(music.clipEnd ?? music.duration)} · {Math.round(clipDuration)}s
        </Text>
      </View>
      <View style={styles.reelModeTag}>
        <Ionicons name={modeIcon[music.playMode]} size={10} color="rgba(255,255,255,0.85)" />
        <Text style={styles.reelModeText}>{modeLabel[music.playMode]}</Text>
      </View>
      {playing && (
        <View style={styles.reelEqRow}>
          {[220, 300, 180].map((d, i) => (
            <ReelEqBar key={i} duration={d} />
          ))}
        </View>
      )}
      {!isMine && (
        <Pressable onPress={handleSave} hitSlop={8} style={styles.reelSaveBtn}>
          <Ionicons
            name={saved ? "bookmark" : "bookmark-outline"}
            size={14}
            color={saved ? "#FFD60A" : "rgba(255,255,255,0.7)"}
          />
        </Pressable>
      )}
    </View>
  );
}

function ReelEqBar({ duration }: { duration: number }) {
  const anim = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.3, duration, useNativeDriver: true }),
      ])
    ).start();
    return () => anim.stopAnimation();
  }, []);
  return <Animated.View style={[styles.reelEqBar, { transform: [{ scaleY: anim }] }]} />;
}

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
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isPlaying = status.playing;
  const position = status.currentTime ?? 0;
  const startTime = audio.startTime ?? 0;
  const endTime = audio.endTime;
  const clipDuration = endTime !== undefined ? endTime - startTime : (status.duration ?? audio.duration ?? 0);
  const duration = clipDuration;
  const clipPosition = Math.max(0, position - startTime);

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

  useEffect(() => {
    return () => {
      if (stopTimer.current) clearTimeout(stopTimer.current);
    };
  }, []);

  const togglePlay = () => {
    try {
      if (isPlaying) {
        player.pause();
        if (stopTimer.current) clearTimeout(stopTimer.current);
      } else {
        if (startTime > 0) player.seekTo(startTime);
        player.play();
        if (endTime !== undefined) {
          const remaining = (endTime - startTime) * 1000;
          stopTimer.current = setTimeout(() => {
            player.pause();
          }, remaining);
        }
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

  const textColor = isMine ? colors.messageTextSent : colors.messageTextReceived;
  const mutedColor = isMine ? "rgba(255,255,255,0.7)" : colors.textSecondary;
  const bgColor = isMine ? "rgba(255,255,255,0.2)" : colors.surfaceSecondary;
  const accentColor = isMine ? "#FFFFFF" : colors.audioAccent;
  const progress = duration > 0 ? clipPosition / duration : 0;

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
            {isPlaying ? formatTime(clipPosition) : formatTime(duration)}
          </Text>
        </View>
      </View>
    </View>
  );
}

function CallActionBar({
  visible,
  isMine,
  onVoiceCall,
  onVideoCall,
  colors,
}: {
  visible: boolean;
  isMine: boolean;
  onVoiceCall?: () => void;
  onVideoCall?: () => void;
  colors: typeof Colors.light;
}) {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 180,
          friction: 12,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 120,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-8, 0],
  });

  return (
    <Animated.View
      style={[
        styles.callBar,
        isMine ? styles.callBarRight : styles.callBarLeft,
        {
          opacity: opacityAnim,
          transform: [{ translateY }],
          backgroundColor: colors.surface,
          borderColor: colors.border,
          shadowColor: colors.shadow,
        },
      ]}
      pointerEvents={visible ? "auto" : "none"}
    >
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onVoiceCall?.();
        }}
        style={({ pressed }) => [
          styles.callBarBtn,
          { backgroundColor: "#30D158" + (pressed ? "40" : "18") },
        ]}
      >
        <Ionicons name="call" size={15} color="#30D158" />
        <Text style={[styles.callBarBtnText, { color: "#30D158" }]}>Voice</Text>
      </Pressable>

      <View style={[styles.callBarDivider, { backgroundColor: colors.border }]} />

      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onVideoCall?.();
        }}
        style={({ pressed }) => [
          styles.callBarBtn,
          { backgroundColor: colors.primary + (pressed ? "40" : "18") },
        ]}
      >
        <Ionicons name="videocam" size={15} color={colors.primary} />
        <Text style={[styles.callBarBtnText, { color: colors.primary }]}>Video</Text>
      </Pressable>
    </Animated.View>
  );
}

export function MessageBubble({
  message,
  isMine,
  showSender,
  senderName,
  onLongPress,
  onReact,
  onVoiceCall,
  onVideoCall,
  onImageViewed,
  myId,
  activeSkin,
}: MessageBubbleProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const [showReactions, setShowReactions] = useState(false);
  const [showCallBar, setShowCallBar] = useState(false);
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const bubbleScale = useRef(new Animated.Value(0.9)).current;
  const bubbleOpacity = useRef(new Animated.Value(0)).current;

  const hasCallHandlers = !isMine && (onVoiceCall || onVideoCall);

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

  const handlePress = useCallback(() => {
    if (!hasCallHandlers) return;
    setShowCallBar((v) => !v);
    if (showReactions) setShowReactions(false);
  }, [hasCallHandlers, showReactions]);

  const handleLongPress = useCallback(() => {
    setShowReactions(true);
    setShowCallBar(false);
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

  const handleDismiss = useCallback(() => {
    setShowCallBar(false);
    setShowReactions(false);
    scaleAnim.setValue(0);
  }, [scaleAnim]);

  const time = new Date(message.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const fmt = message.formatting;
  const hasGifBg = !!fmt?.backgroundGifUrl;
  const hasMusicBg = !!message.musicAttachment && !hasGifBg;
  const skinSentText = activeSkin?.textOnSent ?? colors.messageTextSent;
  const skinReceivedText = activeSkin?.textOnReceived ?? colors.messageTextReceived;
  const skinReceivedBg = activeSkin?.receivedBubble ?? colors.messageReceived;
  const bubbleBg = hasGifBg ? "transparent" : (isMine ? colors.messageSent : skinReceivedBg);
  const defaultTextColor = isMine ? skinSentText : skinReceivedText;
  const textColor = hasMusicBg ? "#FFFFFF" : (fmt?.textColor || (hasGifBg ? "#FFFFFF" : defaultTextColor));
  const mutedText = (hasGifBg || hasMusicBg) ? "rgba(255,255,255,0.75)" : (isMine ? "rgba(255,255,255,0.7)" : colors.textSecondary);
  const sentBubbleColors = activeSkin ? activeSkin.sentBubble : null;
  const musicBubbleColors = message.musicAttachment?.colors ?? null;

  const FONT_SIZE_VALUES: Record<string, number> = { sm: 11, md: 16, lg: 20, xl: 26 };
  const resolvedFontSize = fmt?.fontSize ? FONT_SIZE_VALUES[fmt.fontSize] : 16;
  const resolvedFontFamily = fmt?.bold ? "Inter_700Bold" : "Inter_400Regular";

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
      {(showReactions || showCallBar) && (
        <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss} />
      )}

      {showSender && senderName && !isMine && (
        <Text style={[styles.senderName, { color: colors.primary }]}>
          {senderName}
        </Text>
      )}

      <Pressable
        onPress={handlePress}
        onLongPress={handleLongPress}
        delayLongPress={300}
      >
        {hasMusicBg ? (
          <LinearGradient
            colors={musicBubbleColors as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.bubble, isMine ? styles.myBubble : styles.theirBubble]}
          >
            {message.imageAttachment && (
              <SecurePhotoMessage image={message.imageAttachment} isMine={isMine} messageId={message.id} myId={myId} onViewed={onImageViewed} colors={colors} />
            )}
            {message.audioAttachment && (
              <AudioPlayer audio={message.audioAttachment} isMine={isMine} colors={colors} />
            )}
            {message.text ? (
              <Text style={[styles.messageText, { color: "#fff", fontSize: resolvedFontSize, fontFamily: resolvedFontFamily }, fmt?.italic && { fontStyle: "italic" }, fmt?.underline && { textDecorationLine: "underline" }]}>
                {message.text}
              </Text>
            ) : null}
            <View style={[styles.reelSeparator, { backgroundColor: "rgba(255,255,255,0.2)" }]} />
            <MusicReelBar music={message.musicAttachment!} isMine={isMine} />
            <View style={styles.metaRow}>
              <View style={isMine ? styles.metaRight : styles.metaLeft}>
                <Text style={[styles.timestamp, { color: "rgba(255,255,255,0.7)" }]}>{time}</Text>
                {isMine && (
                  <Ionicons name="checkmark-done" size={14} color={message.read ? "#64D2FF" : "rgba(255,255,255,0.5)"} style={{ marginLeft: 4 }} />
                )}
              </View>
            </View>
          </LinearGradient>
        ) : isMine && sentBubbleColors && !hasGifBg ? (
          <LinearGradient
            colors={sentBubbleColors as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.bubble, styles.myBubble]}
          >
            {message.imageAttachment && (
              <SecurePhotoMessage image={message.imageAttachment} isMine={isMine} messageId={message.id} myId={myId} onViewed={onImageViewed} colors={colors} />
            )}
            {message.audioAttachment && (
              <AudioPlayer audio={message.audioAttachment} isMine={isMine} colors={colors} />
            )}
            {message.text ? (
              <Text style={[styles.messageText, { color: activeSkin?.textOnSent ?? colors.messageTextSent, fontSize: resolvedFontSize, fontFamily: resolvedFontFamily }, fmt?.italic && { fontStyle: "italic" }, fmt?.underline && { textDecorationLine: "underline" }]}>
                {message.text}
              </Text>
            ) : null}
            <View style={styles.metaRow}>
              <View style={styles.metaRight}>
                <Text style={[styles.timestamp, { color: mutedText }]}>{time}</Text>
                <Ionicons name="checkmark-done" size={14} color={message.read ? "#64D2FF" : "rgba(255,255,255,0.6)"} style={{ marginLeft: 4 }} />
              </View>
            </View>
          </LinearGradient>
        ) : (
        <View
          style={[
            styles.bubble,
            { backgroundColor: hasGifBg ? (isMine ? colors.messageSent : colors.messageReceived) : bubbleBg },
            isMine ? styles.myBubble : styles.theirBubble,
            hasGifBg && styles.gifBubble,
          ]}
        >
          {hasGifBg && fmt?.backgroundGifUrl && (
            <ExpoImage source={{ uri: fmt.backgroundGifUrl }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
          )}
          {hasGifBg && <View style={styles.gifOverlay} />}
          {message.imageAttachment && (
            <SecurePhotoMessage image={message.imageAttachment} isMine={isMine} messageId={message.id} myId={myId} onViewed={onImageViewed} colors={colors} />
          )}
          {message.audioAttachment && (
            <AudioPlayer audio={message.audioAttachment} isMine={isMine} colors={colors} />
          )}
          {message.text ? (
            <Text style={[styles.messageText, { color: textColor, fontSize: resolvedFontSize, fontFamily: resolvedFontFamily }, fmt?.italic && { fontStyle: "italic" }, fmt?.underline && { textDecorationLine: "underline" }]}>
              {message.text}
            </Text>
          ) : null}
          <View style={styles.metaRow}>
            <View style={isMine ? styles.metaRight : styles.metaLeft}>
              <Text style={[styles.timestamp, { color: mutedText }]}>{time}</Text>
              {isMine && (
                <Ionicons name="checkmark-done" size={14} color={message.read ? "#64D2FF" : "rgba(255,255,255,0.6)"} style={{ marginLeft: 4 }} />
              )}
            </View>
            {hasCallHandlers && (
              <Pressable onPress={handlePress} hitSlop={10} style={styles.callIndicator}>
                <Ionicons name="call-outline" size={12} color={showCallBar ? colors.primary : mutedText} />
              </Pressable>
            )}
          </View>
        </View>
        )}

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

      {hasCallHandlers && (
        <CallActionBar
          visible={showCallBar}
          isMine={isMine}
          onVoiceCall={() => {
            setShowCallBar(false);
            onVoiceCall?.();
          }}
          onVideoCall={() => {
            setShowCallBar(false);
            onVideoCall?.();
          }}
          colors={colors}
        />
      )}

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
  gifBubble: {
    overflow: "hidden",
    minWidth: 180,
    minHeight: 80,
  },
  gifOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.32)",
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
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    gap: 8,
  },
  metaRight: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    flex: 1,
  },
  metaLeft: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    flex: 1,
  },
  callIndicator: {
    opacity: 0.7,
  },
  timestamp: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  callBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 6,
    overflow: "hidden",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  callBarLeft: {
    alignSelf: "flex-start",
  },
  callBarRight: {
    alignSelf: "flex-end",
  },
  callBarBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  callBarBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  callBarDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
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
  reelSeparator: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 6,
    marginHorizontal: -4,
  },
  reelBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
    marginBottom: 2,
  },
  reelDisc: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  reelInfo: {
    flex: 1,
    gap: 1,
  },
  reelTitle: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  reelClip: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
  reelModeTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0,0,0,0.18)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    flexShrink: 0,
  },
  reelModeText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  reelEqRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
    height: 16,
    flexShrink: 0,
  },
  reelEqBar: {
    width: 3,
    height: 14,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderRadius: 2,
  },
  reelSaveBtn: {
    padding: 4,
    flexShrink: 0,
  },
});
