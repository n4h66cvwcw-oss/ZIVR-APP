import { Feather, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useMessaging, type Message } from "@/context/MessagingContext";
import { useCall } from "@/context/CallContext";
import { useSkin } from "@/context/SkinContext";
import { Avatar } from "@/components/Avatar";
import { ChatInput } from "@/components/ChatInput";
import { MessageBubble } from "@/components/MessageBubble";

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
    addReaction,
    markChatRead,
    getContactById,
  } = useMessaging();

  const { startCall } = useCall();

  const chat = chats.find((c) => c.id === id);
  const messages = getDecryptedMessages(id);

  useEffect(() => {
    if (id) markChatRead(id);
  }, [id, messages.length]);

  const isGroup = chat?.type === "group";
  const otherId = !isGroup
    ? chat?.participantIds.find((pid) => pid !== myId)
    : null;
  const otherContact = otherId ? getContactById(otherId) : null;

  const handleSend = useCallback(
    async (text: string, audio?: any, image?: any, formatting?: any, music?: any) => {
      if (!id) return;
      await sendMessage(id, text, audio, image, formatting, music);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    },
    [id, sendMessage]
  );

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

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

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
        onVoiceCall={!isMine ? () => handleCallFromMessage(item.senderId, "voice") : undefined}
        onVideoCall={!isMine ? () => handleCallFromMessage(item.senderId, "video") : undefined}
        onImageViewed={handleImageViewed}
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
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={26} color={colors.primary} />
          <Text style={[styles.backText, { color: colors.primary }]}>Back</Text>
        </Pressable>

        <Pressable style={styles.headerCenter}>
          <Avatar
            name={chat.name}
            size={36}
            isOnline={otherContact?.isOnline}
          />
          <View style={styles.headerInfo}>
            <Text style={[styles.headerName, { color: colors.text }]}>
              {chat.name}
            </Text>
            {otherContact?.isOnline ? (
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
          <Pressable
            hitSlop={10}
            style={styles.headerActionBtn}
            onPress={() => router.push(`/chat-settings/${id}`)}
          >
            <Feather name="more-horizontal" size={20} color={colors.primary} />
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={0}
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
        <View style={{ paddingBottom: insets.bottom }}>
          <ChatInput onSend={handleSend} />
        </View>
      </KeyboardAvoidingView>
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
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
  },
  backText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
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
  headerName: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
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
