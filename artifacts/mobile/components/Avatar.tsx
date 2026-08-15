import React from "react";
import { Image, StyleSheet, Text, View, useColorScheme } from "react-native";
import Colors from "@/constants/colors";

interface AvatarProps {
  name: string;
  size?: number;
  isOnline?: boolean;
  color?: string;
  /** Optional image URI; falls back to initials when absent. */
  avatar?: string;
}

const AVATAR_COLORS = [
  "#0A84FF",
  "#30D158",
  "#5E5CE6",
  "#FF9F0A",
  "#FF453A",
  "#64D2FF",
  "#FFD60A",
  "#FF6B6B",
  "#4ECDC4",
  "#A8E063",
];

function getColorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  const parts = name.split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function Avatar({ name, size = 44, isOnline, color, avatar }: AvatarProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const bgColor = color || getColorForName(name);
  const initials = getInitials(name);
  const fontSize = size * 0.38;

  return (
    <View style={{ position: "relative" }}>
      <View
        style={[
          styles.avatar,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: bgColor,
          },
        ]}
      >
        {avatar ? (
          <Image
            source={{ uri: avatar }}
            style={{ width: size, height: size, borderRadius: size / 2 }}
          />
        ) : (
          <Text style={[styles.initials, { fontSize, color: "#FFFFFF" }]}>
            {initials}
          </Text>
        )}
      </View>
      {isOnline && (
        <View
          style={[
            styles.onlineDot,
            {
              width: size * 0.28,
              height: size * 0.28,
              borderRadius: (size * 0.28) / 2,
              right: 0,
              bottom: 0,
              borderWidth: size * 0.05,
              borderColor: isDark ? "#000000" : "#FFFFFF",
              backgroundColor: Colors.light.secondary,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
  },
  onlineDot: {
    position: "absolute",
    backgroundColor: "#30D158",
  },
});
