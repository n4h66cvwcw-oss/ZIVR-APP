import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCall } from "@/context/CallContext";
import { Avatar } from "@/components/Avatar";

const { width, height } = Dimensions.get("window");

function useCallTimer(startedAt?: number, active?: boolean) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active || !startedAt) return;
    const update = () => setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [active, startedAt]);
  return elapsed;
}

function formatDuration(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function PulseRing({ delay }: { delay: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFillObject,
        {
          borderRadius: 100,
          borderWidth: 2,
          borderColor: "rgba(255,255,255,0.3)",
          transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.5] }) }],
          opacity: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.6, 0] }),
        },
      ]}
    />
  );
}

function CallButton({
  icon,
  label,
  onPress,
  active,
  danger,
  size = 64,
  iconSize = 26,
}: {
  icon: string;
  label?: string;
  onPress: () => void;
  active?: boolean;
  danger?: boolean;
  size?: number;
  iconSize?: number;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 0.88, useNativeDriver: true, tension: 200, friction: 10 }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 200, friction: 10 }),
    ]).start();
    onPress();
  };

  const bgColor = danger
    ? "#FF3B30"
    : active
    ? "rgba(255,255,255,0.95)"
    : "rgba(255,255,255,0.18)";
  const iconColor = danger ? "#FFF" : active ? "#1C1C1E" : "#FFF";

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable onPress={handlePress} style={styles.callBtnWrapper}>
        <View style={[styles.callBtn, { width: size, height: size, borderRadius: size / 2, backgroundColor: bgColor }]}>
          <Ionicons name={icon as any} size={iconSize} color={iconColor} />
        </View>
        {label && <Text style={styles.callBtnLabel}>{label}</Text>}
      </Pressable>
    </Animated.View>
  );
}

function KeypadModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [digits, setDigits] = useState("");
  if (!visible) return null;
  return (
    <View style={styles.keypadOverlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={styles.keypadContainer}>
        <Text style={styles.keypadDisplay}>{digits || " "}</Text>
        <View style={styles.keypadGrid}>
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((d) => (
            <Pressable
              key={d}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setDigits((p) => p + d);
              }}
              style={({ pressed }) => [
                styles.keypadKey,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Text style={styles.keypadKeyText}>{d}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={onClose} style={styles.keypadClose}>
          <Text style={styles.keypadCloseText}>Hide</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function CallScreen() {
  const { id: contactId, name: contactName, type: callType } = useLocalSearchParams<{
    id: string;
    name: string;
    type: string;
  }>();
  const insets = useSafeAreaInsets();
  const {
    activeCall,
    endCall,
    isMuted,
    isSpeaker,
    isVideoOff,
    isHeld,
    toggleMute,
    toggleSpeaker,
    toggleVideo,
    toggleHold,
  } = useCall();

  const isVideo = callType === "video";
  const isActive = activeCall?.status === "active";
  const isOutgoing = activeCall?.direction === "outgoing";
  const elapsed = useCallTimer(activeCall?.startedAt, isActive);
  const [showKeypad, setShowKeypad] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, []);

  const handleEnd = async () => {
    await endCall();
    router.back();
  };

  const statusText = isHeld
    ? "On Hold"
    : isActive
    ? formatDuration(elapsed)
    : activeCall?.status === "connecting"
    ? "Connecting..."
    : isOutgoing
    ? "Calling..."
    : "Incoming Call";

  if (isVideo) {
    return (
      <Animated.View style={[styles.videoContainer, { opacity: fadeAnim }]}>
        <StatusBar barStyle="light-content" />
        <View style={[styles.remoteVideo, { backgroundColor: "#1a1a2e" }]}>
          <View style={styles.remoteAvatarWrap}>
            <Avatar name={contactName || "?"} size={120} />
            {!isActive && (
              <View style={styles.pulseWrap}>
                <PulseRing delay={0} />
                <PulseRing delay={500} />
                <PulseRing delay={1000} />
              </View>
            )}
          </View>
        </View>

        {isActive && !isVideoOff && (
          <View style={[styles.localVideo, { bottom: insets.bottom + 180, right: 16 }]}>
            <View style={styles.localVideoCam}>
              <Avatar name="You" size={36} />
              <Pressable
                onPress={() => setIsFrontCamera((v) => !v)}
                style={styles.flipCamBtn}
              >
                <Ionicons name="camera-reverse" size={16} color="#FFF" />
              </Pressable>
            </View>
          </View>
        )}

        <View style={[styles.videoOverlay, { paddingTop: insets.top + 16 }]}>
          <Text style={styles.videoName}>{contactName}</Text>
          <Text style={styles.videoStatus}>{statusText}</Text>
        </View>

        <View style={[styles.videoControls, { paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.controlRow}>
            <CallButton icon={isMuted ? "mic-off" : "mic"} label={isMuted ? "Unmute" : "Mute"} onPress={toggleMute} active={isMuted} />
            <CallButton icon={isVideoOff ? "videocam-off" : "videocam"} label={isVideoOff ? "Cam Off" : "Camera"} onPress={toggleVideo} active={isVideoOff} />
            <CallButton icon={isSpeaker ? "volume-high" : "volume-medium"} label="Speaker" onPress={toggleSpeaker} active={isSpeaker} />
            <CallButton icon="camera-reverse" label="Flip" onPress={() => setIsFrontCamera((v) => !v)} />
          </View>
          <Pressable onPress={handleEnd} style={styles.endCallBtn}>
            <Ionicons name="call" size={32} color="#FFF" style={{ transform: [{ rotate: "135deg" }] }} />
          </Pressable>
        </View>

        <KeypadModal visible={showKeypad} onClose={() => setShowKeypad(false)} />
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.voiceContainer, { opacity: fadeAnim }]}>
      <StatusBar barStyle="light-content" />
      <View style={[styles.voiceTop, { paddingTop: insets.top + 24 }]}>
        <View style={styles.avatarRingWrap}>
          <Avatar name={contactName || "?"} size={110} />
          {!isActive && (
            <>
              <PulseRing delay={0} />
              <PulseRing delay={600} />
              <PulseRing delay={1200} />
            </>
          )}
        </View>
        <Text style={styles.voiceName}>{contactName}</Text>
        <Text style={styles.voiceStatus}>{statusText}</Text>
        {isActive && isHeld && (
          <View style={styles.heldBadge}>
            <Text style={styles.heldBadgeText}>Call on hold — tap Hold to resume</Text>
          </View>
        )}
      </View>

      <View style={[styles.voiceControls, { paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.controlGrid}>
          <CallButton icon={isMuted ? "mic-off" : "mic"} label={isMuted ? "Unmute" : "Mute"} onPress={toggleMute} active={isMuted} />
          <CallButton icon={isSpeaker ? "volume-high" : "volume-medium"} label="Speaker" onPress={toggleSpeaker} active={isSpeaker} />
          <CallButton icon="keypad" label="Keypad" onPress={() => setShowKeypad(true)} />
          <CallButton icon={isHeld ? "play" : "pause"} label={isHeld ? "Resume" : "Hold"} onPress={toggleHold} active={isHeld} />
          <CallButton
            icon="videocam"
            label="Video"
            onPress={() => {
              endCall();
              router.replace({ pathname: "/call/[id]", params: { id: contactId, name: contactName, type: "video" } });
            }}
          />
          <CallButton
            icon="chatbubble"
            label="Message"
            onPress={() => {
              handleEnd();
            }}
          />
        </View>

        <Pressable onPress={handleEnd} style={styles.endCallBtn}>
          <Ionicons name="call" size={32} color="#FFF" style={{ transform: [{ rotate: "135deg" }] }} />
        </Pressable>
      </View>

      <KeypadModal visible={showKeypad} onClose={() => setShowKeypad(false)} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  voiceContainer: {
    flex: 1,
    backgroundColor: "#0A0E1A",
    justifyContent: "space-between",
  },
  voiceTop: {
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 24,
  },
  avatarRingWrap: {
    width: 130,
    height: 130,
    borderRadius: 65,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  pulseWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  voiceName: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    textAlign: "center",
  },
  voiceStatus: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.7)",
    letterSpacing: 0.3,
  },
  heldBadge: {
    backgroundColor: "rgba(255,159,10,0.2)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,159,10,0.4)",
  },
  heldBadgeText: {
    color: "#FF9F0A",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
  voiceControls: {
    alignItems: "center",
    paddingHorizontal: 24,
    gap: 32,
  },
  controlGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 20,
  },
  controlRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
  },
  callBtnWrapper: {
    alignItems: "center",
    gap: 8,
  },
  callBtn: {
    alignItems: "center",
    justifyContent: "center",
  },
  callBtnLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  endCallBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#FF3B30",
    alignItems: "center",
    justifyContent: "center",
  },
  videoContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  remoteVideo: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  remoteAvatarWrap: {
    width: 150,
    height: 150,
    borderRadius: 75,
    alignItems: "center",
    justifyContent: "center",
  },
  localVideo: {
    position: "absolute",
    width: 90,
    height: 130,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.4)",
  },
  localVideoCam: {
    flex: 1,
    backgroundColor: "#2a2a3e",
    alignItems: "center",
    justifyContent: "center",
  },
  flipCamBtn: {
    position: "absolute",
    bottom: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 12,
    padding: 4,
  },
  videoOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  videoName: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: "#FFF",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  videoStatus: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },
  videoControls: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    gap: 24,
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  keypadOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  keypadContainer: {
    backgroundColor: "#1C1C1E",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 16,
  },
  keypadDisplay: {
    color: "#FFF",
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    letterSpacing: 8,
    minHeight: 40,
  },
  keypadGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 12,
  },
  keypadKey: {
    width: 72,
    height: 56,
    backgroundColor: "#2C2C2E",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  keypadKeyText: {
    color: "#FFF",
    fontSize: 24,
    fontFamily: "Inter_600SemiBold",
  },
  keypadClose: {
    alignItems: "center",
    paddingVertical: 12,
  },
  keypadCloseText: {
    color: "#0A84FF",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
});
