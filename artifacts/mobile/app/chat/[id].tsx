import { Feather, Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as ScreenCapture from "expo-screen-capture";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { BETA_CHAT_ID } from "@/utils/betaFeedback";
import { useMessaging, type Message } from "@/context/MessagingContext";
import { useServer } from "@/context/ServerContext";
import { useCall } from "@/context/CallContext";
import { useSkin } from "@/context/SkinContext";
import { useProfile } from "@/context/ProfileContext";
import { Avatar } from "@/components/Avatar";
import { ChatInput } from "@/components/ChatInput";
import { MessageBubble } from "@/components/MessageBubble";
import { TypingBubble } from "@/components/TypingBubble";

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);

  const { activeSkin } = useSkin();

  const {
    chats,
    myId,
    getDecryptedMessages,
    sendMessage,
    markImageViewed,
    editMessage,
    deleteMessage,
    addReaction,
    markChatRead,
    muteChat,
    getContactById,
    contacts,
    setActiveChatId,
  } = useMessaging();

  const { serverUserId, isConnected, onTyping, emitTyping, emitChatRead, getSuggestedReply } = useServer();
  const { profile } = useProfile();
  const [typingUsers, setTypingUsers] = useState<{ id: string; name: string; emoji?: string }[]>([]);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const { startCall } = useCall();

  const [shieldVisible, setShieldVisible] = useState(false);
  const shieldOpacity = useRef(new Animated.Value(0)).current;
  const [shieldConfig, setShieldConfig] = useState<{ text?: string; gifUrl?: string } | null>(null);

  // AI smart reply state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [aiTextToInject, setAiTextToInject] = useState<string | undefined>(undefined);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const suggestionSlide = useRef(new Animated.Value(60)).current;

  const chat = chats.find((c) => c.id === id);
  const messages = getDecryptedMessages(id);

  // Tell MessagingContext this chat is currently on screen so that incoming
  // messages (live or replayed via missed_messages) skip the unread increment.
  useEffect(() => {
    if (!id) return;
    setActiveChatId(id);
    return () => setActiveChatId(null);
  }, [id]);

  useEffect(() => {
    if (id) {
      markChatRead(id);
      if (chat?.isServerChat && serverUserId) {
        emitChatRead(id, serverUserId);
      }
    }
  }, [id, messages.length, chat?.isServerChat, serverUserId]);

  useEffect(() => {
    if (!chat?.isServerChat) return;
    const unsub = onTyping((data) => {
      if (data.chatId !== id) return;
      setTypingUsers((prev) => {
        if (data.typing) {
          if (prev.some((u) => u.id === data.userId)) return prev;
          return [...prev, { id: data.userId, name: data.name, emoji: data.emoji }];
        } else {
          return prev.filter((u) => u.id !== data.userId);
        }
      });
      if (data.typing) {
        setTimeout(() => {
          setTypingUsers((prev) => prev.filter((u) => u.id !== data.userId));
        }, 4000);
      }
    });
    return unsub;
  }, [id, chat?.isServerChat, onTyping]);

  const handleTypingChange = useCallback((text: string) => {
    if (!chat?.isServerChat || !serverUserId || !id) return;
    const myContact = contacts.find((c) => c.id === "me");
    const myName = myContact?.name ?? "Someone";
    const myEmoji = chat?.typingEmoji ?? profile.typingEmoji;
    if (text.length > 0 && !isTypingRef.current) {
      isTypingRef.current = true;
      emitTyping(id, serverUserId, myName, true, myEmoji);
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (isTypingRef.current) {
        isTypingRef.current = false;
        emitTyping(id, serverUserId, myName, false);
      }
    }, 2000);
  }, [chat?.isServerChat, serverUserId, id, contacts, emitTyping, chat?.typingEmoji, profile.typingEmoji]);

  const isGroup = chat?.type === "group";
  const otherId = !isGroup
    ? chat?.participantIds.find((pid) => pid !== myId)
    : null;
  const otherContact = otherId ? getContactById(otherId) : null;

  useEffect(() => {
    const msgs = getDecryptedMessages(id);
    const sdMessages = msgs.filter((m) => m.selfDestruct && !m.deleted);
    if (sdMessages.length === 0) return;
    const subscription = ScreenCapture.addScreenshotListener(() => {
      const latest = sdMessages[sdMessages.length - 1];
      const cfg = latest?.selfDestruct;
      if (!cfg) return;
      setShieldConfig({ text: cfg.shieldText, gifUrl: cfg.shieldGifUrl });
      setShieldVisible(true);
      shieldOpacity.setValue(0);
      Animated.timing(shieldOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setTimeout(() => {
        Animated.timing(shieldOpacity, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
          setShieldVisible(false);
        });
      }, 4000);
    });
    return () => subscription.remove();
  }, [id, messages.length]);

  const handleSend = useCallback(
    async (text: string, audio?: any, image?: any, formatting?: any, music?: any, selfDestruct?: any) => {
      if (!id) return;
      await sendMessage(id, text, audio, image, formatting, music, selfDestruct);
      setAiSuggestion(null);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    },
    [id, sendMessage]
  );

  const handleAiSuggest = useCallback(async () => {
    if (aiLoading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAiLoading(true);
    setAiSuggestion(null);

    // Build message context from recent messages (last 20 non-deleted)
    const recentMsgs = messages
      .filter((m) => !m.deleted && (m.text || "").trim())
      .slice(-20)
      .map((m) => ({
        sender: m.senderId === myId ? ("me" as const) : ("them" as const),
        senderName: m.senderId !== myId ? (getContactById(m.senderId)?.name ?? chat?.name) : undefined,
        text: m.text,
      }));

    const myDisplayName = contacts.find((c) => c.id === myId)?.name ?? profile.displayName;

    const suggestion = await getSuggestedReply({
      messages: recentMsgs,
      chatName: chat?.name,
      myName: myDisplayName,
      recipientLanguage: chat?.recipientLanguage,
    });

    setAiLoading(false);
    if (suggestion) {
      setAiSuggestion(suggestion);
      suggestionSlide.setValue(60);
      Animated.spring(suggestionSlide, {
        toValue: 0,
        useNativeDriver: true,
        tension: 160,
        friction: 18,
      }).start();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [aiLoading, messages, myId, chat, contacts, profile.displayName, getSuggestedReply, getContactById, suggestionSlide]);

  const handleImageViewed = useCallback(
    (messageId: string) => {
      if (!id) return;
      markImageViewed(id, messageId);
    },
    [id, markImageViewed]
  );

  const handleReact = useCallback(
    async (messageId: string, emoji: string) => {
      if (!id) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await addReaction(id, messageId, emoji);
    },
    [id, addReaction]
  );

  const toggleMessageSelection = useCallback((messageId: string) => {
    setSelectedMessageIds((current) => {
      if (current.includes(messageId)) return current.filter((id) => id !== messageId);
      if (current.length >= 150) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return current;
      }
      Haptics.selectionAsync();
      return [...current, messageId];
    });
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedMessageIds([]);
  }, []);

  const openSelectedMessageExport = useCallback(() => {
    if (selectedMessageIds.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: "/chat-settings/[id]",
      params: { id, selectedIds: selectedMessageIds.join(",") },
    });
  }, [id, selectedMessageIds]);

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const isBetaChat = id === BETA_CHAT_ID;

  if (!chat) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>Chat not found</Text>
      </View>
    );
  }

  const handleCallFromMessage = useCallback(
    (senderId: string, type: "voice" | "video") => {
      const contact = getContactById(senderId);
      const callName = contact?.name ?? senderId;
      startCall(senderId, callName, type);
      router.push({ pathname: "/call/[id]", params: { id: senderId, name: callName, type } });
    },
    [getContactById, startCall]
  );

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMine = item.senderId === myId;
    const prevMsg = messages[index - 1];
    const showSender =
      isGroup && !isMine && item.senderId !== prevMsg?.senderId;
    const sender = isGroup ? getContactById(item.senderId) : null;

    return (
      <MessageBubble
        message={item}
        isMine={isMine}
        showSender={showSender}
        senderName={sender?.name}
        myId={myId}
        activeSkin={activeSkin}
        onReact={(emoji) => handleReact(item.id, emoji)}
        onEdit={isMine ? (newText) => editMessage(id, item.id, newText) : undefined}
        onDelete={isMine ? () => deleteMessage(id, item.id) : undefined}
        onVoiceCall={!isMine ? () => handleCallFromMessage(item.senderId, "voice") : undefined}
        onVideoCall={!isMine ? () => handleCallFromMessage(item.senderId, "video") : undefined}
        onImageViewed={handleImageViewed}
        selectionMode={selectionMode}
        isSelected={selectedMessageIds.includes(item.id)}
        onLongPress={selectionMode ? () => toggleMessageSelection(item.id) : undefined}
      />
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad,
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable style={styles.headerCenter}>
          <Avatar
            name={chat.name}
            size={36}
            isOnline={otherContact?.isOnline}
          />
          <View style={styles.headerInfo}>
            <View style={styles.nameRowHeader}>
              <Text style={[styles.headerName, { color: colors.text }]}>
                {chat.name}
              </Text>
              {chat.isServerChat && isConnected && (
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>Live</Text>
                </View>
              )}
            </View>
            {typingUsers.length > 0 ? (
              <Text style={[styles.headerStatus, { color: "#0A84FF" }]}>
                {typingUsers.map((u) => u.name).join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing {typingUsers[0].emoji ?? "…"}
              </Text>
            ) : otherContact?.isOnline ? (
              <Text style={[styles.headerStatus, { color: colors.secondary }]}>
                Online
              </Text>
            ) : isGroup ? (
              <Text style={[styles.headerStatus, { color: colors.textSecondary }]}>
                {chat.participantIds.length} members
              </Text>
            ) : null}
          </View>
        </Pressable>

        <View style={styles.headerActions}>
          {chat.isEncrypted && (
            <Ionicons name="shield-checkmark" size={16} color={colors.secondary} style={{ marginRight: 2 }} />
          )}
          <Pressable
            hitSlop={10}
            style={styles.headerActionBtn}
            onPress={() => { Haptics.selectionAsync(); muteChat(id); }}
          >
            <Ionicons
              name={chat.isMuted ? "notifications-off" : "notifications-outline"}
              size={20}
              color={chat.isMuted ? colors.textTertiary : colors.primary}
            />
          </Pressable>
          {!isBetaChat && (
            <>
              <Pressable
                hitSlop={10}
                style={styles.headerActionBtn}
                onPress={() => {
                  const name = otherContact?.name ?? chat.name;
                  startCall(otherId ?? id, name, "video");
                  router.push({ pathname: "/call/[id]", params: { id: otherId ?? id, name, type: "video" } });
                }}
              >
                <Feather name="video" size={20} color={colors.primary} />
              </Pressable>
              <Pressable
                hitSlop={10}
                style={styles.headerActionBtn}
                onPress={() => {
                  const name = otherContact?.name ?? chat.name;
                  startCall(otherId ?? id, name, "voice");
                  router.push({ pathname: "/call/[id]", params: { id: otherId ?? id, name, type: "voice" } });
                }}
              >
                <Feather name="phone" size={20} color={colors.primary} />
              </Pressable>
            </>
          )}
          <Pressable
            hitSlop={10}
            style={styles.headerActionBtn}
            onPress={() => {
              Haptics.selectionAsync();
              setSelectionMode(true);
              setSelectedMessageIds([]);
            }}
          >
            <Feather name="check-square" size={19} color={colors.primary} />
          </Pressable>
          <Pressable
            hitSlop={10}
            style={styles.headerActionBtn}
            onPress={() => router.push(`/chat-settings/${id}`)}
          >
            <Feather name="more-horizontal" size={20} color={colors.primary} />
          </Pressable>
        </View>
      </View>

      {selectionMode && (
        <View style={[styles.selectionToolbar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Pressable hitSlop={8} onPress={exitSelectionMode} style={styles.selectionToolbarBtn}>
            <Text style={[styles.selectionToolbarText, { color: colors.primary }]}>Cancel</Text>
          </Pressable>
          <Text style={[styles.selectionCount, { color: colors.text }]}>
            {selectedMessageIds.length === 0 ? "Tap messages to select" : `${selectedMessageIds.length} selected`}
          </Text>
          <Pressable
            hitSlop={8}
            disabled={selectedMessageIds.length === 0}
            onPress={openSelectedMessageExport}
            style={[styles.selectionToolbarBtn, { opacity: selectedMessageIds.length === 0 ? 0.4 : 1 }]}
          >
            <Feather name="download" size={17} color={colors.primary} />
            <Text style={[styles.selectionToolbarText, { color: colors.primary }]}>Export</Text>
          </Pressable>
        </View>
      )}

      {isBetaChat && (
        <View style={[chatStyles.betaBanner, { backgroundColor: "#7B5EA720", borderBottomColor: "#7B5EA740" }]}>
          <Ionicons name="bug-outline" size={14} color="#7B5EA7" />
          <Text style={chatStyles.betaBannerText}>
            Beta Feedback · Messages go directly to the ZIVR team
          </Text>
          <View style={chatStyles.betaBadge}>
            <Text style={chatStyles.betaBadgeText}>BETA</Text>
          </View>
        </View>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <LinearGradient
          colors={activeSkin.chatBackground as [string, string]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          pointerEvents="none"
        />
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={[
            styles.messageList,
            { paddingBottom: 16 },
          ]}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: false })
          }
          ListFooterComponent={
            typingUsers.length > 0 ? (
              <TypingBubble
                key={typingUsers[0].id}
                name={isGroup ? typingUsers[0].name : undefined}
                emoji={typingUsers[0].emoji}
                colors={colors}
              />
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Avatar name={chat.name} size={80} />
              <Text style={[styles.emptyChatName, { color: colors.text }]}>
                {chat.name}
              </Text>
              <Text style={[styles.emptyChatText, { color: colors.textSecondary }]}>
                Start the conversation. You can also{"\n"}attach music to your message!
              </Text>
              <View
                style={[
                  styles.audioTip,
                  { backgroundColor: colors.audioAccent + "18" },
                ]}
              >
                <Ionicons
                  name="musical-notes"
                  size={16}
                  color={colors.audioAccent}
                />
                <Text
                  style={[styles.audioTipText, { color: colors.audioAccent }]}
                >
                  Tap the music note to attach an audio clip
                </Text>
              </View>
            </View>
          }
        />
        {/* AI Suggestion Card */}
        {aiSuggestion && !selectionMode && (
          <Animated.View
            style={[
              chatStyles.suggestionCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.primary + "40",
                transform: [{ translateY: suggestionSlide }],
              },
            ]}
          >
            <View style={chatStyles.suggestionHeader}>
              <View style={chatStyles.suggestionBadge}>
                <Text style={chatStyles.suggestionBadgeIcon}>✨</Text>
                <Text style={[chatStyles.suggestionBadgeText, { color: colors.primary }]}>AI Suggestion</Text>
              </View>
              <Pressable
                onPress={() => { setAiSuggestion(null); Haptics.selectionAsync(); }}
                hitSlop={10}
              >
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
            <ScrollView
              style={{ maxHeight: 100 }}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              <Text style={[chatStyles.suggestionText, { color: colors.text }]}>
                {aiSuggestion}
              </Text>
            </ScrollView>
            <View style={chatStyles.suggestionActions}>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setAiTextToInject(aiSuggestion);
                  setAiSuggestion(null);
                }}
                style={[chatStyles.suggestionBtn, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "40" }]}
              >
                <Ionicons name="create-outline" size={14} color={colors.primary} />
                <Text style={[chatStyles.suggestionBtnText, { color: colors.primary }]}>Edit</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  handleSend(aiSuggestion);
                  setAiSuggestion(null);
                }}
                style={[chatStyles.suggestionBtn, chatStyles.suggestionBtnSend, { backgroundColor: colors.primary }]}
              >
                <Ionicons name="send" size={14} color="#fff" />
                <Text style={[chatStyles.suggestionBtnText, { color: "#fff" }]}>Send</Text>
              </Pressable>
            </View>
          </Animated.View>
        )}

        {!selectionMode && <View style={[styles.bottomBar, { paddingBottom: insets.bottom, backgroundColor: colors.background }]}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={[styles.floatingBackBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Ionicons name="chevron-back" size={22} color={colors.primary} />
          </Pressable>
          {/* AI Smart Reply button */}
          <Pressable
            onPress={handleAiSuggest}
            hitSlop={10}
            style={[
              styles.floatingBackBtn,
              {
                backgroundColor: aiLoading ? colors.primary + "18" : colors.surface,
                borderColor: aiLoading ? colors.primary : colors.border,
                marginLeft: 6,
              },
            ]}
          >
            {aiLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={{ fontSize: 18 }}>✨</Text>
            )}
          </Pressable>
          <View style={{ flex: 1 }}>
            <ChatInput
              onSend={handleSend}
              onTextChange={handleTypingChange}
              suggestedText={aiTextToInject}
              onSuggestedTextConsumed={() => setAiTextToInject(undefined)}
            />
          </View>
        </View>}
      </KeyboardAvoidingView>

      {shieldVisible && (
        <Animated.View
          style={[chatStyles.shieldOverlay, { opacity: shieldOpacity }]}
          pointerEvents="none"
        >
          {shieldConfig?.gifUrl ? (
            <ExpoImage
              source={{ uri: shieldConfig.gifUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
          ) : (
            <View style={chatStyles.shieldTextContainer}>
              <Text style={chatStyles.shieldIcon}>🚫</Text>
              <Text style={chatStyles.shieldText}>
                {shieldConfig?.text ?? "Screenshot blocked"}
              </Text>
            </View>
          )}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  selectionToolbar: {
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  selectionToolbarBtn: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 64,
    gap: 5,
  },
  selectionToolbarText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  selectionCount: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  floatingBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 4,
  },
  headerInfo: {
    flex: 1,
  },
  nameRowHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerName: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#34C75920",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#34C759",
  },
  liveText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: "#34C759",
  },
  headerStatus: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  headerActions: {
    flexDirection: "row",
    gap: 4,
  },
  headerActionBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  messageList: {
    paddingTop: 16,
    gap: 2,
  },
  emptyChat: {
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyChatName: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    marginTop: 8,
  },
  emptyChatText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  audioTip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 8,
  },
  audioTipText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    flex: 1,
    lineHeight: 18,
  },
});

const chatStyles = StyleSheet.create({
  shieldOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
    zIndex: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  shieldTextContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 16,
  },
  shieldIcon: {
    fontSize: 64,
  },
  shieldText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    lineHeight: 30,
  },
  betaBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  betaBannerText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#7B5EA7",
  },
  betaBadge: {
    backgroundColor: "#7B5EA7",
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  betaBadgeText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: 0.5,
  },
  suggestionCard: {
    marginHorizontal: 10,
    marginBottom: 6,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 4,
  },
  suggestionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  suggestionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  suggestionBadgeIcon: {
    fontSize: 13,
  },
  suggestionBadgeText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  suggestionText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  suggestionActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
  },
  suggestionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  suggestionBtnSend: {
    borderWidth: 0,
  },
  suggestionBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
});
