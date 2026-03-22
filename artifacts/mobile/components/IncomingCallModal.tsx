import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCall } from "@/context/CallContext";
import { Avatar } from "@/components/Avatar";

export function IncomingCallModal() {
  const { activeCall, answerCall, declineCall } = useCall();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-200)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const visible =
    activeCall?.status === "incoming" || activeCall?.status === "connecting";

  useEffect(() => {
    if (visible) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 70,
        friction: 10,
      }).start();
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 700,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 700,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      Animated.timing(slideAnim, {
        toValue: -200,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  if (!activeCall || (!visible)) return null;

  const handleAnswer = () => {
    answerCall();
    router.push({
      pathname: "/call/[id]",
      params: {
        id: activeCall.contactId,
        name: activeCall.contactName,
        type: activeCall.type,
      },
    });
  };

  const handleDecline = () => {
    declineCall();
  };

  return (
    <Animated.View
      style={[
        styles.container,
        { top: insets.top + 8, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <View style={styles.card}>
        <View style={styles.left}>
          <Avatar name={activeCall.contactName} size={48} />
          <View style={styles.info}>
            <Text style={styles.label}>
              Incoming {activeCall.type === "video" ? "Video" : "Voice"} Call
            </Text>
            <Text style={styles.name}>{activeCall.contactName}</Text>
          </View>
        </View>
        <View style={styles.buttons}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <Pressable
              onPress={handleDecline}
              style={[styles.btn, styles.declineBtn]}
            >
              <Ionicons
                name="call"
                size={20}
                color="#FFF"
                style={{ transform: [{ rotate: "135deg" }] }}
              />
            </Pressable>
          </Animated.View>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <Pressable
              onPress={handleAnswer}
              style={[styles.btn, styles.acceptBtn]}
            >
              <Ionicons name="call" size={20} color="#FFF" />
            </Pressable>
          </Animated.View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 9999,
    elevation: 9999,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1C1C1E",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 20,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  info: { flex: 1 },
  label: {
    fontSize: 11,
    color: "rgba(255,255,255,0.55)",
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  name: {
    fontSize: 16,
    color: "#FFF",
    fontFamily: "Inter_600SemiBold",
    marginTop: 2,
  },
  buttons: {
    flexDirection: "row",
    gap: 12,
  },
  btn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  declineBtn: { backgroundColor: "#FF3B30" },
  acceptBtn: { backgroundColor: "#30D158" },
});
