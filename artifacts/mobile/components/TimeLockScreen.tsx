import React from "react";
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";

type Props = {
  startHour: number;
  endHour: number;
  overrideUntil?: number | null;
};

function formatHour(h: number): string {
  const suffix = h < 12 ? "AM" : "PM";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:00 ${suffix}`;
}

export function TimeLockScreen({ startHour, endHour, overrideUntil }: Props) {
  const isDark = useColorScheme() === "dark";
  const colors = isDark ? Colors.dark : Colors.light;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.iconWrap}>
          <Ionicons name="time-outline" size={56} color="#FF6B6B" />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>App is locked</Text>
        {overrideUntil && overrideUntil > Date.now() && (
          <Text style={[styles.override, { color: "#FF9800" }]}>
            Unlocked until{" "}
            {new Date(overrideUntil).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            })}
          </Text>
        )}
        <Text style={[styles.sub, { color: colors.textSecondary }]}>
          ZIVR is available between
        </Text>
        <Text style={[styles.hours, { color: colors.text }]}>
          {formatHour(startHour)} – {formatHour(endHour)}
        </Text>
        <Text style={[styles.footer, { color: colors.textSecondary }]}>
          Ask a parent to adjust your screen time settings.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 20,
    borderWidth: 1,
    padding: 32,
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(255,107,107,0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
  },
  sub: {
    fontSize: 15,
    textAlign: "center",
  },
  hours: {
    fontSize: 22,
    fontWeight: "600",
    textAlign: "center",
  },
  override: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  footer: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 19,
  },
});
