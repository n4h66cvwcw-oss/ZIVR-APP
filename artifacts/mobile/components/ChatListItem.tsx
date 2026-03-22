import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useRef } from "react";
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
import type { Chat } from "@/context/MessagingContext";
import { Avatar } from "./Avatar";

interface ChatListItemProps {
  chat: Chat;
  subtitle?: string;
  onPress: () => void;
  onLongPress?: () => void;
}

function formatTime(timestamp?: number): string {
  if (!timestamp) return "";
  const now = Date.now();
  const diff = now - timestamp;
  if (diff < 60000) return "now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  const days = Math.floor(diff / 86400000);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d`;
  return new Date(timestamp).toLocaleDateString([], { month: "short", day: "numeric" });
}

export function ChatListItem({
  chat,
  subtitle,
  onPress,
  onLongPress,
}: ChatListItemProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const pressScale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.97,
      useNativeDriver: true,
      tension: 300,
      friction: 20,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 300,
      friction: 20,
    }).start();
  };

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onLongPress?.();
  };

  const isCheckin = chat.type === "checkin";
  const isGroup = chat.type === "group";
  const iconColor = isCheckin
    ? colors.broadcastAccent
    : isGroup
    ? colors.secondary
    : colors.primary;

  const isLocked = !!chat.passcodeHash;
  const isEncrypted = !!chat.isEncrypted;

  const previewText = isEncrypted
    ? "🔐 Encrypted message"
    : isLocked
    ? "🔒 Locked chat"
    : chat.lastAudio
    ? "Audio message"
    : chat.lastMessage || subtitle || "Start a conversation";

  const hasUnread = (chat.unreadCount || 0) > 0;

  return (
    <Animated.View style={{ transform: [{ scale: pressScale }] }}>
      <Pressable
        onPress={onPress}
        onLongPress={handleLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.container, { backgroundColor: colors.surface }]}
      >
        <View style={styles.avatarWrapper}>
          <Avatar name={chat.name} size={52} color={iconColor} />
          {isCheckin && (
            <View
              style={[
                styles.typeBadge,
                { backgroundColor: colors.broadcastAccent },
              ]}
            >
              <Ionicons name="radio" size={10} color="#FFFFFF" />
            </View>
          )}
          {isGroup && !isCheckin && (
            <View
              style={[styles.typeBadge, { backgroundColor: colors.secondary }]}
            >
              <Ionicons name="people" size={10} color="#FFFFFF" />
            </View>
          )}
        </View>

        <View style={styles.content}>
          <View style={styles.headerRow}>
            <View style={styles.nameRow}>
              {chat.isPinned && (
                <Ionicons name="pin" size={12} color={colors.textTertiary} style={styles.pinIcon} />
              )}
              {isLocked && (
                <Ionicons name="lock-closed" size={12} color={colors.textTertiary} style={styles.pinIcon} />
              )}
              {isEncrypted && (
                <Ionicons name="shield-checkmark" size={12} color={colors.secondary} style={styles.pinIcon} />
              )}
              <Text
                style={[
                  styles.name,
                  {
                    color: colors.text,
                    fontFamily: hasUnread
                      ? "Inter_700Bold"
                      : "Inter_600SemiBold",
                  },
                ]}
                numberOfLines={1}
              >
                {chat.name}
              </Text>
            </View>
            <View style={styles.metaRight}>
              {chat.isMuted && (
                <Ionicons
                  name="volume-mute"
                  size={13}
                  color={colors.textTertiary}
                  style={{ marginRight: 4 }}
                />
              )}
              {chat.lastMessageTime && (
                <Text
                  style={[
                    styles.time,
                    {
                      color: hasUnread ? colors.primary : colors.textTertiary,
                      fontFamily: hasUnread
                        ? "Inter_600SemiBold"
                        : "Inter_400Regular",
                    },
                  ]}
                >
                  {formatTime(chat.lastMessageTime)}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.previewRow}>
            {chat.lastAudio && (
              <Ionicons
                name="musical-notes"
                size={14}
                color={colors.audioAccent}
                style={{ marginRight: 4 }}
              />
            )}
            <Text
              style={[
                styles.preview,
                {
                  color: hasUnread ? colors.text : colors.textSecondary,
                  fontFamily: hasUnread
                    ? "Inter_500Medium"
                    : "Inter_400Regular",
                  flex: 1,
                },
              ]}
              numberOfLines={1}
            >
              {previewText}
            </Text>
            {hasUnread && (
              <View
                style={[
                  styles.unreadBadge,
                  { backgroundColor: colors.primary },
                ]}
              >
                <Text style={styles.unreadCount}>
                  {chat.unreadCount! > 99 ? "99+" : chat.unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  avatarWrapper: {
    position: "relative",
  },
  typeBadge: {
    position: "absolute",
    bottom: 0,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    gap: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  pinIcon: {
    marginRight: 4,
  },
  name: {
    fontSize: 16,
    flex: 1,
  },
  metaRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  time: {
    fontSize: 12,
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  preview: {
    fontSize: 14,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadCount: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
});
