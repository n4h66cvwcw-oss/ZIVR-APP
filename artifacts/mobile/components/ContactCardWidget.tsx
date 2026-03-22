import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import * as Sharing from "expo-sharing";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import Colors from "@/constants/colors";

export type ContactCardData = {
  name: string;
  phone?: string;
  username?: string;
  avatarUri?: string;
  statusMessage?: string;
};

function buildVCard(data: ContactCardData): string {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${data.name}`,
    `N:${data.name};;;`,
  ];
  if (data.phone) lines.push(`TEL;TYPE=CELL:${data.phone}`);
  if (data.username) lines.push(`NICKNAME:${data.username}`);
  if (data.statusMessage) lines.push(`NOTE:${data.statusMessage}`);
  lines.push("END:VCARD");
  return lines.join("\r\n");
}

function buildShareUrl(data: ContactCardData): string {
  const params = new URLSearchParams();
  params.set("n", data.name);
  if (data.phone) params.set("p", data.phone);
  if (data.username) params.set("u", data.username);
  return `vibemsg://contact?${params.toString()}`;
}

export function ContactCardWidget({ data, compact = false }: { data: ContactCardData; compact?: boolean }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;

  const [sharing, setSharing] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringAnim1 = useRef(new Animated.Value(0)).current;
  const ringAnim2 = useRef(new Animated.Value(0)).current;
  const ringAnim3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.95, duration: 800, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();

    const startRing = (anim: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(anim, { toValue: 1, duration: 1800, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
          ]),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      ).start();
    };
    startRing(ringAnim1, 0);
    startRing(ringAnim2, 600);
    startRing(ringAnim3, 1200);
  }, []);

  const shareContact = async () => {
    if (!data.name) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setSharing(true);
    try {
      const vcard = buildVCard(data);
      const fileName = `${data.name.replace(/\s+/g, "_")}_VibeMsg.vcf`;
      const uri = FileSystem.cacheDirectory + fileName;
      await FileSystem.writeAsStringAsync(uri, vcard, { encoding: FileSystem.EncodingType.UTF8 });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: "text/vcard",
          dialogTitle: `Share ${data.name}'s contact`,
          UTI: "public.vcard",
        });
      }
    } catch (e) {
      console.warn("Share failed", e);
    } finally {
      setSharing(false);
    }
  };

  const qrValue = buildShareUrl(data);
  const initials = data.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const ringScale = (anim: Animated.Value) =>
    anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] });
  const ringOpacity = (anim: Animated.Value) =>
    anim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.6, 0.4, 0] });

  return (
    <>
      <View style={styles.wrapper}>
        <LinearGradient
          colors={["#0A84FF", "#5E5CE6", "#9B59B6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.card, compact && styles.cardCompact]}
        >
          <View style={styles.cardHeader}>
            <View style={styles.avatarWrap}>
              {data.avatarUri ? (
                <Image source={{ uri: data.avatarUri }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarFallback]}>
                  <Text style={styles.avatarInitials}>{initials || "?"}</Text>
                </View>
              )}
              <View style={styles.onlineDot} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardName}>{data.name || "Your Name"}</Text>
              {data.username ? (
                <Text style={styles.cardUsername}>@{data.username}</Text>
              ) : null}
              {data.statusMessage ? (
                <Text style={styles.cardStatus} numberOfLines={1}>{data.statusMessage}</Text>
              ) : null}
            </View>
            <View style={styles.vibeMsgBadge}>
              <Ionicons name="chatbubbles" size={12} color="#fff" />
              <Text style={styles.vibeMsgBadgeText}>VibeMsg</Text>
            </View>
          </View>

          {data.phone ? (
            <View style={styles.phoneRow}>
              <Ionicons name="call" size={13} color="rgba(255,255,255,0.7)" />
              <Text style={styles.phoneText}>{data.phone}</Text>
            </View>
          ) : null}

          {!compact && (
            <View style={styles.cardFooter}>
              <View style={styles.qrWrap}>
                <QRCode
                  value={qrValue || "vibemsg://contact"}
                  size={72}
                  color="#fff"
                  backgroundColor="transparent"
                />
                <Text style={styles.qrLabel}>Scan to add</Text>
              </View>
              <View style={{ flex: 1, alignItems: "center" }}>
                <Text style={styles.tapHint}>Tap the button below{"\n"}to share instantly</Text>
              </View>
            </View>
          )}
        </LinearGradient>

        <Pressable
          onPress={shareContact}
          disabled={sharing || !data.name}
          style={styles.nfcBtnWrap}
        >
          <View style={styles.nfcRings}>
            {[ringAnim1, ringAnim2, ringAnim3].map((anim, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.ring,
                  {
                    transform: [{ scale: ringScale(anim) }],
                    opacity: ringOpacity(anim),
                  },
                ]}
              />
            ))}
          </View>
          <Animated.View style={[styles.nfcBtn, { transform: [{ scale: pulseAnim }] }]}>
            <LinearGradient
              colors={["#0A84FF", "#5E5CE6"]}
              style={styles.nfcBtnGrad}
            >
              {sharing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="radio-outline" size={28} color="#fff" />
                  <Text style={styles.nfcBtnText}>Tap to Share</Text>
                </>
              )}
            </LinearGradient>
          </Animated.View>
        </Pressable>

        <Text style={[styles.nfcCaption, { color: colors.textSecondary }]}>
          Hold phones together · or scan the QR code
        </Text>

        <Pressable onPress={() => setShowQR(true)} style={[styles.qrExpandBtn, { backgroundColor: colors.surfaceSecondary }]}>
          <Ionicons name="qr-code-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.qrExpandText, { color: colors.textSecondary }]}>Show full QR code</Text>
        </Pressable>
      </View>

      <Modal visible={showQR} transparent animationType="fade" onRequestClose={() => setShowQR(false)}>
        <Pressable style={styles.qrModalBg} onPress={() => setShowQR(false)}>
          <View style={[styles.qrModal, { backgroundColor: colors.surface }]}>
            <LinearGradient colors={["#0A84FF", "#5E5CE6"]} style={styles.qrModalHeader}>
              <Text style={styles.qrModalName}>{data.name}</Text>
              {data.phone ? <Text style={styles.qrModalPhone}>{data.phone}</Text> : null}
            </LinearGradient>
            <View style={styles.qrModalBody}>
              <QRCode value={qrValue || "vibemsg://contact"} size={220} />
              <Text style={[styles.qrModalSub, { color: colors.textSecondary }]}>
                Scan with any camera app to add this contact
              </Text>
            </View>
            <Pressable onPress={() => setShowQR(false)} style={[styles.qrDismiss, { backgroundColor: colors.surfaceSecondary }]}>
              <Text style={[styles.qrDismissText, { color: colors.text }]}>Done</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: "center", gap: 16 },
  card: {
    width: "100%", borderRadius: 20, padding: 18, gap: 10,
    shadowColor: "#0A84FF", shadowOpacity: 0.4, shadowRadius: 20, elevation: 8,
  },
  cardCompact: { gap: 6, padding: 14 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatarWrap: { position: "relative" },
  avatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: "rgba(255,255,255,0.5)" },
  avatarFallback: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "rgba(255,255,255,0.4)",
  },
  avatarInitials: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#fff" },
  onlineDot: {
    position: "absolute", bottom: 1, right: 1,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: "#34C759", borderWidth: 2, borderColor: "#fff",
  },
  cardName: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#fff" },
  cardUsername: { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)" },
  cardStatus: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.65)", marginTop: 2 },
  vibeMsgBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  vibeMsgBadgeText: { fontSize: 10, color: "#fff", fontFamily: "Inter_600SemiBold" },
  phoneRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  phoneText: { fontSize: 13, color: "rgba(255,255,255,0.8)", fontFamily: "Inter_400Regular" },
  cardFooter: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 },
  qrWrap: { alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 12, padding: 8 },
  qrLabel: { fontSize: 10, color: "rgba(255,255,255,0.7)", fontFamily: "Inter_500Medium" },
  tapHint: { fontSize: 13, color: "rgba(255,255,255,0.75)", fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  nfcBtnWrap: { alignItems: "center", justifyContent: "center", height: 100, width: 100 },
  nfcRings: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  ring: {
    position: "absolute",
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 2, borderColor: "#0A84FF",
  },
  nfcBtn: { width: 80, height: 80, borderRadius: 40, overflow: "hidden" },
  nfcBtnGrad: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2 },
  nfcBtnText: { fontSize: 9, color: "#fff", fontFamily: "Inter_600SemiBold", textAlign: "center" },
  nfcCaption: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  qrExpandBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  qrExpandText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  qrModalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
  qrModal: { width: 300, borderRadius: 24, overflow: "hidden" },
  qrModalHeader: { padding: 20, alignItems: "center" },
  qrModalName: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#fff" },
  qrModalPhone: { fontSize: 14, color: "rgba(255,255,255,0.8)", fontFamily: "Inter_400Regular", marginTop: 4 },
  qrModalBody: { padding: 24, alignItems: "center", gap: 12 },
  qrModalSub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  qrDismiss: { marginHorizontal: 24, marginBottom: 24, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  qrDismissText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
