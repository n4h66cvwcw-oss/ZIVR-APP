import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

interface Props {
  name?: string;
  emoji?: string;
  colors: {
    surface: string;
    textSecondary: string;
    border: string;
    shadow?: string;
  };
}

const DOT_COUNT = 3;
const DOT_DELAY = 160;

function AnimatedDot({ delay, color }: { delay: number; color: string }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: -6, duration: 280, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.delay(DOT_DELAY * (DOT_COUNT - 1)),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim, delay]);

  return (
    <Animated.View
      style={[styles.dot, { backgroundColor: color, transform: [{ translateY: anim }] }]}
    />
  );
}

function AnimatedEmoji({ emoji }: { emoji: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.25, duration: 350, useNativeDriver: true }),
          Animated.timing(rotate, { toValue: 1, duration: 350, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 0.85, duration: 350, useNativeDriver: true }),
          Animated.timing(rotate, { toValue: -1, duration: 350, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.timing(rotate, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]),
        Animated.delay(400),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scale, rotate]);

  const spin = rotate.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ["-12deg", "0deg", "12deg"],
  });

  return (
    <Animated.Text
      style={[styles.emoji, { transform: [{ scale }, { rotate: spin }] }]}
    >
      {emoji}
    </Animated.Text>
  );
}

export function TypingBubble({ name, emoji, colors }: Props) {
  const slideIn = useRef(new Animated.Value(12)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideIn, { toValue: 0, useNativeDriver: true, tension: 180, friction: 12 }),
      Animated.timing(fadeIn, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.wrapper,
        { opacity: fadeIn, transform: [{ translateY: slideIn }] },
      ]}
    >
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            shadowColor: colors.shadow ?? "#000",
          },
        ]}
      >
        {emoji ? (
          <AnimatedEmoji emoji={emoji} />
        ) : (
          <View style={styles.dotsRow}>
            {Array.from({ length: DOT_COUNT }).map((_, i) => (
              <AnimatedDot key={i} delay={i * DOT_DELAY} color={colors.textSecondary} />
            ))}
          </View>
        )}
      </View>
      {name ? (
        <Text style={[styles.nameLabel, { color: colors.textSecondary }]}>{name}</Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: 3,
  },
  bubble: {
    borderRadius: 20,
    borderBottomLeftRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    alignSelf: "flex-start",
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 5,
    height: 18,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  emoji: {
    fontSize: 24,
    lineHeight: 28,
  },
  nameLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginLeft: 4,
  },
});
