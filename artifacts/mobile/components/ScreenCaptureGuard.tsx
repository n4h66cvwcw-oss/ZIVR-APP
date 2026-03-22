import { LinearGradient } from "expo-linear-gradient";
import * as ScreenCapture from "expo-screen-capture";
import React, { useEffect, useRef, useState } from "react";
import {
  AppState,
  AppStateStatus,
  Image,
  Modal,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useProfile, AI_GRADIENTS } from "@/context/ProfileContext";

export function ScreenCaptureGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useProfile();
  const [isBlocked, setIsBlocked] = useState(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!profile.captureGuardEnabled) return;

    let removeScreenshotListener: (() => void) | undefined;

    const setup = async () => {
      try {
        if (Platform.OS !== "web") {
          await ScreenCapture.preventScreenCaptureAsync();
          const sub = ScreenCapture.addScreenshotListener(() => {
            setIsBlocked(true);
            setTimeout(() => setIsBlocked(false), 3000);
          });
          removeScreenshotListener = () => sub.remove();
        }
      } catch {}
    };

    setup();

    const sub = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (
        appStateRef.current === "active" &&
        (nextState === "background" || nextState === "inactive")
      ) {
        setIsBlocked(true);
      } else if (nextState === "active") {
        setTimeout(() => setIsBlocked(false), 300);
      }
      appStateRef.current = nextState;
    });

    return () => {
      sub.remove();
      removeScreenshotListener?.();
      try {
        if (Platform.OS !== "web") {
          ScreenCapture.allowScreenCaptureAsync();
        }
      } catch {}
    };
  }, [profile.captureGuardEnabled]);

  return (
    <>
      {children}
      {profile.captureGuardEnabled && isBlocked && <CaptureOverlay />}
    </>
  );
}

function CaptureOverlay() {
  const { profile } = useProfile();

  const gradient =
    AI_GRADIENTS.find((g) => g.id === profile.captureGuardGradientId) ?? AI_GRADIENTS[0];

  const renderContent = () => {
    switch (profile.captureGuardType) {
      case "custom_image":
        return profile.captureGuardImageUri ? (
          <Image
            source={{ uri: profile.captureGuardImageUri }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        ) : (
          <DefaultGradient gradient={gradient} />
        );
      case "custom_text":
        return (
          <DefaultGradient gradient={gradient}>
            <Text style={styles.overlayText}>
              {profile.captureGuardText || "🔒 Screen capture blocked"}
            </Text>
          </DefaultGradient>
        );
      case "ai_gradient":
      default:
        return (
          <DefaultGradient gradient={gradient}>
            <Text style={styles.overlayText}>🔒</Text>
            <Text style={styles.overlaySubtext}>{gradient.name}</Text>
          </DefaultGradient>
        );
    }
  };

  return (
    <Modal
      transparent={false}
      animationType="none"
      visible
      statusBarTranslucent
    >
      <View style={StyleSheet.absoluteFill}>{renderContent()}</View>
    </Modal>
  );
}

function DefaultGradient({
  gradient,
  children,
}: {
  gradient: { colors: string[] };
  children?: React.ReactNode;
}) {
  return (
    <LinearGradient
      colors={gradient.colors as [string, string, ...string[]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[StyleSheet.absoluteFill, styles.gradientCenter]}
    >
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientCenter: {
    alignItems: "center",
    justifyContent: "center",
  },
  overlayText: {
    fontSize: 48,
    color: "rgba(255,255,255,0.9)",
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  overlaySubtext: {
    fontSize: 18,
    color: "rgba(255,255,255,0.6)",
    fontFamily: "Inter_400Regular",
    marginTop: 12,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
});
