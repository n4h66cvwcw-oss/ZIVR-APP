import AsyncStorage from "@react-native-async-storage/async-storage";
import { scheduleLocalNotification } from "@/utils/notifications";
import { BETA_CHAT_ID, queueFeedbackSubmission } from "@/utils/betaFeedback";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  encryptMessage,
  decryptMessage,
  hashPasscode,
  generateEncryptionKey,
} from "@/utils/crypto";
import { Alert } from "react-native";
import { useServer, type MessageDelivery, type ServerMessage, type ServerUser } from "@/context/ServerContext";
import { useProfile } from "@/context/ProfileContext";

export type AudioAttachment = {
  uri: string;
  name: string;
  duration?: number;
  startTime?: number;
  endTime?: number;
};

export type ImageAttachment = {
  uri: string;
  width?: number;
  height?: number;
  security: "none" | "password" | "single-view" | "timed";
  password?: string;
  viewAfter?: number;
  viewedBy?: string[];
};

export type MessageFormatting = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSize?: "sm" | "md" | "lg" | "xl";
  textColor?: string;
  backgroundGifUrl?: string;
};

export type MusicPlayMode = "once" | "loop" | "delayed";

export type MusicAttachment = {
  id: string;
  title: string;
  artist: string;
  genre: string;
  mood: string;
  colors: [string, string];
  emoji: string;
  duration: number;
  uri?: string;
  artworkUrl?: string;
  clipStart: number;
  clipEnd: number;
  playMode: MusicPlayMode;
  delaySeconds?: number;
};

export type SelfDestructConfig = {
  duration: number;
  shieldText?: string;
  shieldGifUrl?: string;
};

export type Message = {
  id: string;
  chatId: string;
  text: string;
  senderId: string;
  timestamp: number;
  audioAttachment?: AudioAttachment;
  imageAttachment?: ImageAttachment;
  musicAttachment?: MusicAttachment;
  formatting?: MessageFormatting;
  reactions?: Record<string, string[]>;
  read?: boolean;
  deliveredAt?: number;
  deleted?: boolean;
  editedAt?: number;
  selfDestruct?: SelfDestructConfig;
  /** Set when the message was auto-translated before sending */
  wasTranslated?: boolean;
  translatedTo?: string;
  /** The original text before auto-translation */
  originalText?: string;
};

export type ChatSortMode =
  | "recent"
  | "unread"
  | "alphabetical"
  | "oldest"
  | "pinned-first";

export type Chat = {
  id: string;
  type: "direct" | "group" | "checkin";
  name: string;
  participantIds: string[];
  lastMessage?: string;
  lastMessageTime?: number;
  lastAudio?: AudioAttachment;
  createdAt: number;
  isPinned?: boolean;
  isMuted?: boolean;
  unreadCount?: number;
  avatar?: string;
  description?: string;
  isEncrypted?: boolean;
  encryptionKey?: string;
  passcodeHash?: string;
  passcodeSalt?: string;
  recoveryEmail?: string;
  passcodeHint?: string;
  isServerChat?: boolean;
  notificationSound?: string;
  readReceiptsEnabled?: boolean;
  typingEmoji?: string;
  /** Language code of the recipient — triggers auto-translate on send */
  recipientLanguage?: string;
};

export type CheckInGroup = {
  id: string;
  name: string;
  memberIds: string[];
  createdAt: number;
  anonymous: boolean;
  description?: string;
  creatorId?: string;
};

export type BroadcastDeadline = {
  timestamp: number;
  label: string;
};

export type CheckInBroadcast = {
  id: string;
  groupId: string;
  senderId: string;
  text: string;
  audioAttachment?: AudioAttachment;
  timestamp: number;
  replies: Record<string, CheckInReply[]>;
  privateSideChats: Record<string, Message[]>;
  deadline?: number;
  myReply?: string;
};

export type CheckInReply = {
  id: string;
  memberId: string;
  text: string;
  audioAttachment?: AudioAttachment;
  timestamp: number;
  read?: boolean;
};

export type Contact = {
  id: string;
  name: string;
  phone?: string;
  avatar?: string;
  status?: string;
  lastSeen?: number;
  isOnline?: boolean;
};

export type SearchFilter = {
  query?: string;
  startDate?: number;
  endDate?: number;
  startTime?: string;
  endTime?: string;
  chatId?: string;
  senderId?: string;
};

const STORAGE_KEYS = {
  CHATS: "@zivr_chats",
  MESSAGES: "@zivr_messages",
  CHECKIN_GROUPS: "@zivr_checkin_groups",
  BROADCASTS: "@zivr_broadcasts",
  CONTACTS: "@zivr_contacts",
  ME: "@zivr_me",
  SORT_MODE: "@zivr_sort_mode",
};

const SIMULATE_REPLIES = [
  "All good on my end! 👍",
  "Checked in ✓",
  "Here! Everything's fine",
  "Will update you shortly",
  "Running a bit late but on it 🏃",
  "Present and accounted for 👋",
  "Doing great, thanks for checking!",
  "All good here!",
  "On it! 🔥",
  "Just saw this — I'm good",
  "Yes, still on track",
  "👍 Got it!",
  "Confirmed ✓",
  "I'm in!",
  "Copy that 📋",
  "Good here, no issues",
  "Solid, thanks for checking in",
  "Yep, all systems go 🚀",
];

const NOW = Date.now();
const SEED_GROUP_ID = "seed-rcv-group-1";
const SEED_BROADCAST_ID = "seed-rcv-broadcast-1";

const SEED_RECEIVED_GROUP: CheckInGroup = {
  id: SEED_GROUP_ID,
  name: "Weekend Warriors",
  memberIds: ["me", "c2", "c3", "c4"],
  createdAt: NOW - 86400000,
  anonymous: false,
  creatorId: "c1",
};

const SEED_RECEIVED_BROADCAST: CheckInBroadcast = {
  id: SEED_BROADCAST_ID,
  groupId: SEED_GROUP_ID,
  senderId: "c1",
  text: "Hey team! Quick check-in — what's everyone up to this weekend? Got a group hike planned 🏔️ Let me know if you're in or have other plans.",
  timestamp: NOW - 3600000,
  replies: {
    c2: [{ id: "seed-r1", memberId: "c2", text: "I'm in! Let's do it 🏔️", timestamp: NOW - 3400000, read: false }],
    c3: [{ id: "seed-r2", memberId: "c3", text: "Sounds amazing, count me in!", timestamp: NOW - 3000000, read: false }],
  },
  privateSideChats: {},
  myReply: undefined,
};

const SAMPLE_CONTACTS: Contact[] = [
  { id: "me", name: "You", isOnline: true },
  {
    id: "c1",
    name: "Sarah Johnson",
    status: "Always up for an adventure",
    isOnline: true,
    lastSeen: Date.now() - 60000,
  },
  {
    id: "c2",
    name: "Mike Chen",
    status: "Living life to the fullest",
    isOnline: false,
    lastSeen: Date.now() - 3600000,
  },
  {
    id: "c3",
    name: "Emma Williams",
    status: "Coffee and code",
    isOnline: true,
    lastSeen: Date.now() - 120000,
  },
  {
    id: "c4",
    name: "James Brown",
    status: "Making music every day",
    isOnline: false,
    lastSeen: Date.now() - 86400000,
  },
  {
    id: "c5",
    name: "Lisa Martinez",
    status: "Spreading good vibes",
    isOnline: true,
    lastSeen: Date.now() - 300000,
  },
  {
    id: "c6",
    name: "David Kim",
    status: "Building something great",
    isOnline: false,
    lastSeen: Date.now() - 7200000,
  },
  {
    id: "c7",
    name: "Zoe Thompson",
    status: "Music is my therapy",
    isOnline: true,
    lastSeen: Date.now() - 30000,
  },
  {
    id: "zivr-team",
    name: "ZIVR Team",
    status: "Reading your feedback 👀",
    isOnline: true,
  },
];

const BETA_CHAT: Chat = {
  id: BETA_CHAT_ID,
  type: "direct",
  name: "ZIVR Beta Feedback",
  participantIds: ["me", "zivr-team"],
  createdAt: 0,
  isPinned: true,
  unreadCount: 0,
  description: "Send bugs, issues and feedback directly to the ZIVR team",
  lastMessage: "👋 Welcome to the ZIVR Beta! Send us any bugs or feedback here.",
  lastMessageTime: Date.now() - 500,
};

const BETA_WELCOME_MSG: Message = {
  id: "beta-welcome-msg-1",
  chatId: BETA_CHAT_ID,
  text: "👋 Welcome to the ZIVR Beta!\n\nThis is your direct line to the ZIVR team. Send us any bugs, issues, or feedback you find — we read every message and use your reports to make the app better.\n\nThank you for testing ZIVR! 🚀",
  senderId: "zivr-team",
  timestamp: Date.now() - 500,
  read: true,
};

interface MessagingContextValue {
  myId: string;
  contacts: Contact[];
  chats: Chat[];
  messages: Record<string, Message[]>;
  checkInGroups: CheckInGroup[];
  broadcasts: CheckInBroadcast[];
  sortMode: ChatSortMode;
  setSortMode: (mode: ChatSortMode) => Promise<void>;
  /** Register the chat currently on screen so incoming messages skip the unread increment. */
  setActiveChatId: (id: string | null) => void;
  sendMessage: (chatId: string, text: string, audio?: AudioAttachment, image?: ImageAttachment, formatting?: MessageFormatting, music?: MusicAttachment, selfDestruct?: SelfDestructConfig) => Promise<void>;
  markImageViewed: (chatId: string, messageId: string) => Promise<void>;
  createDirectChat: (contactId: string) => Promise<string>;
  createServerDirectChat: (serverUser: ServerUser) => Promise<{ chatId: string; approval?: "pending" | "blocked"; error?: string }>;
  createGroupChat: (name: string, participantIds: string[], description?: string) => Promise<string>;
  createCheckInGroup: (name: string, memberIds: string[], anonymous?: boolean) => Promise<string>;
  sendBroadcast: (groupId: string, text: string, audio?: AudioAttachment) => Promise<string>;
  replyToBroadcast: (broadcastId: string, text: string, audio?: AudioAttachment) => Promise<void>;
  replyToReceivedBroadcast: (broadcastId: string, text: string) => Promise<void>;
  sendPrivateSideChat: (broadcastId: string, memberId: string, text: string, audio?: AudioAttachment) => Promise<void>;
  markBroadcastRepliesRead: (broadcastId: string) => Promise<void>;
  getReceivedBroadcasts: () => Array<{ broadcast: CheckInBroadcast; group: CheckInGroup; sender: Contact | undefined }>;
  getBroadcastReplyStats: (broadcastId: string) => { total: number; replied: number; pending: string[] };
  editMessage: (chatId: string, messageId: string, newText: string) => Promise<void>;
  addReaction: (chatId: string, messageId: string, emoji: string) => Promise<void>;
  markChatRead: (chatId: string) => Promise<void>;
  deleteChat: (chatId: string) => Promise<void>;
  deleteMessage: (chatId: string, messageId: string) => Promise<void>;
  pinChat: (chatId: string) => Promise<void>;
  muteChat: (chatId: string) => Promise<void>;
  setNotificationSound: (chatId: string, sound: string) => Promise<void>;
  setReadReceiptsEnabled: (chatId: string, enabled: boolean) => Promise<void>;
  setChatTypingEmoji: (chatId: string, emoji: string) => Promise<void>;
  setChatRecipientLanguage: (chatId: string, lang: string | undefined) => Promise<void>;
  addMemberToCheckIn: (groupId: string, memberId: string) => Promise<void>;
  removeMemberFromCheckIn: (groupId: string, memberId: string) => Promise<void>;
  getContactById: (id: string) => Contact | undefined;
  updateContacts: (contacts: Contact[]) => Promise<void>;
  getChatMessages: (chatId: string) => Message[];
  /** Replace a chat's messages wholesale (e.g. cloud-backup restore) and persist. */
  replaceChatMessages: (chatId: string, msgs: Message[]) => Promise<void>;
  getBroadcastsForGroup: (groupId: string) => CheckInBroadcast[];
  setChatPasscode: (chatId: string, passcode: string, recoveryEmail?: string, hint?: string) => Promise<void>;
  removeChatPasscode: (chatId: string) => Promise<void>;
  verifyChatPasscode: (chatId: string, passcode: string) => boolean;
  enableChatEncryption: (chatId: string) => Promise<string>;
  disableChatEncryption: (chatId: string) => Promise<void>;
  getDecryptedMessages: (chatId: string) => Message[];
  searchMessages: (filter: SearchFilter) => Array<Message & { chatName: string }>;
  generateChatPdfHtml: (chatId: string) => string;
}

const MessagingContext = createContext<MessagingContextValue | null>(null);

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

type MissedNotificationGroup = {
  count: number;
  senderId: string;
  senderName: string;
  lastText: string;
  hasMultipleSenders: boolean;
};

export function MessagingProvider({ children }: { children: React.ReactNode }) {
  const { serverUserId, onNewMessage, sendServerMessage, getOrCreateDirectChat, onReadReceipt, fetchUserChats, translateMessage, onMessageBlocked, onContactRequest } = useServer();
  const { profile } = useProfile();
  const myId = serverUserId ?? "me";
  const [contacts, setContactsState] = useState<Contact[]>(SAMPLE_CONTACTS);
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [checkInGroups, setCheckInGroups] = useState<CheckInGroup[]>([]);
  const [broadcasts, setBroadcasts] = useState<CheckInBroadcast[]>([]);
  const [sortMode, setSortModeState] = useState<ChatSortMode>("recent");

  const sentLocalIds = useRef<Set<string>>(new Set());
  // Synchronous guard: message IDs that have already been dispatched into state.
  // Updated atomically at the top of the onNewMessage handler so that two
  // rapid deliveries of the same server ID (e.g. socket auto-reconnect +
  // missed_messages replay arriving before a re-render) are both caught even
  // before React has had a chance to commit and run effects.
  const seenMessageIds = useRef<Set<string>>(new Set());
  // Messages that arrive before AsyncStorage hydration completes are buffered
  // here and replayed once hydration finishes, preventing a race where a
  // setMessages(loadedSnapshot) call would silently overwrite them.
  const hydrationComplete = useRef(false);
  const preHydrationBuffer = useRef<ServerMessage[]>([]);
  const chatsRef = useRef(chats);
  const messagesRef = useRef(messages);
  const missedNotificationGroups = useRef<Map<string, MissedNotificationGroup>>(new Map());
  const missedNotificationFlushScheduled = useRef(false);
  useEffect(() => { chatsRef.current = chats; }, [chats]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // Always-current server user id without stale closure captures.
  const serverUserIdRef = useRef(serverUserId);
  useEffect(() => { serverUserIdRef.current = serverUserId; }, [serverUserId]);

  // The chat screen sets this to its own id while mounted so that incoming
  // messages (live or missed) for that chat don't transiently bump the badge.
  const activeChatIdRef = useRef<string | null>(null);
  const setActiveChatId = useCallback((id: string | null) => {
    activeChatIdRef.current = id;
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const unsub = onNewMessage((msg, delivery: MessageDelivery = "live") => {
      if (sentLocalIds.current.has(msg.localId ?? "")) {
        sentLocalIds.current.delete(msg.localId!);
        return;
      }
      // If storage hydration hasn't finished yet, buffer the message so that
      // the upcoming setMessages(loadedSnapshot) call cannot silently overwrite
      // it. The buffer is drained synchronously at the end of loadData().
      if (!hydrationComplete.current) {
        preHydrationBuffer.current.push(msg);
        return;
      }
      // Atomically mark this server ID as seen. If it was already in the set
      // (e.g. both socket auto-reconnect and missed_messages replay delivered it
      // before the next render), bail out immediately so neither setMessages nor
      // setChats run a second time.
      if (seenMessageIds.current.has(msg.id)) return;
      seenMessageIds.current.add(msg.id);
      const chatId = msg.chatId;
      const newMsg: Message = {
        id: msg.id,
        chatId,
        text: msg.text,
        senderId: msg.senderId,
        timestamp: msg.createdAt,
        read: false,
      };
      setMessages((prev) => {
        const existing = prev[chatId] || [];
        if (existing.some((m) => m.id === msg.id)) return prev;
        const updated = { ...prev, [chatId]: [...existing, newMsg] };
        AsyncStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(updated)).catch(() => {});
        return updated;
      });

      if (delivery === "missed") {
        const senderName = msg.senderName || "New message";
        const existing = missedNotificationGroups.current.get(chatId);
        missedNotificationGroups.current.set(chatId, existing
          ? {
              ...existing,
              count: existing.count + 1,
              lastText: msg.text,
              hasMultipleSenders: existing.hasMultipleSenders || existing.senderId !== msg.senderId,
            }
          : {
              count: 1,
              senderId: msg.senderId,
              senderName,
              lastText: msg.text,
              hasMultipleSenders: false,
            });

        if (!missedNotificationFlushScheduled.current) {
          missedNotificationFlushScheduled.current = true;
          Promise.resolve().then(() => {
            missedNotificationFlushScheduled.current = false;
            const pending = missedNotificationGroups.current;
            missedNotificationGroups.current = new Map();

            pending.forEach((group, pendingChatId) => {
              const chat = chatsRef.current.find((c) => c.id === pendingChatId);
              const sound = chat?.notificationSound ?? "default";
              if (chat?.isMuted || sound === "none") return;

              const title = group.count === 1
                ? group.senderName
                : group.hasMultipleSenders
                  ? `${group.count} new messages`
                  : `${group.count} new messages from ${group.senderName}`;
              scheduleLocalNotification(title, group.lastText, sound).catch(() => {});
            });
          });
        }
      }

      setChats((prev) => {
        const chat = prev.find((c) => c.id === chatId);
        const sound = chat?.notificationSound ?? "default";
        if (delivery === "live" && !chat?.isMuted && sound !== "none") {
          const senderName = msg.senderName || "New message";
          scheduleLocalNotification(senderName, msg.text, sound).catch(() => {});
        }
        // Messages the current user sent, and messages in the currently open
        // chat, should not increment the unread badge. The chat screen's own
        // markChatRead effect handles clearing any residual count when the user
        // enters a chat, so we only need to guard the increment here.
        const isOwnMessage = !!serverUserIdRef.current && msg.senderId === serverUserIdRef.current;
        const isActiveChat = activeChatIdRef.current === chatId;
        const shouldCount = !isOwnMessage && !isActiveChat;
        if (!chat) {
          const placeholder: Chat = {
            id: chatId,
            type: "direct",
            name: msg.senderName || "Unknown",
            participantIds: [msg.senderId],
            createdAt: msg.createdAt,
            unreadCount: shouldCount ? 1 : 0,
            lastMessage: msg.text,
            lastMessageTime: msg.createdAt,
            isServerChat: true,
          };
          const updated = [placeholder, ...prev];
          AsyncStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(updated)).catch(() => {});
          return updated;
        }
        const updated = prev.map((c) =>
          c.id === chatId
            ? {
                ...c,
                lastMessage: msg.text,
                lastMessageTime: msg.createdAt,
                unreadCount: shouldCount ? (c.unreadCount || 0) + 1 : (c.unreadCount || 0),
              }
            : c
        );
        AsyncStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(updated)).catch(() => {});
        return updated;
      });
    });
    return unsub;
  }, [onNewMessage]);

  // Surface parental contact-approval blocks: a message the server refused to
  // deliver is removed from local state (it was added optimistically) and the
  // child sees a "waiting for parent approval" (or blocked) alert.
  useEffect(() => {
    const unsub = onMessageBlocked((data) => {
      const { chatId, localId } = data;
      if (localId) {
        sentLocalIds.current.delete(localId);
        setMessages((prev) => {
          const chatMsgs = prev[chatId] || [];
          const filtered = chatMsgs.filter((m) => m.id !== localId);
          if (filtered.length === chatMsgs.length) return prev;
          const updated = { ...prev, [chatId]: filtered };
          AsyncStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(updated)).catch(() => {});
          // Revert the chat's last-message preview to the last delivered message
          setChats((prevChats) => {
            const last = filtered[filtered.length - 1];
            const updatedChats = prevChats.map((c) =>
              c.id === chatId
                ? { ...c, lastMessage: last?.text ?? "", lastMessageTime: last?.timestamp }
                : c
            );
            AsyncStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(updatedChats)).catch(() => {});
            return updatedChats;
          });
          return updated;
        });
      }
      Alert.alert(
        data.status === "blocked" ? "Contact blocked" : "Waiting for parent approval",
        data.message
      );
    });
    return unsub;
  }, [onMessageBlocked]);

  // In-app parent notification: a child tried to chat with someone new
  useEffect(() => {
    const unsub = onContactRequest((data) => {
      Alert.alert(
        "New contact request",
        `${data.childName} wants to chat with ${data.contactName}. Review the request in Parental Controls.`
      );
    });
    return unsub;
  }, [onContactRequest]);

  useEffect(() => {
    if (!serverUserId) return;
    fetchUserChats(serverUserId).then((serverChats) => {
      if (!serverChats.length) return;
      setChats((prev) => {
        const merged = [...prev];
        let changed = false;
        for (const sc of serverChats) {
          if (merged.some((c) => c.id === sc.id)) continue;
          const members = sc.members ?? [];
          const otherMembers = members.filter((m) => m.id !== serverUserId);
          const chatName =
            sc.type === "direct"
              ? (otherMembers[0]?.displayName ?? sc.name ?? "Chat")
              : (sc.name ?? "Group");
          merged.push({
            id: sc.id,
            type: sc.type,
            name: chatName,
            participantIds: members.map((m) => m.id),
            createdAt: sc.lastMessageAt ?? Date.now(),
            unreadCount: 0,
            isServerChat: true,
          });
          changed = true;
        }
        if (!changed) return prev;
        AsyncStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(merged)).catch(() => {});
        return merged;
      });
    }).catch(() => {});
  }, [serverUserId, fetchUserChats]);

  useEffect(() => {
    const unsub = onReadReceipt((data) => {
      setMessages((prev) => {
        const chatMsgs = prev[data.chatId];
        if (!chatMsgs) return prev;
        const updated = {
          ...prev,
          [data.chatId]: chatMsgs.map((m) =>
            m.senderId === "me" || m.senderId === serverUserId
              ? { ...m, read: true, deliveredAt: data.readAt }
              : m
          ),
        };
        AsyncStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(updated)).catch(() => {});
        return updated;
      });
    });
    return unsub;
  }, [onReadReceipt, serverUserId]);

  async function loadData() {
    try {
      const [chatsStr, messagesStr, groupsStr, broadcastsStr, sortStr, contactsStr] =
        await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.CHATS),
          AsyncStorage.getItem(STORAGE_KEYS.MESSAGES),
          AsyncStorage.getItem(STORAGE_KEYS.CHECKIN_GROUPS),
          AsyncStorage.getItem(STORAGE_KEYS.BROADCASTS),
          AsyncStorage.getItem(STORAGE_KEYS.SORT_MODE),
          AsyncStorage.getItem(STORAGE_KEYS.CONTACTS),
        ]);

      if (contactsStr) {
        const saved: Contact[] = JSON.parse(contactsStr);
        const hasMe = saved.some((c) => c.id === "me");
        setContactsState(hasMe ? saved : [SAMPLE_CONTACTS[0], ...saved]);
      }

      if (chatsStr) {
        const loadedChats: Chat[] = JSON.parse(chatsStr);
        const hasBetaChat = loadedChats.some((c) => c.id === BETA_CHAT_ID);
        const finalChats = hasBetaChat ? loadedChats : [BETA_CHAT, ...loadedChats];
        setChats(finalChats);
        if (!hasBetaChat) {
          await AsyncStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(finalChats));
        }
      } else {
        setChats([BETA_CHAT]);
        await AsyncStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify([BETA_CHAT]));
      }

      // Collect the persisted message snapshot; do NOT call setMessages yet —
      // we wait until after the buffer drain below so a single state update
      // includes any messages that arrived during AsyncStorage hydration.
      let finalMsgs: Record<string, Message[]>;
      if (messagesStr) {
        const loadedMsgs: Record<string, Message[]> = JSON.parse(messagesStr);
        if (!loadedMsgs[BETA_CHAT_ID]) {
          loadedMsgs[BETA_CHAT_ID] = [BETA_WELCOME_MSG];
          await AsyncStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(loadedMsgs));
        }
        finalMsgs = loadedMsgs;
      } else {
        finalMsgs = { [BETA_CHAT_ID]: [BETA_WELCOME_MSG] };
        await AsyncStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(finalMsgs));
      }

      if (groupsStr) {
        const loadedGroups: CheckInGroup[] = JSON.parse(groupsStr);
        const hasSeed = loadedGroups.some((g) => g.id === SEED_GROUP_ID);
        setCheckInGroups(hasSeed ? loadedGroups : [SEED_RECEIVED_GROUP, ...loadedGroups]);
        if (!hasSeed) {
          await AsyncStorage.setItem(STORAGE_KEYS.CHECKIN_GROUPS, JSON.stringify([SEED_RECEIVED_GROUP, ...loadedGroups]));
        }
      } else {
        setCheckInGroups([SEED_RECEIVED_GROUP]);
        await AsyncStorage.setItem(STORAGE_KEYS.CHECKIN_GROUPS, JSON.stringify([SEED_RECEIVED_GROUP]));
      }

      if (broadcastsStr) {
        const loadedBroadcasts: CheckInBroadcast[] = JSON.parse(broadcastsStr);
        const hasSeedBroadcast = loadedBroadcasts.some((b) => b.id === SEED_BROADCAST_ID);
        setBroadcasts(hasSeedBroadcast ? loadedBroadcasts : [SEED_RECEIVED_BROADCAST, ...loadedBroadcasts]);
        if (!hasSeedBroadcast) {
          await AsyncStorage.setItem(STORAGE_KEYS.BROADCASTS, JSON.stringify([SEED_RECEIVED_BROADCAST, ...loadedBroadcasts]));
        }
      } else {
        setBroadcasts([SEED_RECEIVED_BROADCAST]);
        await AsyncStorage.setItem(STORAGE_KEYS.BROADCASTS, JSON.stringify([SEED_RECEIVED_BROADCAST]));
      }

      if (sortStr) setSortModeState(sortStr as ChatSortMode);

      // ── Finalize message state (synchronous from here to the end) ──────────
      // 1. Populate seenMessageIds from everything already persisted so that
      //    replays of those messages are silently ignored going forward.
      Object.values(finalMsgs).forEach((msgs) =>
        msgs.forEach((m) => seenMessageIds.current.add(m.id))
      );

      // 2. Drain messages that arrived while we were awaiting AsyncStorage.
      //    Merge them into finalMsgs so the single setMessages call below
      //    includes both persisted and buffered messages.
      const buffered = preHydrationBuffer.current.splice(0);
      const bufferedForChats: ServerMessage[] = [];
      for (const msg of buffered) {
        if (seenMessageIds.current.has(msg.id)) continue;
        seenMessageIds.current.add(msg.id);
        const chatId = msg.chatId;
        const existing = finalMsgs[chatId] || [];
        const newMsg: Message = {
          id: msg.id,
          chatId,
          text: msg.text,
          senderId: msg.senderId,
          timestamp: msg.createdAt,
          read: false,
        };
        finalMsgs = { ...finalMsgs, [chatId]: [...existing, newMsg] };
        bufferedForChats.push(msg);
      }

      // 3. Commit messages state (single call covers both persisted + buffered).
      setMessages(finalMsgs);
      // Persist the merged snapshot so buffered messages survive app restarts.
      if (bufferedForChats.length) {
        AsyncStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(finalMsgs)).catch(() => {});
      }

      // 4. Apply chat-list updates for any genuinely new buffered messages.
      if (bufferedForChats.length) {
        setChats((prev) => {
          let updated = prev;
          for (const msg of bufferedForChats) {
            const chatId = msg.chatId;
            const isOwnMessage = !!serverUserIdRef.current && msg.senderId === serverUserIdRef.current;
            const isActiveChat = activeChatIdRef.current === chatId;
            const shouldCount = !isOwnMessage && !isActiveChat;
            const chat = updated.find((c) => c.id === chatId);
            if (!chat) {
              const placeholder: Chat = {
                id: chatId,
                type: "direct",
                name: msg.senderName || "Unknown",
                participantIds: [msg.senderId],
                createdAt: msg.createdAt,
                unreadCount: shouldCount ? 1 : 0,
                lastMessage: msg.text,
                lastMessageTime: msg.createdAt,
                isServerChat: true,
              };
              updated = [placeholder, ...updated];
            } else {
              updated = updated.map((c) =>
                c.id === chatId
                  ? {
                      ...c,
                      lastMessage: msg.text,
                      lastMessageTime: msg.createdAt,
                      unreadCount: shouldCount ? (c.unreadCount || 0) + 1 : (c.unreadCount || 0),
                    }
                  : c
              );
            }
          }
          AsyncStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(updated)).catch(() => {});
          return updated;
        });
      }

      // 5. Open the gate — from now on the handler processes messages directly.
      hydrationComplete.current = true;
    } catch (e) {
      console.error("Error loading data:", e);
      // Open the gate first so the handler can process new messages normally.
      hydrationComplete.current = true;
      // Drain any messages that were buffered before the error by dispatching
      // them through the normal handler path (seenMessageIds + state updates).
      const bufferedOnError = preHydrationBuffer.current.splice(0);
      for (const msg of bufferedOnError) {
        if (seenMessageIds.current.has(msg.id)) continue;
        seenMessageIds.current.add(msg.id);
        const chatId = msg.chatId;
        const newMsg: Message = {
          id: msg.id,
          chatId,
          text: msg.text,
          senderId: msg.senderId,
          timestamp: msg.createdAt,
          read: false,
        };
        setMessages((prev) => {
          const existing = prev[chatId] || [];
          if (existing.some((m) => m.id === msg.id)) return prev;
          const updated = { ...prev, [chatId]: [...existing, newMsg] };
          AsyncStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(updated)).catch(() => {});
          return updated;
        });
        const isOwnMessage = !!serverUserIdRef.current && msg.senderId === serverUserIdRef.current;
        const isActiveChat = activeChatIdRef.current === chatId;
        const shouldCount = !isOwnMessage && !isActiveChat;
        setChats((prev) => {
          const chat = prev.find((c) => c.id === chatId);
          if (!chat) {
            const placeholder: Chat = {
              id: chatId,
              type: "direct",
              name: msg.senderName || "Unknown",
              participantIds: [msg.senderId],
              createdAt: msg.createdAt,
              unreadCount: shouldCount ? 1 : 0,
              lastMessage: msg.text,
              lastMessageTime: msg.createdAt,
              isServerChat: true,
            };
            const updated = [placeholder, ...prev];
            AsyncStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(updated)).catch(() => {});
            return updated;
          }
          const updated = prev.map((c) =>
            c.id === chatId
              ? {
                  ...c,
                  lastMessage: msg.text,
                  lastMessageTime: msg.createdAt,
                  unreadCount: shouldCount ? (c.unreadCount || 0) + 1 : (c.unreadCount || 0),
                }
              : c
          );
          AsyncStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(updated)).catch(() => {});
          return updated;
        });
      }
    }
  }

  async function saveChats(updated: Chat[]) {
    setChats(updated);
    await AsyncStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(updated));
  }

  async function saveMessages(updated: Record<string, Message[]>) {
    setMessages(updated);
    await AsyncStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(updated));
  }

  async function saveCheckInGroups(updated: CheckInGroup[]) {
    setCheckInGroups(updated);
    await AsyncStorage.setItem(STORAGE_KEYS.CHECKIN_GROUPS, JSON.stringify(updated));
  }

  async function saveBroadcasts(updated: CheckInBroadcast[]) {
    setBroadcasts(updated);
    await AsyncStorage.setItem(STORAGE_KEYS.BROADCASTS, JSON.stringify(updated));
  }

  const setSortMode = useCallback(async (mode: ChatSortMode) => {
    setSortModeState(mode);
    await AsyncStorage.setItem(STORAGE_KEYS.SORT_MODE, mode);
  }, []);

  const getContactById = useCallback(
    (id: string) => contacts.find((c) => c.id === id),
    [contacts]
  );

  const updateContacts = useCallback(async (newContacts: Contact[]) => {
    const hasMe = newContacts.some((c) => c.id === "me");
    const final = hasMe ? newContacts : [SAMPLE_CONTACTS[0], ...newContacts];
    setContactsState(final);
    await AsyncStorage.setItem(STORAGE_KEYS.CONTACTS, JSON.stringify(final));
  }, []);

  const getChatMessages = useCallback(
    (chatId: string) => messages[chatId] || [],
    [messages]
  );

  const replaceChatMessages = useCallback(async (chatId: string, msgs: Message[]) => {
    const updated = { ...messagesRef.current, [chatId]: msgs };
    messagesRef.current = updated;
    setMessages(updated);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(updated));
    } catch { /* non-fatal — state is updated; persist retried on next write */ }
    // Keep the chat preview in sync with the restored history
    const last = msgs[msgs.length - 1];
    if (last) {
      setChats((prev) => {
        const next = prev.map((c) =>
          c.id === chatId ? { ...c, lastMessage: last.text, lastMessageTime: last.timestamp } : c
        );
        AsyncStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(next)).catch(() => {});
        return next;
      });
    }
  }, []);

  const getDecryptedMessages = useCallback(
    (chatId: string): Message[] => {
      const chat = chats.find((c) => c.id === chatId);
      const msgs = messages[chatId] || [];
      if (!chat?.isEncrypted || !chat.encryptionKey) return msgs;
      return msgs.map((m) => ({
        ...m,
        text: decryptMessage(m.text, chat.encryptionKey!),
        originalText: m.originalText
          ? decryptMessage(m.originalText, chat.encryptionKey!)
          : undefined,
      }));
    },
    [chats, messages]
  );

  const getBroadcastsForGroup = useCallback(
    (groupId: string) => broadcasts.filter((b) => b.groupId === groupId),
    [broadcasts]
  );

  const searchMessages = useCallback(
    (filter: SearchFilter): Array<Message & { chatName: string }> => {
      const results: Array<Message & { chatName: string }> = [];
      for (const [chatId, msgs] of Object.entries(messages)) {
        const chat = chats.find((c) => c.id === chatId);
        if (!chat) continue;
        if (filter.chatId && filter.chatId !== chatId) continue;

        for (const msg of msgs) {
          if (msg.deleted) continue;

          const decryptedText =
            chat.isEncrypted && chat.encryptionKey
              ? decryptMessage(msg.text, chat.encryptionKey)
              : msg.text;

          if (filter.query) {
            const q = filter.query.toLowerCase();
            if (!decryptedText.toLowerCase().includes(q)) continue;
          }

          if (filter.startDate && msg.timestamp < filter.startDate) continue;
          if (filter.endDate && msg.timestamp > filter.endDate) continue;

          if (filter.startTime || filter.endTime) {
            const msgDate = new Date(msg.timestamp);
            const msgMinutes = msgDate.getHours() * 60 + msgDate.getMinutes();
            if (filter.startTime) {
              const [h, m] = filter.startTime.split(":").map(Number);
              if (msgMinutes < h * 60 + m) continue;
            }
            if (filter.endTime) {
              const [h, m] = filter.endTime.split(":").map(Number);
              if (msgMinutes > h * 60 + m) continue;
            }
          }

          if (filter.senderId && msg.senderId !== filter.senderId) continue;

          results.push({ ...msg, text: decryptedText, chatName: chat.name });
        }
      }
      return results.sort((a, b) => b.timestamp - a.timestamp);
    },
    [messages, chats]
  );

  const generateChatPdfHtml = useCallback(
    (chatId: string): string => {
      const chat = chats.find((c) => c.id === chatId);
      if (!chat) return "<p>Chat not found</p>";
      const msgs = getDecryptedMessages(chatId);

      const rows = msgs
        .map((m) => {
          const sender = contacts.find((c) => c.id === m.senderId);
          const name = sender?.name || m.senderId;
          const date = new Date(m.timestamp);
          const dateStr = date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          });
          const timeStr = date.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });
          const isMe = m.senderId === myId;
          const audioNote = m.audioAttachment
            ? `<div style="color:#FF9F0A;font-size:12px;margin-top:4px;">🎵 ${m.audioAttachment.name}</div>`
            : "";
          return `
          <tr style="background:${isMe ? "#EEF4FF" : "#FFFFFF"};">
            <td style="padding:10px 14px;font-size:12px;color:#666;white-space:nowrap;border-bottom:1px solid #E5E5EA;">${dateStr}</td>
            <td style="padding:10px 14px;font-size:12px;color:#666;white-space:nowrap;border-bottom:1px solid #E5E5EA;">${timeStr}</td>
            <td style="padding:10px 14px;font-size:13px;font-weight:600;color:${isMe ? "#0A84FF" : "#333"};border-bottom:1px solid #E5E5EA;">${name}</td>
            <td style="padding:10px 14px;font-size:14px;color:#111;border-bottom:1px solid #E5E5EA;">${m.text || ""}${audioNote}</td>
          </tr>`;
        })
        .join("");

      return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${chat.name} — Message Thread</title>
<style>
  body { font-family: -apple-system, Arial, sans-serif; margin: 0; padding: 24px; background: #F2F2F7; }
  .header { background: linear-gradient(135deg, #0A84FF, #5E5CE6); color: white; padding: 24px; border-radius: 12px; margin-bottom: 24px; }
  .header h1 { margin: 0 0 4px; font-size: 22px; }
  .header p { margin: 0; opacity: 0.85; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
  th { background: #F2F2F7; padding: 10px 14px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #666; text-align: left; border-bottom: 2px solid #E5E5EA; }
  .footer { text-align: center; margin-top: 24px; font-size: 11px; color: #999; }
  .lock { display: inline-block; margin-left: 8px; }
</style>
</head>
<body>
  <div class="header">
    <h1>${chat.name} ${chat.isEncrypted ? '<span class="lock">🔐</span>' : ""}</h1>
    <p>Exported on ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} &bull; ${msgs.length} messages &bull; ${chat.participantIds.length} participants</p>
  </div>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Time</th>
        <th>Sender</th>
        <th>Message</th>
      </tr>
    </thead>
    <tbody>${rows || '<tr><td colspan="4" style="text-align:center;padding:32px;color:#999;">No messages</td></tr>'}</tbody>
  </table>
  <div class="footer">Generated by ZIVR &bull; ${chat.isEncrypted ? "🔐 E2E Encrypted Thread" : "Standard Thread"}</div>
</body>
</html>`;
    },
    [chats, contacts, myId, getDecryptedMessages]
  );

  const createDirectChat = useCallback(
    async (contactId: string): Promise<string> => {
      const existing = chats.find(
        (c) =>
          c.type === "direct" &&
          c.participantIds.includes(contactId) &&
          c.participantIds.includes(myId)
      );
      if (existing) return existing.id;

      const id = genId();
      const contact = contacts.find((c) => c.id === contactId);
      const newChat: Chat = {
        id,
        type: "direct",
        name: contact?.name || "Unknown",
        participantIds: [myId, contactId],
        createdAt: Date.now(),
        unreadCount: 0,
      };
      await saveChats([newChat, ...chats]);
      return id;
    },
    [chats, contacts, myId]
  );

  const createServerDirectChat = useCallback(
    async (serverUser: ServerUser): Promise<{ chatId: string; approval?: "pending" | "blocked"; error?: string }> => {
      const existing = chats.find(
        (c) => c.isServerChat && c.participantIds.includes(serverUser.id)
      );
      if (existing) return { chatId: existing.id };

      if (!serverUserId) return { chatId: "" };

      const result = await getOrCreateDirectChat(serverUserId, serverUser.id);
      const chatId = result.chatId;
      if (!chatId) return { chatId: "", approval: result.approval, error: result.error };

      const contact: Contact = {
        id: serverUser.id,
        name: serverUser.displayName,
        phone: serverUser.phone,
        avatar: serverUser.avatar,
        status: serverUser.statusMessage,
        isOnline: serverUser.isOnline,
        lastSeen: serverUser.lastSeen,
      };

      const updatedContacts = contacts.some((c) => c.id === serverUser.id)
        ? contacts
        : [...contacts, contact];
      setContactsState(updatedContacts);
      await AsyncStorage.setItem(STORAGE_KEYS.CONTACTS, JSON.stringify(updatedContacts));

      const newChat: Chat = {
        id: chatId,
        type: "direct",
        name: serverUser.displayName,
        participantIds: [serverUserId, serverUser.id],
        createdAt: Date.now(),
        unreadCount: 0,
        avatar: serverUser.avatar,
        isServerChat: true,
      };
      await saveChats([newChat, ...chats]);
      return { chatId };
    },
    [chats, contacts, serverUserId, getOrCreateDirectChat]
  );

  const createGroupChat = useCallback(
    async (name: string, participantIds: string[], description?: string): Promise<string> => {
      const id = genId();
      const newChat: Chat = {
        id,
        type: "group",
        name,
        participantIds: [myId, ...participantIds],
        createdAt: Date.now(),
        unreadCount: 0,
        description,
      };
      await saveChats([newChat, ...chats]);
      return id;
    },
    [chats, myId]
  );

  const createCheckInGroup = useCallback(
    async (name: string, memberIds: string[], anonymous = false): Promise<string> => {
      const id = genId();
      const group: CheckInGroup = {
        id,
        name,
        memberIds,
        anonymous,
        createdAt: Date.now(),
      };
      await saveCheckInGroups([group, ...checkInGroups]);
      return id;
    },
    [checkInGroups]
  );

  const markImageViewed = useCallback(
    async (chatId: string, messageId: string) => {
      const chatMessages = messages[chatId] || [];
      const updated = chatMessages.map((m) => {
        if (m.id !== messageId || !m.imageAttachment) return m;
        const img = m.imageAttachment;
        const viewedBy = [...(img.viewedBy ?? []), myId];
        if (img.security === "single-view") {
          return { ...m, imageAttachment: { ...img, viewedBy, uri: "" } };
        }
        return { ...m, imageAttachment: { ...img, viewedBy } };
      });
      await saveMessages({ ...messages, [chatId]: updated });
    },
    [messages, myId, saveMessages]
  );

  const sendMessage = useCallback(
    async (chatId: string, text: string, audio?: AudioAttachment, image?: ImageAttachment, formatting?: MessageFormatting, music?: MusicAttachment, selfDestruct?: SelfDestructConfig) => {
      const id = genId();
      const chat = chats.find((c) => c.id === chatId);

      // Auto-translate if the chat has a recipient language set and message is plain text
      let finalText = text;
      let wasTranslated = false;
      if (text && chat?.recipientLanguage && !audio && !image && !music) {
        const sourceLang = profile.primaryLanguage ?? "English";
        if (chat.recipientLanguage.toLowerCase() !== sourceLang.toLowerCase()) {
          try {
            const translated = await translateMessage(text, chat.recipientLanguage, sourceLang);
            if (translated && translated !== text) {
              finalText = translated;
              wasTranslated = true;
            }
          } catch {
            // translation failed — send original silently
          }
        }
      }

      const storedText =
        chat?.isEncrypted && chat.encryptionKey
          ? encryptMessage(finalText, chat.encryptionKey)
          : finalText;

      const msg: Message = {
        id,
        chatId,
        text: storedText,
        senderId: myId,
        timestamp: Date.now(),
        audioAttachment: audio,
        imageAttachment: image,
        musicAttachment: music,
        formatting,
        selfDestruct,
        read: false,
        wasTranslated: wasTranslated || undefined,
        translatedTo: wasTranslated ? chat?.recipientLanguage : undefined,
        originalText: wasTranslated
          ? (chat?.isEncrypted && chat.encryptionKey
              ? encryptMessage(text, chat.encryptionKey)
              : text)
          : undefined,
      };

      if (chat?.isServerChat && serverUserId) {
        sentLocalIds.current.add(id);
        sendServerMessage(chatId, serverUserId, finalText, id);
      }

      const chatMessages = messages[chatId] || [];
      const updatedMessages = { ...messages, [chatId]: [...chatMessages, msg] };
      await saveMessages(updatedMessages);

      const previewText = chat?.isEncrypted
        ? "🔐 Encrypted message"
        : finalText || (music ? `${music.emoji} ${music.title} — ${music.artist}` : audio ? "🎵 Audio message" : image ? "📷 Photo" : "");
      const updatedChats = chats.map((c) =>
        c.id === chatId
          ? { ...c, lastMessage: previewText, lastMessageTime: msg.timestamp, lastAudio: audio }
          : c
      );
      await saveChats(updatedChats);

      if (chatId === BETA_CHAT_ID && text) {
        const senderName = contacts.find((c) => c.id === myId)?.name ?? "Beta Tester";
        queueFeedbackSubmission(text, senderName, msg.timestamp).catch(() => {});
      }

    },
    [chats, messages, myId, contacts, profile.primaryLanguage, translateMessage]
  );

  const simulateMemberReplies = useCallback(
    (broadcastId: string, memberIds: string[]) => {
      memberIds.forEach((memberId, index) => {
        if (Math.random() < 0.25) return;
        const delay = (4 + index * 5 + Math.random() * 6) * 1000;
        setTimeout(() => {
          const reply: CheckInReply = {
            id: genId(),
            memberId,
            text: SIMULATE_REPLIES[Math.floor(Math.random() * SIMULATE_REPLIES.length)],
            timestamp: Date.now(),
            read: false,
          };
          setBroadcasts((prev) => {
            const updated = prev.map((b) =>
              b.id === broadcastId
                ? { ...b, replies: { ...b.replies, [memberId]: [...(b.replies[memberId] || []), reply] } }
                : b
            );
            AsyncStorage.setItem(STORAGE_KEYS.BROADCASTS, JSON.stringify(updated));
            return updated;
          });
        }, delay);
      });
    },
    []
  );

  const sendBroadcast = useCallback(
    async (groupId: string, text: string, audio?: AudioAttachment): Promise<string> => {
      const id = genId();
      const broadcast: CheckInBroadcast = {
        id,
        groupId,
        senderId: myId,
        text,
        audioAttachment: audio,
        timestamp: Date.now(),
        replies: {},
        privateSideChats: {},
      };
      await saveBroadcasts([broadcast, ...broadcasts]);
      const group = checkInGroups.find((g) => g.id === groupId);
      if (group) {
        simulateMemberReplies(id, group.memberIds.filter((m) => m !== myId));
      }
      return id;
    },
    [broadcasts, myId, checkInGroups, simulateMemberReplies]
  );

  const replyToReceivedBroadcast = useCallback(
    async (broadcastId: string, text: string) => {
      setBroadcasts((prev) => {
        const updated = prev.map((b) =>
          b.id === broadcastId ? { ...b, myReply: text } : b
        );
        AsyncStorage.setItem(STORAGE_KEYS.BROADCASTS, JSON.stringify(updated));
        return updated;
      });
    },
    []
  );

  const markBroadcastRepliesRead = useCallback(
    async (broadcastId: string) => {
      setBroadcasts((prev) => {
        const updated = prev.map((b) => {
          if (b.id !== broadcastId) return b;
          const newReplies: Record<string, CheckInReply[]> = {};
          for (const [k, v] of Object.entries(b.replies)) {
            newReplies[k] = v.map((r) => ({ ...r, read: true }));
          }
          return { ...b, replies: newReplies };
        });
        AsyncStorage.setItem(STORAGE_KEYS.BROADCASTS, JSON.stringify(updated));
        return updated;
      });
    },
    []
  );

  const getReceivedBroadcasts = useCallback(() => {
    return broadcasts
      .filter((b) => b.senderId !== myId)
      .map((b) => {
        const group = checkInGroups.find((g) => g.id === b.groupId);
        const sender = SAMPLE_CONTACTS.find((c) => c.id === b.senderId);
        return { broadcast: b, group: group!, sender };
      })
      .filter((item) => item.group !== undefined)
      .sort((a, b) => b.broadcast.timestamp - a.broadcast.timestamp);
  }, [broadcasts, checkInGroups, myId]);

  const getBroadcastReplyStats = useCallback(
    (broadcastId: string) => {
      const broadcast = broadcasts.find((b) => b.id === broadcastId);
      if (!broadcast) return { total: 0, replied: 0, pending: [] };
      const group = checkInGroups.find((g) => g.id === broadcast.groupId);
      if (!group) return { total: 0, replied: 0, pending: [] };
      const members = group.memberIds.filter((m) => m !== myId);
      const replied = members.filter((m) => (broadcast.replies[m]?.length ?? 0) > 0);
      const pending = members.filter((m) => !broadcast.replies[m]?.length);
      return { total: members.length, replied: replied.length, pending };
    },
    [broadcasts, checkInGroups, myId]
  );

  const replyToBroadcast = useCallback(
    async (broadcastId: string, text: string, audio?: AudioAttachment) => {
      const id = genId();
      const reply: CheckInReply = {
        id,
        memberId: myId,
        text,
        audioAttachment: audio,
        timestamp: Date.now(),
        read: false,
      };
      const updatedBroadcasts = broadcasts.map((b) =>
        b.id === broadcastId
          ? { ...b, replies: { ...b.replies, [myId]: [...(b.replies[myId] || []), reply] } }
          : b
      );
      await saveBroadcasts(updatedBroadcasts);
    },
    [broadcasts, myId]
  );

  const sendPrivateSideChat = useCallback(
    async (broadcastId: string, memberId: string, text: string, audio?: AudioAttachment) => {
      const id = genId();
      const msg: Message = {
        id,
        chatId: `side_${broadcastId}_${memberId}`,
        text,
        senderId: myId,
        timestamp: Date.now(),
        audioAttachment: audio,
      };
      const updatedBroadcasts = broadcasts.map((b) =>
        b.id === broadcastId
          ? {
              ...b,
              privateSideChats: {
                ...b.privateSideChats,
                [memberId]: [...(b.privateSideChats[memberId] || []), msg],
              },
            }
          : b
      );
      await saveBroadcasts(updatedBroadcasts);
    },
    [broadcasts, myId]
  );

  const addReaction = useCallback(
    async (chatId: string, messageId: string, emoji: string) => {
      const chatMessages = messages[chatId] || [];
      const updated = chatMessages.map((m) => {
        if (m.id !== messageId) return m;
        const reactions = { ...(m.reactions || {}) };
        if (!reactions[emoji]) reactions[emoji] = [];
        if (reactions[emoji].includes(myId)) {
          reactions[emoji] = reactions[emoji].filter((id) => id !== myId);
        } else {
          reactions[emoji] = [...reactions[emoji], myId];
        }
        return { ...m, reactions };
      });
      await saveMessages({ ...messages, [chatId]: updated });
    },
    [messages, myId]
  );

  const editMessage = useCallback(
    async (chatId: string, messageId: string, newText: string) => {
      const chatMessages = messages[chatId] || [];
      const now = Date.now();
      const updated = chatMessages.map((m) => {
        if (m.id !== messageId) return m;
        if (m.senderId !== myId) return m;
        if (now - m.timestamp > 90000) return m;
        return { ...m, text: newText.trim(), editedAt: now };
      });
      const editedMsg = updated.find((m) => m.id === messageId);
      const updatedChats = chats.map((c) => {
        if (c.id !== chatId) return c;
        const isLast = chatMessages[chatMessages.length - 1]?.id === messageId;
        return isLast ? { ...c, lastMessage: editedMsg?.text ?? c.lastMessage } : c;
      });
      await saveMessages({ ...messages, [chatId]: updated });
      await saveChats(updatedChats);
    },
    [messages, chats, myId]
  );

  const markChatRead = useCallback(
    async (chatId: string) => {
      const updatedChats = chats.map((c) =>
        c.id === chatId ? { ...c, unreadCount: 0 } : c
      );
      await saveChats(updatedChats);
    },
    [chats]
  );

  const deleteChat = useCallback(
    async (chatId: string) => {
      const updatedChats = chats.filter((c) => c.id !== chatId);
      const updatedMessages = { ...messages };
      delete updatedMessages[chatId];
      await saveChats(updatedChats);
      await saveMessages(updatedMessages);
    },
    [chats, messages]
  );

  const deleteMessage = useCallback(
    async (chatId: string, messageId: string) => {
      const chatMessages = messages[chatId] || [];
      const updated = chatMessages.map((m) =>
        m.id === messageId ? { ...m, text: "", deleted: true } : m
      );
      await saveMessages({ ...messages, [chatId]: updated });
    },
    [messages]
  );

  const pinChat = useCallback(
    async (chatId: string) => {
      const updatedChats = chats.map((c) =>
        c.id === chatId ? { ...c, isPinned: !c.isPinned } : c
      );
      await saveChats(updatedChats);
    },
    [chats]
  );

  const muteChat = useCallback(
    async (chatId: string) => {
      const updatedChats = chats.map((c) =>
        c.id === chatId ? { ...c, isMuted: !c.isMuted } : c
      );
      await saveChats(updatedChats);
    },
    [chats]
  );

  const setNotificationSound = useCallback(
    async (chatId: string, sound: string) => {
      const updatedChats = chats.map((c) =>
        c.id === chatId ? { ...c, notificationSound: sound } : c
      );
      await saveChats(updatedChats);
    },
    [chats]
  );

  const setReadReceiptsEnabled = useCallback(
    async (chatId: string, enabled: boolean) => {
      const updatedChats = chats.map((c) =>
        c.id === chatId ? { ...c, readReceiptsEnabled: enabled } : c
      );
      await saveChats(updatedChats);
    },
    [chats]
  );

  const setChatTypingEmoji = useCallback(
    async (chatId: string, emoji: string) => {
      const updatedChats = chats.map((c) =>
        c.id === chatId ? { ...c, typingEmoji: emoji } : c
      );
      await saveChats(updatedChats);
    },
    [chats]
  );

  const setChatRecipientLanguage = useCallback(
    async (chatId: string, lang: string | undefined) => {
      const updatedChats = chats.map((c) =>
        c.id === chatId ? { ...c, recipientLanguage: lang } : c
      );
      await saveChats(updatedChats);
    },
    [chats]
  );

  const setChatPasscode = useCallback(
    async (chatId: string, passcode: string, recoveryEmail?: string, hint?: string) => {
      const salt = genId();
      const hash = hashPasscode(passcode + salt);
      const updatedChats = chats.map((c) =>
        c.id === chatId
          ? { ...c, passcodeHash: hash, passcodeSalt: salt, recoveryEmail, passcodeHint: hint }
          : c
      );
      await saveChats(updatedChats);
    },
    [chats]
  );

  const removeChatPasscode = useCallback(
    async (chatId: string) => {
      const updatedChats = chats.map((c) =>
        c.id === chatId
          ? { ...c, passcodeHash: undefined, passcodeSalt: undefined, recoveryEmail: undefined, passcodeHint: undefined }
          : c
      );
      await saveChats(updatedChats);
    },
    [chats]
  );

  const verifyChatPasscode = useCallback(
    (chatId: string, passcode: string): boolean => {
      const chat = chats.find((c) => c.id === chatId);
      if (!chat?.passcodeHash || !chat.passcodeSalt) return true;
      const hash = hashPasscode(passcode + chat.passcodeSalt);
      return hash === chat.passcodeHash;
    },
    [chats]
  );

  const enableChatEncryption = useCallback(
    async (chatId: string): Promise<string> => {
      const key = generateEncryptionKey();
      const updatedChats = chats.map((c) =>
        c.id === chatId ? { ...c, isEncrypted: true, encryptionKey: key } : c
      );
      await saveChats(updatedChats);

      const chatMessages = messages[chatId] || [];
      const encryptedMessages = chatMessages.map((m) => ({
        ...m,
        text: m.text ? encryptMessage(m.text, key) : m.text,
        originalText: m.originalText ? encryptMessage(m.originalText, key) : m.originalText,
      }));
      await saveMessages({ ...messages, [chatId]: encryptedMessages });
      return key;
    },
    [chats, messages]
  );

  const disableChatEncryption = useCallback(
    async (chatId: string) => {
      const chat = chats.find((c) => c.id === chatId);
      if (!chat?.encryptionKey) return;

      const chatMessages = messages[chatId] || [];
      const decryptedMessages = chatMessages.map((m) => ({
        ...m,
        text: m.text ? decryptMessage(m.text, chat.encryptionKey!) : m.text,
        originalText: m.originalText ? decryptMessage(m.originalText, chat.encryptionKey!) : m.originalText,
      }));
      await saveMessages({ ...messages, [chatId]: decryptedMessages });

      const updatedChats = chats.map((c) =>
        c.id === chatId ? { ...c, isEncrypted: false, encryptionKey: undefined } : c
      );
      await saveChats(updatedChats);
    },
    [chats, messages]
  );

  const addMemberToCheckIn = useCallback(
    async (groupId: string, memberId: string) => {
      const updated = checkInGroups.map((g) =>
        g.id === groupId
          ? { ...g, memberIds: g.memberIds.includes(memberId) ? g.memberIds : [...g.memberIds, memberId] }
          : g
      );
      await saveCheckInGroups(updated);
    },
    [checkInGroups]
  );

  const removeMemberFromCheckIn = useCallback(
    async (groupId: string, memberId: string) => {
      const updated = checkInGroups.map((g) =>
        g.id === groupId
          ? { ...g, memberIds: g.memberIds.filter((id) => id !== memberId) }
          : g
      );
      await saveCheckInGroups(updated);
    },
    [checkInGroups]
  );

  const value = useMemo(
    () => ({
      myId,
      contacts,
      chats,
      messages,
      checkInGroups,
      broadcasts,
      sortMode,
      setSortMode,
      setActiveChatId,
      sendMessage,
      markImageViewed,
      createDirectChat,
      createServerDirectChat,
      createGroupChat,
      createCheckInGroup,
      sendBroadcast,
      replyToBroadcast,
      replyToReceivedBroadcast,
      sendPrivateSideChat,
      markBroadcastRepliesRead,
      getReceivedBroadcasts,
      getBroadcastReplyStats,
      editMessage,
      addReaction,
      markChatRead,
      deleteChat,
      deleteMessage,
      pinChat,
      muteChat,
      setNotificationSound,
      setReadReceiptsEnabled,
      setChatTypingEmoji,
      setChatRecipientLanguage,
      addMemberToCheckIn,
      removeMemberFromCheckIn,
      getContactById,
      updateContacts,
      getChatMessages,
      replaceChatMessages,
      getBroadcastsForGroup,
      setChatPasscode,
      removeChatPasscode,
      verifyChatPasscode,
      enableChatEncryption,
      disableChatEncryption,
      getDecryptedMessages,
      searchMessages,
      generateChatPdfHtml,
    }),
    [
      contacts,
      chats,
      messages,
      checkInGroups,
      broadcasts,
      sortMode,
      setSortMode,
      setActiveChatId,
      sendMessage,
      markImageViewed,
      createDirectChat,
      createServerDirectChat,
      createGroupChat,
      createCheckInGroup,
      sendBroadcast,
      replyToBroadcast,
      replyToReceivedBroadcast,
      sendPrivateSideChat,
      markBroadcastRepliesRead,
      getReceivedBroadcasts,
      getBroadcastReplyStats,
      editMessage,
      addReaction,
      markChatRead,
      deleteChat,
      deleteMessage,
      pinChat,
      muteChat,
      setNotificationSound,
      setReadReceiptsEnabled,
      setChatTypingEmoji,
      setChatRecipientLanguage,
      addMemberToCheckIn,
      removeMemberFromCheckIn,
      getContactById,
      updateContacts,
      getChatMessages,
      replaceChatMessages,
      getBroadcastsForGroup,
      setChatPasscode,
      removeChatPasscode,
      verifyChatPasscode,
      enableChatEncryption,
      disableChatEncryption,
      getDecryptedMessages,
      searchMessages,
      generateChatPdfHtml,
    ]
  );

  return (
    <MessagingContext.Provider value={value}>
      {children}
    </MessagingContext.Provider>
  );
}

export function useMessaging() {
  const ctx = useContext(MessagingContext);
  if (!ctx) throw new Error("useMessaging must be used within MessagingProvider");
  return ctx;
}
