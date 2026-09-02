import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import {
  useParental,
  type ChildAccount,
  type ContentFlag,
  type ContactApproval,
  type TimeRestriction,
} from "@/context/ParentalContext";
import { Avatar } from "@/components/Avatar";
import { useServer } from "@/context/ServerContext";

const DAYS = [
  { key: "mon", label: "M" },
  { key: "tue", label: "T" },
  { key: "wed", label: "W" },
  { key: "thu", label: "T" },
  { key: "fri", label: "F" },
  { key: "sat", label: "S" },
  { key: "sun", label: "S" },
];

function SectionHeader({ title, colors }: { title: string; colors: typeof Colors.dark }) {
  return (
    <Text style={[sStyles.sectionHeader, { color: colors.textSecondary }]}>{title}</Text>
  );
}

function HourPicker({
  label,
  value,
  onChange,
  colors,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  colors: typeof Colors.dark;
}) {
  const fmt = (h: number) => {
    const suffix = h < 12 ? "AM" : "PM";
    const d = h % 12 === 0 ? 12 : h % 12;
    return `${d}:00 ${suffix}`;
  };
  return (
    <View style={sStyles.hourRow}>
      <Text style={[sStyles.hourLabel, { color: colors.textSecondary }]}>{label}</Text>
      <View style={sStyles.hourControls}>
        <Pressable
          style={[sStyles.hourBtn, { backgroundColor: colors.background }]}
          onPress={() => onChange(Math.max(0, value - 1))}
          hitSlop={8}
        >
          <Ionicons name="remove" size={18} color={colors.text} />
        </Pressable>
        <Text style={[sStyles.hourValue, { color: colors.text }]}>{fmt(value)}</Text>
        <Pressable
          style={[sStyles.hourBtn, { backgroundColor: colors.background }]}
          onPress={() => onChange(Math.min(23, value + 1))}
          hitSlop={8}
        >
          <Ionicons name="add" size={18} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const color =
    severity === "high" ? "#FF4444" : severity === "medium" ? "#FF9800" : "#FFC107";
  const bg = color + "20";
  return (
    <View style={[sStyles.severityBadge, { backgroundColor: bg }]}>
      <Text style={[sStyles.severityText, { color }]}>{severity.toUpperCase()}</Text>
    </View>
  );
}

function formatOverrideTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ChildSettingsScreen() {
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const isDark = useColorScheme() === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const {
    loadChildDetail,
    updateTimeRestrictions,
    grantTimeOverride,
    endTimeOverride,
    loadContacts,
    updateContactStatus,
    loadFlags,
    markFlagReviewed,
    getChildToken,
    setParentMode,
  } = useParental();
  const { switchActiveUser } = useServer();

  const [child, setChild] = useState<ChildAccount | null>(null);
  const [timeRestriction, setTimeRestriction] = useState<TimeRestriction>({
    enabled: false,
    startHour: 8,
    endHour: 21,
    days: "mon,tue,wed,thu,fri,sat,sun",
  });
  const [contacts, setContacts] = useState<ContactApproval[]>([]);
  const [flags, setFlags] = useState<ContentFlag[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "contacts" | "flags">("overview");
  const [savingTime, setSavingTime] = useState(false);
  const [savingOverride, setSavingOverride] = useState(false);

  const load = useCallback(async () => {
    if (!childId) return;
    const [detail, contactList, flagList] = await Promise.all([
      loadChildDetail(childId),
      loadContacts(childId),
      loadFlags(childId, false),
    ]);
    if (detail) {
      setChild(detail.child);
      setTimeRestriction(detail.timeRestriction);
    }
    setContacts(contactList);
    setFlags(flagList);
  }, [childId, loadChildDetail, loadContacts, loadFlags]);

  useEffect(() => { void load(); }, [load]);

  const toggleDay = (key: string) => {
    const current = timeRestriction.days.split(",").filter(Boolean);
    const next = current.includes(key)
      ? current.filter((d) => d !== key)
      : [...current, key];
    setTimeRestriction((r) => ({ ...r, days: next.join(",") }));
  };

  const handleSaveTimeRestrictions = async () => {
    if (!childId) return;
    setSavingTime(true);
    try {
      await updateTimeRestrictions(childId, timeRestriction);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Error", "Could not save time restrictions.");
    }
    setSavingTime(false);
  };

  const handleGrantOverride = async (durationHours: 1 | 2) => {
    if (!childId || savingOverride) return;
    setSavingOverride(true);
    try {
      const overrideUntil = await grantTimeOverride(childId, durationHours);
      setTimeRestriction((current) => ({ ...current, overrideUntil }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Error", "Could not grant a temporary unlock.");
    } finally {
      setSavingOverride(false);
    }
  };

  const handleEndOverride = () => {
    if (
      !child ||
      !childId ||
      savingOverride ||
      !timeRestriction.overrideUntil ||
      timeRestriction.overrideUntil <= Date.now()
    ) {
      return;
    }

    Alert.alert(
      "End temporary unlock?",
      `${child.displayName} will return to the normal schedule now.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "End unlock",
          style: "destructive",
          onPress: async () => {
            setSavingOverride(true);
            try {
              await endTimeOverride(childId);
              setTimeRestriction((current) => ({ ...current, overrideUntil: null }));
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch {
              Alert.alert("Error", "Could not end the temporary unlock.");
            } finally {
              setSavingOverride(false);
            }
          },
        },
      ],
    );
  };

  const handleContactAction = async (contactId: string, status: "approved" | "blocked") => {
    if (!childId) return;
    await updateContactStatus(childId, contactId, status);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setContacts((prev) =>
      prev.map((c) => (c.contactId === contactId ? { ...c, status } : c))
    );
  };

  const handleUseAsChild = () => {
    if (!childId || !child) return;
    Alert.alert(
      `Switch to ${child.displayName}?`,
      "This device will start chatting as this child account. You can switch back from the profile screen by signing in as yourself.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Switch",
          onPress: async () => {
            const token = await getChildToken(childId);
            if (!token) {
              Alert.alert(
                "Not available",
                "This child's sign-in credential isn't stored on this device. It is only available on the device that created the child account."
              );
              return;
            }
            await switchActiveUser(childId, token);
            await setParentMode(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.replace("/");
          },
        },
      ]
    );
  };

  const handleDismissFlag = async (flagId: string) => {
    if (!childId) return;
    await markFlagReviewed(childId, flagId);
    setFlags((prev) => prev.filter((f) => f.id !== flagId));
  };

  if (!child) {
    return (
      <View style={[sStyles.container, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: colors.textSecondary }}>Loading…</Text>
      </View>
    );
  }

  const pendingContacts = contacts.filter((c) => c.status === "pending");
  const reviewedContacts = contacts.filter((c) => c.status !== "pending");
  const activeOverride = timeRestriction.overrideUntil && timeRestriction.overrideUntil > Date.now()
    ? timeRestriction.overrideUntil
    : null;

  return (
    <View style={[sStyles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[sStyles.header, { paddingTop: insets.top + 8, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={sStyles.headerCenter}>
          <Avatar name={child.displayName} size={32} />
          <Text style={[sStyles.headerTitle, { color: colors.text }]}>{child.displayName}</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      {/* Tabs */}
      <View style={[sStyles.tabs, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {(["overview", "contacts", "flags"] as const).map((tab) => {
          const label = tab === "overview" ? "Settings" : tab === "contacts" ? `Contacts${pendingContacts.length ? ` (${pendingContacts.length})` : ""}` : `Flags${flags.length ? ` (${flags.length})` : ""}`;
          return (
            <Pressable
              key={tab}
              style={[sStyles.tab, activeTab === tab && sStyles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[sStyles.tabText, { color: activeTab === tab ? "#6C63FF" : colors.textSecondary }]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Overview / Settings tab */}
      {activeTab === "overview" && (
        <ScrollView contentContainerStyle={sStyles.scroll}>
          {/* Child status */}
          <View style={[sStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={sStyles.statusRow}>
              <View style={[sStyles.statusDot, { backgroundColor: child.isOnline ? "#4CAF50" : "#9E9E9E" }]} />
              <Text style={[sStyles.statusText, { color: colors.textSecondary }]}>
                {child.isOnline ? "Currently online" : "Offline"}
              </Text>
            </View>
            {child.username && (
              <Text style={[sStyles.username, { color: colors.textSecondary }]}>@{child.username}</Text>
            )}
            <View style={[sStyles.divider, { backgroundColor: colors.border }]} />
            <Pressable style={sStyles.switchChildBtn} onPress={handleUseAsChild} hitSlop={4}>
              <Ionicons name="swap-horizontal-outline" size={18} color="#6C63FF" />
              <Text style={sStyles.switchChildText}>Use this device as {child.displayName}</Text>
            </Pressable>
          </View>

          {/* Time restrictions */}
          <SectionHeader title="SCREEN TIME" colors={colors} />
          <View style={[sStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={sStyles.switchRow}>
              <Text style={[sStyles.switchLabel, { color: colors.text }]}>Restrict app hours</Text>
              <Switch
                value={timeRestriction.enabled}
                onValueChange={(v) => setTimeRestriction((r) => ({ ...r, enabled: v }))}
                trackColor={{ false: colors.border, true: "#6C63FF" }}
                thumbColor="#fff"
              />
            </View>
            {timeRestriction.enabled && (
              <>
                <View style={[sStyles.divider, { backgroundColor: colors.border }]} />
                <HourPicker
                  label="From"
                  value={timeRestriction.startHour}
                  onChange={(v) => setTimeRestriction((r) => ({ ...r, startHour: v }))}
                  colors={colors}
                />
                <HourPicker
                  label="Until"
                  value={timeRestriction.endHour}
                  onChange={(v) => setTimeRestriction((r) => ({ ...r, endHour: v }))}
                  colors={colors}
                />
                <View style={[sStyles.divider, { backgroundColor: colors.border }]} />
                <Text style={[sStyles.daysLabel, { color: colors.textSecondary }]}>Active days</Text>
                <View style={sStyles.daysRow}>
                  {DAYS.map((d) => {
                    const active = timeRestriction.days.split(",").includes(d.key);
                    return (
                      <Pressable
                        key={d.key}
                        style={[sStyles.dayBtn, active && sStyles.dayBtnActive, { borderColor: colors.border }]}
                        onPress={() => toggleDay(d.key)}
                      >
                        <Text style={[sStyles.dayBtnText, active && sStyles.dayBtnTextActive, { color: active ? "#fff" : colors.textSecondary }]}>
                          {d.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}
            <View style={[sStyles.divider, { backgroundColor: colors.border }]} />
            <View style={sStyles.overrideHeader}>
              <View style={sStyles.overrideTitleRow}>
                <Ionicons name="flash-outline" size={18} color="#FF9800" />
                <Text style={[sStyles.overrideTitle, { color: colors.text }]}>Temporary unlock</Text>
              </View>
              <Text style={[sStyles.overrideDescription, { color: colors.textSecondary }]}>
                Let {child.displayName} use ZIVR now without changing this schedule.
              </Text>
              {activeOverride && (
                <Text style={[sStyles.overrideActive, { color: "#FF9800" }]}>
                  Unlocked until {formatOverrideTime(activeOverride)}
                </Text>
              )}
              <View style={sStyles.overrideButtons}>
                {([1, 2] as const).map((durationHours) => (
                  <Pressable
                    key={durationHours}
                    style={[sStyles.overrideBtn, { borderColor: "#FF9800", opacity: savingOverride ? 0.6 : 1 }]}
                    onPress={() => void handleGrantOverride(durationHours)}
                    disabled={savingOverride}
                  >
                    <Text style={sStyles.overrideBtnText}>
                      {durationHours} hour{durationHours > 1 ? "s" : ""}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {activeOverride && (
                <Pressable
                  style={[sStyles.endOverrideBtn, { borderColor: colors.border, opacity: savingOverride ? 0.6 : 1 }]}
                  onPress={handleEndOverride}
                  disabled={savingOverride}
                >
                  <Ionicons name="lock-closed-outline" size={16} color={colors.textSecondary} />
                  <Text style={[sStyles.endOverrideBtnText, { color: colors.textSecondary }]}>End unlock</Text>
                </Pressable>
              )}
            </View>
            <Pressable
              style={[sStyles.saveBtn, { opacity: savingTime ? 0.6 : 1 }]}
              onPress={handleSaveTimeRestrictions}
              disabled={savingTime}
            >
              <Text style={sStyles.saveBtnText}>{savingTime ? "Saving…" : "Save Settings"}</Text>
            </Pressable>
          </View>

          {/* Pending contact count */}
          {pendingContacts.length > 0 && (
            <>
              <SectionHeader title="PENDING APPROVALS" colors={colors} />
              <Pressable
                style={[sStyles.card, sStyles.alertCard, { backgroundColor: "#FF9800" + "18", borderColor: "#FF980040" }]}
                onPress={() => setActiveTab("contacts")}
              >
                <Ionicons name="person-add-outline" size={20} color="#FF9800" />
                <Text style={[sStyles.alertText, { color: colors.text }]}>
                  {pendingContacts.length} contact{pendingContacts.length > 1 ? "s" : ""} waiting for your approval
                </Text>
                <Ionicons name="chevron-forward" size={16} color="#FF9800" />
              </Pressable>
            </>
          )}

          {/* Unreviewed flags */}
          {flags.length > 0 && (
            <>
              <SectionHeader title="AI ALERTS" colors={colors} />
              <Pressable
                style={[sStyles.card, sStyles.alertCard, { backgroundColor: "#FF4444" + "18", borderColor: "#FF444440" }]}
                onPress={() => setActiveTab("flags")}
              >
                <Ionicons name="warning-outline" size={20} color="#FF4444" />
                <Text style={[sStyles.alertText, { color: colors.text }]}>
                  {flags.length} flagged message{flags.length > 1 ? "s" : ""} to review
                </Text>
                <Ionicons name="chevron-forward" size={16} color="#FF4444" />
              </Pressable>
            </>
          )}
        </ScrollView>
      )}

      {/* Contacts tab */}
      {activeTab === "contacts" && (
        <FlatList
          data={contacts}
          keyExtractor={(c) => c.contactId}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          ListEmptyComponent={
            <View style={sStyles.empty}>
              <Ionicons name="people-outline" size={40} color={colors.textSecondary} />
              <Text style={[sStyles.emptyText, { color: colors.textSecondary }]}>No contact requests yet</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[sStyles.contactCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Avatar name={item.displayName} size={44} />
              <View style={sStyles.contactInfo}>
                <Text style={[sStyles.contactName, { color: colors.text }]}>{item.displayName}</Text>
                {item.username && (
                  <Text style={[sStyles.contactUsername, { color: colors.textSecondary }]}>@{item.username}</Text>
                )}
                <View style={[sStyles.statusChip, {
                  backgroundColor: item.status === "approved" ? "#4CAF5020" : item.status === "blocked" ? "#FF444420" : "#FF980020",
                }]}>
                  <Text style={[sStyles.statusChipText, {
                    color: item.status === "approved" ? "#4CAF50" : item.status === "blocked" ? "#FF4444" : "#FF9800",
                  }]}>
                    {item.status.toUpperCase()}
                  </Text>
                </View>
              </View>
              {item.status === "pending" && (
                <View style={sStyles.contactActions}>
                  <Pressable
                    style={[sStyles.actionBtn, { backgroundColor: "#4CAF5020" }]}
                    onPress={() => handleContactAction(item.contactId, "approved")}
                  >
                    <Ionicons name="checkmark" size={18} color="#4CAF50" />
                  </Pressable>
                  <Pressable
                    style={[sStyles.actionBtn, { backgroundColor: "#FF444420" }]}
                    onPress={() => handleContactAction(item.contactId, "blocked")}
                  >
                    <Ionicons name="close" size={18} color="#FF4444" />
                  </Pressable>
                </View>
              )}
            </View>
          )}
        />
      )}

      {/* Flags tab */}
      {activeTab === "flags" && (
        <FlatList
          data={flags}
          keyExtractor={(f) => f.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          ListEmptyComponent={
            <View style={sStyles.empty}>
              <Ionicons name="shield-checkmark-outline" size={40} color="#4CAF50" />
              <Text style={[sStyles.emptyText, { color: colors.textSecondary }]}>No flagged content — all clear!</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[sStyles.flagCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={sStyles.flagHeader}>
                <SeverityBadge severity={item.severity} />
                {item.senderName && (
                  <Text style={[sStyles.flagSender, { color: colors.textSecondary }]}>
                    from {item.senderName}
                  </Text>
                )}
                <Pressable onPress={() => handleDismissFlag(item.id)} hitSlop={8}>
                  <Ionicons name="checkmark-circle-outline" size={22} color="#4CAF50" />
                </Pressable>
              </View>
              <Text style={[sStyles.flagText, { color: colors.text }]} numberOfLines={4}>
                "{item.flaggedText}"
              </Text>
              {item.aiReason && (
                <Text style={[sStyles.flagReason, { color: colors.textSecondary }]}>
                  🤖 {item.aiReason}
                </Text>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

const sStyles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: "#6C63FF",
  },
  tabText: { fontSize: 13, fontWeight: "600" },
  scroll: { padding: 16, gap: 8 },
  sectionHeader: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginTop: 16,
    marginBottom: 4,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  alertCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
  },
  alertText: { flex: 1, fontSize: 14, fontWeight: "500" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 14 },
  username: { fontSize: 13 },
  switchChildBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  switchChildText: { fontSize: 14, fontWeight: "600", color: "#6C63FF" },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  switchLabel: { fontSize: 16, fontWeight: "500" },
  divider: { height: 1 },
  hourRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  hourLabel: { fontSize: 14 },
  hourControls: { flexDirection: "row", alignItems: "center", gap: 12 },
  hourBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  hourValue: { fontSize: 15, fontWeight: "600", minWidth: 90, textAlign: "center" },
  daysLabel: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  daysRow: { flexDirection: "row", gap: 8 },
  dayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  dayBtnActive: { backgroundColor: "#6C63FF", borderColor: "#6C63FF" },
  dayBtnText: { fontSize: 13, fontWeight: "600" },
  dayBtnTextActive: { color: "#fff" },
  saveBtn: {
    backgroundColor: "#6C63FF",
    borderRadius: 12,
    padding: 13,
    alignItems: "center",
    marginTop: 4,
  },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  overrideHeader: { gap: 8 },
  overrideTitleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  overrideTitle: { fontSize: 15, fontWeight: "600" },
  overrideDescription: { fontSize: 13, lineHeight: 18 },
  overrideActive: { fontSize: 13, fontWeight: "700" },
  overrideButtons: { flexDirection: "row", gap: 10, marginTop: 2 },
  overrideBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  overrideBtnText: { color: "#FF9800", fontSize: 14, fontWeight: "700" },
  endOverrideBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  endOverrideBtnText: { fontSize: 13, fontWeight: "600" },
  empty: { paddingTop: 80, alignItems: "center", gap: 12 },
  emptyText: { fontSize: 15 },
  contactCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  contactInfo: { flex: 1, gap: 4 },
  contactName: { fontSize: 15, fontWeight: "600" },
  contactUsername: { fontSize: 13 },
  statusChip: {
    alignSelf: "flex-start",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusChipText: { fontSize: 11, fontWeight: "700" },
  contactActions: { flexDirection: "row", gap: 8 },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  flagCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  flagHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  flagSender: { flex: 1, fontSize: 13 },
  flagText: { fontSize: 15, lineHeight: 22, fontStyle: "italic" },
  flagReason: { fontSize: 13, lineHeight: 18 },
  severityBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  severityText: { fontSize: 11, fontWeight: "700" },
});
