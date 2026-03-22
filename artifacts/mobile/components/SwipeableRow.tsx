import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useRef } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { PanResponder } from "react-native";

interface SwipeAction {
  label: string;
  icon: string;
  color: string;
  onPress: () => void;
}

interface SwipeableRowProps {
  children: React.ReactNode;
  rightActions?: SwipeAction[];
  leftActions?: SwipeAction[];
}

export function SwipeableRow({
  children,
  rightActions = [],
  leftActions = [],
}: SwipeableRowProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen = useRef(false);
  const ACTION_WIDTH = 72;

  const maxRight = rightActions.length * ACTION_WIDTH;
  const maxLeft = leftActions.length * ACTION_WIDTH;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > Math.abs(g.dy) && Math.abs(g.dx) > 8,
      onPanResponderMove: (_, g) => {
        const newX = isOpen.current ? g.dx - maxRight : g.dx;
        if (newX < 0 && rightActions.length > 0) {
          translateX.setValue(Math.max(-maxRight, newX));
        } else if (newX > 0 && leftActions.length > 0) {
          translateX.setValue(Math.min(maxLeft, newX));
        }
      },
      onPanResponderRelease: (_, g) => {
        const threshold = 40;
        if (g.dx < -threshold && rightActions.length > 0) {
          Animated.spring(translateX, {
            toValue: -maxRight,
            useNativeDriver: true,
          }).start();
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          isOpen.current = true;
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
          isOpen.current = false;
        }
      },
    })
  ).current;

  const close = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
    }).start();
    isOpen.current = false;
  };

  return (
    <View style={styles.container}>
      {rightActions.length > 0 && (
        <View style={[styles.actionsContainer, styles.rightActions]}>
          {rightActions.map((action, i) => (
            <Pressable
              key={i}
              onPress={() => {
                close();
                action.onPress();
              }}
              style={[
                styles.actionBtn,
                { backgroundColor: action.color, width: ACTION_WIDTH },
              ]}
            >
              <Feather name={action.icon as any} size={20} color="#FFFFFF" />
              <Text style={styles.actionLabel}>{action.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <Animated.View
        style={{ transform: [{ translateX }] }}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    overflow: "hidden",
  },
  actionsContainer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "stretch",
  },
  rightActions: {
    right: 0,
  },
  leftActions: {
    left: 0,
  },
  actionBtn: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  actionLabel: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
});
