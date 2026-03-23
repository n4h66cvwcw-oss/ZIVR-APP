import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import Colors from "@/constants/colors";

interface PasscodeModalProps {
  visible: boolean;
  onSuccess: () => void;
  onCancel: () => void;
  onRemove?: () => void;
  title?: string;
  subtitle?: string;
  hint?: string;
  recoveryEmail?: string;
}

const DIGITS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["", "0", "⌫"],
];

export function PasscodeModal({
  visible,
  onSuccess,
  onCancel,
  onRemove,
  title = "Enter Passcode",
  subtitle,
  hint,
  recoveryEmail,
}: PasscodeModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    if (!visible) {
      setCode("");
      setError(false);
      setShowHint(false);
    }
  }, [visible]);

  useEffect(() => {
    if (code.length === 6) {
      onSuccess();
    }
  }, [code]);

  const shake = () => {
    setError(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start(() => {
      setCode("");
      setError(false);
    });
  };

  const handleDigit = (d: string) => {
    if (d === "⌫") {
      setCode((prev) => prev.slice(0, -1));
      return;
    }
    if (d === "") return;
    if (code.length >= 6) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCode((prev) => prev + d);
  };

  const handleRemovePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Remove Passcode",
      "This will remove the passcode lock from this chat. Anyone with access to your phone will be able to open it.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove Lock",
          style: "destructive",
          onPress: () => {
            onRemove?.();
          },
        },
      ]
    );
  };

  const dotColor = error ? "#FF453A" : colors.primary;
  const hasFooterContent = hint || recoveryEmail || onRemove;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.container,
            { backgroundColor: colors.surface, transform: [{ translateX: shakeAnim }] },
          ]}
        >
          <Pressable onPress={onCancel} style={styles.cancelBtn}>
            <Text style={[styles.cancelText, { color: colors.primary }]}>Cancel</Text>
          </Pressable>

          <View style={styles.lockIcon}>
            <Ionicons name="lock-closed" size={32} color={colors.primary} />
          </View>

          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {subtitle && (
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {subtitle}
            </Text>
          )}

          <View style={styles.dotsRow}>
            {Array.from({ length: 6 }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      i < code.length ? dotColor : colors.surfaceSecondary,
                    borderColor: dotColor,
                  },
                ]}
              />
            ))}
          </View>

          {hint && showHint && (
            <View style={[styles.hintBox, { backgroundColor: colors.surfaceSecondary }]}>
              <Ionicons name="bulb-outline" size={14} color={colors.audioAccent} />
              <Text style={[styles.hintText, { color: colors.textSecondary }]}>{hint}</Text>
            </View>
          )}

          <View style={styles.keypad}>
            {DIGITS.map((row, ri) => (
              <View key={ri} style={styles.keypadRow}>
                {row.map((d, di) => (
                  <Pressable
                    key={di}
                    onPress={() => handleDigit(d)}
                    disabled={d === ""}
                    style={({ pressed }) => [
                      styles.key,
                      {
                        backgroundColor: pressed
                          ? colors.surfaceSecondary
                          : d === "" ? "transparent" : colors.surface,
                        borderColor: d === "" ? "transparent" : colors.border,
                        opacity: d === "" ? 0 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.keyText,
                        {
                          color:
                            d === "⌫" ? colors.primary : colors.text,
                          fontSize: d === "⌫" ? 22 : 22,
                        },
                      ]}
                    >
                      {d}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ))}
          </View>

          {hasFooterContent && (
            <View style={styles.footer}>
              {hint && (
                <Pressable onPress={() => setShowHint((v) => !v)}>
                  <Text style={[styles.footerLink, { color: colors.primary }]}>
                    {showHint ? "Hide hint" : "Show hint"}
                  </Text>
                </Pressable>
              )}
              {recoveryEmail && (
                <Text style={[styles.footerNote, { color: colors.textTertiary }]}>
                  Recovery: {recoveryEmail.replace(/(.{2}).*(@.*)/, "$1***$2")}
                </Text>
              )}
              {onRemove && (
                <Pressable onPress={handleRemovePress} style={styles.removeBtn} hitSlop={8}>
                  <Ionicons name="lock-open-outline" size={13} color="#FF453A" />
                  <Text style={styles.removeText}>Remove Passcode</Text>
                </Pressable>
              )}
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    width: 320,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    gap: 16,
  },
  cancelBtn: {
    alignSelf: "flex-end",
  },
  cancelText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  lockIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "rgba(10,132,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  dotsRow: {
    flexDirection: "row",
    gap: 12,
    marginVertical: 8,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  keypad: {
    gap: 12,
    width: "100%",
  },
  keypadRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    gap: 12,
  },
  key: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  keyText: {
    fontFamily: "Inter_600SemiBold",
  },
  hintBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    alignSelf: "stretch",
  },
  hintText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  footer: {
    alignItems: "center",
    gap: 8,
  },
  footerLink: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  footerNote: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  removeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 4,
  },
  removeText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#FF453A",
  },
});
