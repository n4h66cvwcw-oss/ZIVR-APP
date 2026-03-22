import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type AudioAttachment = {
  uri: string;
  name: string;
  duration?: number;
};

export type Message = {
  id: string;
  chatId: string;
  text: string;
  senderId: string;
  timestamp: number;
  audioAttachment?: AudioAttachment;
  reactions?: Record<string, string[]>;
  read?: boolean;
  deliveredAt?: number;
};

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
};

export type CheckInGroup = {
  id: string;
  name: string;
  memberIds: string[];
  createdAt: number;
  anonymous: boolean;
  description?: string;
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

const STORAGE_KEYS = {
  CHATS: "@vibemsg_chats",
  MESSAGES: "@vibemsg_messages",
  CHECKIN_GROUPS: "@vibemsg_checkin_groups",
  BROADCASTS: "@vibemsg_broadcasts",
  CONTACTS: "@vibemsg_contacts",
  ME: "@vibemsg_me",
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
];

interface MessagingContextValue {
  myId: string;
  contacts: Contact[];
  chats: Chat[];
  messages: Record<string, Message[]>;
  checkInGroups: CheckInGroup[];
  broadcasts: CheckInBroadcast[];
  sendMessage: (
    chatId: string,
    text: string,
    audio?: AudioAttachment
  ) => Promise<void>;
  createDirectChat: (contactId: string) => Promise<string>;
  createGroupChat: (
    name: string,
    participantIds: string[],
    description?: string
  ) => Promise<string>;
  createCheckInGroup: (
    name: string,
    memberIds: string[],
    anonymous?: boolean
  ) => Promise<string>;
  sendBroadcast: (
    groupId: string,
    text: string,
    audio?: AudioAttachment
  ) => Promise<string>;
  replyToBroadcast: (
    broadcastId: string,
    text: string,
    audio?: AudioAttachment
  ) => Promise<void>;
  sendPrivateSideChat: (
    broadcastId: string,
    memberId: string,
    text: string,
    audio?: AudioAttachment
  ) => Promise<void>;
  addReaction: (
    chatId: string,
    messageId: string,
    emoji: string
  ) => Promise<void>;
  markChatRead: (chatId: string) => Promise<void>;
  deleteChat: (chatId: string) => Promise<void>;
  pinChat: (chatId: string) => Promise<void>;
  muteChat: (chatId: string) => Promise<void>;
  addMemberToCheckIn: (groupId: string, memberId: string) => Promise<void>;
  removeMemberFromCheckIn: (
    groupId: string,
    memberId: string
  ) => Promise<void>;
  getContactById: (id: string) => Contact | undefined;
  getChatMessages: (chatId: string) => Message[];
  getBroadcastsForGroup: (groupId: string) => CheckInBroadcast[];
}

const MessagingContext = createContext<MessagingContextValue | null>(null);

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

export function MessagingProvider({ children }: { children: React.ReactNode }) {
  const myId = "me";
  const [contacts, setContacts] = useState<Contact[]>(SAMPLE_CONTACTS);
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [checkInGroups, setCheckInGroups] = useState<CheckInGroup[]>([]);
  const [broadcasts, setBroadcasts] = useState<CheckInBroadcast[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [chatsStr, messagesStr, groupsStr, broadcastsStr] =
        await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.CHATS),
          AsyncStorage.getItem(STORAGE_KEYS.MESSAGES),
          AsyncStorage.getItem(STORAGE_KEYS.CHECKIN_GROUPS),
          AsyncStorage.getItem(STORAGE_KEYS.BROADCASTS),
        ]);

      if (chatsStr) setChats(JSON.parse(chatsStr));
      if (messagesStr) setMessages(JSON.parse(messagesStr));
      if (groupsStr) setCheckInGroups(JSON.parse(groupsStr));
      if (broadcastsStr) setBroadcasts(JSON.parse(broadcastsStr));
    } catch (e) {
      console.error("Error loading data:", e);
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
    await AsyncStorage.setItem(
      STORAGE_KEYS.CHECKIN_GROUPS,
      JSON.stringify(updated)
    );
  }

  async function saveBroadcasts(updated: CheckInBroadcast[]) {
    setBroadcasts(updated);
    await AsyncStorage.setItem(
      STORAGE_KEYS.BROADCASTS,
      JSON.stringify(updated)
    );
  }

  const getContactById = useCallback(
    (id: string) => contacts.find((c) => c.id === id),
    [contacts]
  );

  const getChatMessages = useCallback(
    (chatId: string) => messages[chatId] || [],
    [messages]
  );

  const getBroadcastsForGroup = useCallback(
    (groupId: string) => broadcasts.filter((b) => b.groupId === groupId),
    [broadcasts]
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

  const createGroupChat = useCallback(
    async (
      name: string,
      participantIds: string[],
      description?: string
    ): Promise<string> => {
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
    async (
      name: string,
      memberIds: string[],
      anonymous = false
    ): Promise<string> => {
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

  const sendMessage = useCallback(
    async (chatId: string, text: string, audio?: AudioAttachment) => {
      const id = genId();
      const msg: Message = {
        id,
        chatId,
        text,
        senderId: myId,
        timestamp: Date.now(),
        audioAttachment: audio,
        read: false,
      };
      const chatMessages = messages[chatId] || [];
      const updatedMessages = { ...messages, [chatId]: [...chatMessages, msg] };
      await saveMessages(updatedMessages);

      const updatedChats = chats.map((c) =>
        c.id === chatId
          ? {
              ...c,
              lastMessage: text || (audio ? "Audio message" : ""),
              lastMessageTime: msg.timestamp,
              lastAudio: audio,
            }
          : c
      );
      await saveChats(updatedChats);

      // Simulate reply after 2-4s for direct chats
      const chat = chats.find((c) => c.id === chatId);
      if (chat?.type === "direct") {
        const otherId = chat.participantIds.find((id) => id !== myId);
        if (otherId) {
          const delay = 2000 + Math.random() * 2000;
          setTimeout(async () => {
            const replyId = genId();
            const replies = [
              "That's awesome! ",
              "Love it! ",
              "Thanks for sharing! ",
              "Got it, thanks! ",
              "Wow, really? ",
              "Sounds good to me! ",
              "Let's do it! ",
              "Perfect timing! ",
            ];
            const replyMsg: Message = {
              id: replyId,
              chatId,
              text: replies[Math.floor(Math.random() * replies.length)],
              senderId: otherId,
              timestamp: Date.now(),
              read: false,
            };
            const currentMsgs = messages[chatId] || [];
            const newMsgs = {
              ...messages,
              [chatId]: [...currentMsgs, msg, replyMsg],
            };
            await saveMessages(newMsgs);
            const newChats = chats.map((c) =>
              c.id === chatId
                ? {
                    ...c,
                    lastMessage: replyMsg.text,
                    lastMessageTime: replyMsg.timestamp,
                    unreadCount: (c.unreadCount || 0) + 1,
                  }
                : c
            );
            await saveChats(newChats);
          }, delay);
        }
      }
    },
    [chats, messages, myId]
  );

  const sendBroadcast = useCallback(
    async (
      groupId: string,
      text: string,
      audio?: AudioAttachment
    ): Promise<string> => {
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
      return id;
    },
    [broadcasts, myId]
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
          ? {
              ...b,
              replies: {
                ...b.replies,
                [myId]: [...(b.replies[myId] || []), reply],
              },
            }
          : b
      );
      await saveBroadcasts(updatedBroadcasts);
    },
    [broadcasts, myId]
  );

  const sendPrivateSideChat = useCallback(
    async (
      broadcastId: string,
      memberId: string,
      text: string,
      audio?: AudioAttachment
    ) => {
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
                [memberId]: [
                  ...(b.privateSideChats[memberId] || []),
                  msg,
                ],
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

  const addMemberToCheckIn = useCallback(
    async (groupId: string, memberId: string) => {
      const updated = checkInGroups.map((g) =>
        g.id === groupId
          ? {
              ...g,
              memberIds: g.memberIds.includes(memberId)
                ? g.memberIds
                : [...g.memberIds, memberId],
            }
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
      sendMessage,
      createDirectChat,
      createGroupChat,
      createCheckInGroup,
      sendBroadcast,
      replyToBroadcast,
      sendPrivateSideChat,
      addReaction,
      markChatRead,
      deleteChat,
      pinChat,
      muteChat,
      addMemberToCheckIn,
      removeMemberFromCheckIn,
      getContactById,
      getChatMessages,
      getBroadcastsForGroup,
    }),
    [
      contacts,
      chats,
      messages,
      checkInGroups,
      broadcasts,
      sendMessage,
      createDirectChat,
      createGroupChat,
      createCheckInGroup,
      sendBroadcast,
      replyToBroadcast,
      sendPrivateSideChat,
      addReaction,
      markChatRead,
      deleteChat,
      pinChat,
      muteChat,
      addMemberToCheckIn,
      removeMemberFromCheckIn,
      getContactById,
      getChatMessages,
      getBroadcastsForGroup,
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
