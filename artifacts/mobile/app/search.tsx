import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useMessaging, type Message } from "@/context/MessagingContext";
import { Avatar } from "@/components/Avatar";

type SearchResult = Message & { chatName: string };
type FilterMode = "keyword" | "date" | "dateRange" | "timeRange" | "sender";

export default function SearchScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const { searchMessages, contacts, chats } = useMessaging();

  const [query, setQuery] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("keyword");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [selectedSender, setSelectedSender] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  const parseDate = (str: string): number | undefined => {
    if (!str) return undefined;
    const parts = str.split("/");
    if (parts.length === 3) {
      const [m, d, y] = parts;
      const date = new Date(+y, +m - 1, +d);
      return isNaN(date.getTime()) ? undefined : date.getTime();
    }
    return undefined;
  };

  const handleSearch = () => {
    const filter: any = {};
    if (query.trim()) filter.query = query.trim();
    if (selectedChat) filter.chatId = selectedChat;
    if (selectedSender) filter.senderId = selectedSender;

    if (filterMode === "date" && startDate) {
      const d = parseDate(startDate);
      if (d) {
        filter.startDate = d;
        filter.endDate = d + 86400000 - 1;
      }
    } else if (filterMode === "dateRange") {
      const s = parseDate(startDate);
      const e = parseDate(endDate);
      if (s) filter.startDate = s;
      if (e) filter.endDate = e + 86400000 - 1;
    } else if (filterMode === "timeRange") {
      if (startTime) filter.startTime = startTime;
      if (endTime) filter.endTime = endTime;
    }

    const r = searchMessages(filter);
    setResults(r);
    setHasSearched(true);
    setShowFilters(false);
  };

  const clearAll = () => {
    setQuery("");
    setStartDate("");
    setEndDate("");
    setStartTime("");
    setEndTime("");
    setSelectedChat(null);
    setSelectedSender(null);
    setResults([]);
    setHasSearched(false);
    setFilterMode("keyword");
  };

  const renderResult = ({ item }: { item: SearchResult }) => {
    const sender = contacts.find((c) => c.id === item.senderId);
    const date = new Date(item.timestamp);
    const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const timeStr = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    const chat = chats.find((c) => c.id === item.chatId);

    return (
      <Pressable
        onPress={() => chat && router.push(`/chat/${chat.id}`)}
        style={({ pressed }) => [
          styles.resultItem,
          { backgroundColor: pressed ? colors.surfaceSecondary : colors.surface },
        ]}
      >
        <Avatar name={sender?.name || "?"} size={40} />
        <View style={styles.resultContent}>
          <View style={styles.resultHeader}>
            <Text style={[styles.resultSender, { color: colors.text }]}>
              {sender?.name || "Unknown"}
            </Text>
            <Text style={[styles.resultTime, { color: colors.textTertiary }]}>
              {dateStr} · {timeStr}
            </Text>
          </View>
          <Text style={[styles.resultChat, { color: colors.primary }]} numberOfLines={1}>
            in {item.chatName}
          </Text>
          {item.deleted ? (
            <Text style={[styles.resultText, { color: colors.textTertiary, fontStyle: "italic" }]}>
              Message deleted
            </Text>
          ) : (
            <HighlightedText
              text={item.text}
              highlight={query}
              colors={colors}
            />
          )}
          {item.audioAttachment && (
            <View style={styles.audioTag}>
              <Ionicons name="musical-notes" size={12} color={colors.audioAccent} />
              <Text style={[styles.audioTagText, { color: colors.audioAccent }]}>
                {item.audioAttachment.name}
              </Text>
            </View>
          )}
        </View>
      </Pressable>
    );
  };

  const FILTER_MODES: { key: FilterMode; label: string; icon: string }[] = [
    { key: "keyword", label: "Keyword", icon: "text-outline" },
    { key: "date", label: "Exact Date", icon: "calendar-outline" },
    { key: "dateRange", label: "Date Range", icon: "calendar-number-outline" },
    { key: "timeRange", label: "Time Range", icon: "time-outline" },
    { key: "sender", label: "By Person", icon: "person-outline" },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[styles.header, { paddingTop: topPad, backgroundColor: colors.surface, borderBottomColor: colors.border }]}
      >
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={26} color={colors.primary} />
          </Pressable>
          <View style={[styles.searchBar, { backgroundColor: colors.surfaceSecondary }]}>
            <Feather name="search" size={16} color={colors.textTertiary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search messages..."
              placeholderTextColor={colors.textTertiary}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              autoFocus
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery("")} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
              </Pressable>
            )}
          </View>
          <Pressable
            onPress={() => setShowFilters(true)}
            style={[styles.filterBtn, { backgroundColor: colors.primary + "18" }]}
            hitSlop={8}
          >
            <Ionicons name="options-outline" size={20} color={colors.primary} />
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modeRow}>
          {FILTER_MODES.map((m) => (
            <Pressable
              key={m.key}
              onPress={() => setFilterMode(m.key)}
              style={[
                styles.modeChip,
                {
                  backgroundColor: filterMode === m.key ? colors.primary : colors.surfaceSecondary,
                },
              ]}
            >
              <Ionicons
                name={m.icon as any}
                size={14}
                color={filterMode === m.key ? "#FFF" : colors.textSecondary}
              />
              <Text
                style={[
                  styles.modeLabel,
                  { color: filterMode === m.key ? "#FFF" : colors.textSecondary },
                ]}
              >
                {m.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {filterMode === "date" && (
          <View style={styles.dateRow}>
            <View style={[styles.dateInput, { backgroundColor: colors.surfaceSecondary }]}>
              <Ionicons name="calendar-outline" size={14} color={colors.textTertiary} />
              <TextInput
                style={[styles.dateTextInput, { color: colors.text }]}
                value={startDate}
                onChangeText={setStartDate}
                placeholder="MM/DD/YYYY"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numbers-and-punctuation"
              />
            </View>
          </View>
        )}

        {filterMode === "dateRange" && (
          <View style={styles.dateRow}>
            <View style={[styles.dateInput, { backgroundColor: colors.surfaceSecondary, flex: 1 }]}>
              <TextInput
                style={[styles.dateTextInput, { color: colors.text }]}
                value={startDate}
                onChangeText={setStartDate}
                placeholder="From MM/DD/YYYY"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <Text style={{ color: colors.textTertiary, paddingHorizontal: 8 }}>→</Text>
            <View style={[styles.dateInput, { backgroundColor: colors.surfaceSecondary, flex: 1 }]}>
              <TextInput
                style={[styles.dateTextInput, { color: colors.text }]}
                value={endDate}
                onChangeText={setEndDate}
                placeholder="To MM/DD/YYYY"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numbers-and-punctuation"
              />
            </View>
          </View>
        )}

        {filterMode === "timeRange" && (
          <View style={styles.dateRow}>
            <View style={[styles.dateInput, { backgroundColor: colors.surfaceSecondary, flex: 1 }]}>
              <TextInput
                style={[styles.dateTextInput, { color: colors.text }]}
                value={startTime}
                onChangeText={setStartTime}
                placeholder="From HH:MM"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <Text style={{ color: colors.textTertiary, paddingHorizontal: 8 }}>→</Text>
            <View style={[styles.dateInput, { backgroundColor: colors.surfaceSecondary, flex: 1 }]}>
              <TextInput
                style={[styles.dateTextInput, { color: colors.text }]}
                value={endTime}
                onChangeText={setEndTime}
                placeholder="To HH:MM"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numbers-and-punctuation"
              />
            </View>
          </View>
        )}

        <View style={styles.searchActions}>
          <Pressable
            onPress={handleSearch}
            style={[styles.searchBtn, { backgroundColor: colors.primary }]}
          >
            <Feather name="search" size={16} color="#FFF" />
            <Text style={styles.searchBtnText}>Search</Text>
          </Pressable>
          {hasSearched && (
            <Pressable onPress={clearAll} style={[styles.clearBtn, { borderColor: colors.border }]}>
              <Text style={[styles.clearBtnText, { color: colors.textSecondary }]}>Clear</Text>
            </Pressable>
          )}
        </View>
      </View>

      {hasSearched ? (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={renderResult}
          ItemSeparatorComponent={() => (
            <View style={[styles.separator, { backgroundColor: colors.border, marginLeft: 72 }]} />
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No results</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                Try a different keyword or filter
              </Text>
            </View>
          }
          ListHeaderComponent={
            results.length > 0 ? (
              <Text style={[styles.resultCount, { color: colors.textSecondary }]}>
                {results.length} message{results.length !== 1 ? "s" : ""} found
              </Text>
            ) : null
          }
        />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={56} color={colors.textTertiary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Search Messages</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Search by keyword, date, time range,{"\n"}or filter by chat and person
          </Text>
        </View>
      )}

      <Modal visible={showFilters} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.filterModal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Pressable onPress={() => setShowFilters(false)}>
              <Text style={[{ color: colors.primary, fontSize: 16, fontFamily: "Inter_400Regular" }]}>Cancel</Text>
            </Pressable>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Filter By</Text>
            <Pressable onPress={() => { setSelectedChat(null); setSelectedSender(null); }}>
              <Text style={[{ color: colors.primary, fontSize: 16, fontFamily: "Inter_400Regular" }]}>Reset</Text>
            </Pressable>
          </View>

          <ScrollView style={{ flex: 1, padding: 20 }}>
            <Text style={[styles.filterSectionLabel, { color: colors.textTertiary }]}>FILTER BY CHAT</Text>
            <Pressable
              onPress={() => setSelectedChat(null)}
              style={[styles.filterOption, { backgroundColor: colors.surface, borderColor: !selectedChat ? colors.primary : colors.border }]}
            >
              <Ionicons name="chatbubbles-outline" size={18} color={!selectedChat ? colors.primary : colors.textSecondary} />
              <Text style={[styles.filterOptionText, { color: !selectedChat ? colors.primary : colors.text }]}>All Chats</Text>
              {!selectedChat && <Ionicons name="checkmark" size={18} color={colors.primary} />}
            </Pressable>
            {chats.filter((c) => c.type !== "checkin").map((c) => (
              <Pressable
                key={c.id}
                onPress={() => setSelectedChat(selectedChat === c.id ? null : c.id)}
                style={[styles.filterOption, { backgroundColor: colors.surface, borderColor: selectedChat === c.id ? colors.primary : colors.border }]}
              >
                <Text style={[styles.filterOptionText, { color: selectedChat === c.id ? colors.primary : colors.text }]}>{c.name}</Text>
                {selectedChat === c.id && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </Pressable>
            ))}

            <Text style={[styles.filterSectionLabel, { color: colors.textTertiary, marginTop: 24 }]}>FILTER BY PERSON</Text>
            <Pressable
              onPress={() => setSelectedSender(null)}
              style={[styles.filterOption, { backgroundColor: colors.surface, borderColor: !selectedSender ? colors.primary : colors.border }]}
            >
              <Text style={[styles.filterOptionText, { color: !selectedSender ? colors.primary : colors.text }]}>Anyone</Text>
              {!selectedSender && <Ionicons name="checkmark" size={18} color={colors.primary} />}
            </Pressable>
            {contacts.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => setSelectedSender(selectedSender === c.id ? null : c.id)}
                style={[styles.filterOption, { backgroundColor: colors.surface, borderColor: selectedSender === c.id ? colors.primary : colors.border }]}
              >
                <Avatar name={c.name} size={28} />
                <Text style={[styles.filterOptionText, { color: selectedSender === c.id ? colors.primary : colors.text }]}>{c.name}</Text>
                {selectedSender === c.id && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </Pressable>
            ))}
          </ScrollView>

          <View style={[styles.filterFooter, { paddingBottom: insets.bottom + 16 }]}>
            <Pressable
              onPress={() => setShowFilters(false)}
              style={[styles.applyBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.applyBtnText}>Apply Filters</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function HighlightedText({ text, highlight, colors }: { text: string; highlight: string; colors: any }) {
  if (!highlight.trim()) {
    return <Text style={[styles.resultText, { color: colors.textSecondary }]} numberOfLines={2}>{text}</Text>;
  }
  const parts = text.split(new RegExp(`(${highlight})`, "gi"));
  return (
    <Text style={[styles.resultText, { color: colors.textSecondary }]} numberOfLines={2}>
      {parts.map((part, i) =>
        part.toLowerCase() === highlight.toLowerCase() ? (
          <Text key={i} style={{ backgroundColor: colors.primary + "30", color: colors.primary, fontFamily: "Inter_600SemiBold" }}>
            {part}
          </Text>
        ) : (
          part
        )
      )}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  backBtn: { marginRight: 4 },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  filterBtn: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  modeRow: { flexGrow: 0 },
  modeChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    marginRight: 8,
    gap: 5,
  },
  modeLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  dateRow: { flexDirection: "row", alignItems: "center" },
  dateInput: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  dateTextInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  searchActions: { flexDirection: "row", gap: 10 },
  searchBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  searchBtnText: { color: "#FFF", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  clearBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  clearBtnText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  resultCount: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  resultItem: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
  },
  resultContent: { flex: 1, gap: 3 },
  resultHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  resultSender: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  resultTime: { fontSize: 11, fontFamily: "Inter_400Regular" },
  resultChat: { fontSize: 12, fontFamily: "Inter_500Medium" },
  resultText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  audioTag: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  audioTagText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  separator: { height: StyleSheet.hairlineWidth },
  emptyState: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 20, fontFamily: "Inter_600SemiBold", marginTop: 8 },
  emptySubtitle: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  filterModal: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  filterSectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5, marginBottom: 8 },
  filterOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 10,
    marginBottom: 8,
  },
  filterOptionText: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium" },
  filterFooter: { paddingHorizontal: 20 },
  applyBtn: { paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  applyBtnText: { color: "#FFF", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
