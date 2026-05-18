import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { io, Socket } from "socket.io-client";

export type ServerUser = {
  id: string;
  displayName: string;
  username?: string;
  phone?: string;
  avatar?: string;
  statusMessage?: string;
  isOnline?: boolean;
  lastSeen?: number;
};

export type ServerMessage = {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  text: string;
  type: string;
  createdAt: number;
  localId?: string;
};

export type ServerChat = {
  id: string;
  type: "direct" | "group";
  name: string | null;
  description: string | null;
  lastMessageAt: number | null;
  members: Array<{ id: string; displayName: string; avatar: string | null; isOnline: boolean }>;
};

type MessageHandler = (msg: ServerMessage) => void;
type ReadReceiptHandler = (data: { chatId: string; readByUserId: string; readAt: number }) => void;

interface ServerContextValue {
  serverUserId: string | null;
  isConnected: boolean;
  registerOnServer: (opts: {
    displayName: string;
    username?: string;
    phone?: string;
    avatar?: string;
    statusMessage?: string;
  }) => Promise<string | null>;
  updateServerProfile: (userId: string, updates: {
    displayName?: string;
    username?: string;
    statusMessage?: string;
    avatar?: string;
    pushToken?: string;
  }) => Promise<void>;
  findUsers: (query: string) => Promise<ServerUser[]>;
  getOrCreateDirectChat: (myUserId: string, theirUserId: string) => Promise<string | null>;
  createServerGroupChat: (myUserId: string, name: string, memberIds: string[]) => Promise<string | null>;
  fetchMessages: (chatId: string, before?: number) => Promise<ServerMessage[]>;
  sendServerMessage: (chatId: string, senderId: string, text: string, localId?: string) => void;
  fetchUserChats: (userId: string) => Promise<ServerChat[]>;
  onNewMessage: (handler: MessageHandler) => () => void;
  emitTyping: (chatId: string, userId: string, name: string, isTyping: boolean, emoji?: string) => void;
  onTyping: (handler: (data: { chatId: string; userId: string; name: string; typing: boolean; emoji?: string }) => void) => () => void;
  emitChatRead: (chatId: string, userId: string) => void;
  onReadReceipt: (handler: ReadReceiptHandler) => () => void;
}

const ServerContext = createContext<ServerContextValue | null>(null);

const SERVER_USER_KEY = "@zivr_server_user_id";

const PRODUCTION_API = "https://echo-stream.replit.app/api-server";

function getApiBase(): string {
  const override = process.env["EXPO_PUBLIC_API_URL"];
  if (override) return override;
  const domain = process.env["EXPO_PUBLIC_DOMAIN"];
  if (domain) return `https://${domain}/api-server/api`;
  return `${PRODUCTION_API}/api`;
}

function getSocketUrl(): string {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"];
  if (domain) return `https://${domain}/api-server`;
  return PRODUCTION_API;
}

export function ServerProvider({ children }: { children: React.ReactNode }) {
  const [serverUserId, setServerUserId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const messageHandlers = useRef<Set<MessageHandler>>(new Set());
  const typingHandlers = useRef<Set<(d: { chatId: string; userId: string; name: string; typing: boolean; emoji?: string }) => void>>(new Set());
  const readReceiptHandlers = useRef<Set<ReadReceiptHandler>>(new Set());

  useEffect(() => {
    AsyncStorage.getItem(SERVER_USER_KEY).then((id) => {
      if (id) {
        setServerUserId(id);
        connectSocket(id);
      }
    });
    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  function connectSocket(userId: string) {
    if (socketRef.current?.connected) return;

    const socket = io(getSocketUrl(), {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 2000,
      timeout: 10000,
    });

    socket.on("connect", () => {
      setIsConnected(true);
      socket.emit("user:join", userId);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("message:new", (msg: ServerMessage) => {
      messageHandlers.current.forEach((h) => h(msg));
    });

    socket.on("typing:update", (data: { chatId: string; userId: string; name: string; typing: boolean; emoji?: string }) => {
      typingHandlers.current.forEach((h) => h(data));
    });

    socket.on("message:read", (data: { chatId: string; readByUserId: string; readAt: number }) => {
      readReceiptHandlers.current.forEach((h) => h(data));
    });

    socket.on("connect_error", (err) => {
      console.log("[ServerContext] socket connect_error:", err.message);
    });

    socketRef.current = socket;
  }

  const registerOnServer = useCallback(
    async (opts: {
      displayName: string;
      username?: string;
      phone?: string;
      avatar?: string;
      statusMessage?: string;
    }): Promise<string | null> => {
      try {
        const res = await fetch(`${getApiBase()}/users/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(opts),
        });
        if (!res.ok) {
          const err = await res.json() as { error?: string };
          console.warn("[ServerContext] register failed:", err.error);
          return null;
        }
        const data = await res.json() as { user: { id: string } };
        const userId = data.user.id;
        await AsyncStorage.setItem(SERVER_USER_KEY, userId);
        setServerUserId(userId);
        connectSocket(userId);
        return userId;
      } catch (e) {
        console.warn("[ServerContext] register error:", e);
        return null;
      }
    },
    []
  );

  const findUsers = useCallback(async (query: string): Promise<ServerUser[]> => {
    try {
      const q = encodeURIComponent(query.trim());
      const res = await fetch(`${getApiBase()}/users/find?q=${q}`);
      if (!res.ok) return [];
      const data = await res.json() as { users: ServerUser[] };
      return data.users ?? [];
    } catch {
      return [];
    }
  }, []);

  const getOrCreateDirectChat = useCallback(
    async (myUserId: string, theirUserId: string): Promise<string | null> => {
      try {
        const res = await fetch(`${getApiBase()}/chats/direct`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ myUserId, theirUserId }),
        });
        if (!res.ok) return null;
        const data = await res.json() as { chatId: string };
        socketRef.current?.emit("chat:join", data.chatId);
        return data.chatId;
      } catch {
        return null;
      }
    },
    []
  );

  const createServerGroupChat = useCallback(
    async (myUserId: string, name: string, memberIds: string[]): Promise<string | null> => {
      try {
        const res = await fetch(`${getApiBase()}/chats/group`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ myUserId, name, memberIds }),
        });
        if (!res.ok) return null;
        const data = await res.json() as { chatId: string };
        socketRef.current?.emit("chat:join", data.chatId);
        return data.chatId;
      } catch {
        return null;
      }
    },
    []
  );

  const fetchMessages = useCallback(
    async (chatId: string, before?: number): Promise<ServerMessage[]> => {
      try {
        const url = `${getApiBase()}/chats/${chatId}/messages${before ? `?before=${before}` : ""}`;
        const res = await fetch(url);
        if (!res.ok) return [];
        const data = await res.json() as { messages: ServerMessage[] };
        return data.messages ?? [];
      } catch {
        return [];
      }
    },
    []
  );

  const sendServerMessage = useCallback(
    (chatId: string, senderId: string, text: string, localId?: string) => {
      if (!socketRef.current?.connected) return;
      socketRef.current.emit("message:send", { chatId, senderId, text, type: "text", localId });
    },
    []
  );

  const fetchUserChats = useCallback(async (userId: string): Promise<ServerChat[]> => {
    try {
      const res = await fetch(`${getApiBase()}/chats/user/${userId}`);
      if (!res.ok) return [];
      const data = await res.json() as { chats: ServerChat[] };
      return data.chats ?? [];
    } catch {
      return [];
    }
  }, []);

  const onNewMessage = useCallback((handler: MessageHandler) => {
    messageHandlers.current.add(handler);
    return () => { messageHandlers.current.delete(handler); };
  }, []);

  const emitTyping = useCallback(
    (chatId: string, userId: string, name: string, isTyping: boolean, emoji?: string) => {
      if (!socketRef.current?.connected) return;
      if (isTyping) {
        socketRef.current.emit("typing:start", { chatId, userId, name, emoji });
      } else {
        socketRef.current.emit("typing:stop", { chatId, userId });
      }
    },
    []
  );

  const onTyping = useCallback(
    (handler: (d: { chatId: string; userId: string; name: string; typing: boolean; emoji?: string }) => void) => {
      typingHandlers.current.add(handler);
      return () => { typingHandlers.current.delete(handler); };
    },
    []
  );

  const emitChatRead = useCallback((chatId: string, userId: string) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit("chat:read", { chatId, userId });
  }, []);

  const onReadReceipt = useCallback((handler: ReadReceiptHandler) => {
    readReceiptHandlers.current.add(handler);
    return () => { readReceiptHandlers.current.delete(handler); };
  }, []);

  const updateServerProfile = useCallback(
    async (userId: string, updates: { displayName?: string; username?: string; statusMessage?: string; avatar?: string; pushToken?: string }) => {
      try {
        await fetch(`${getApiBase()}/users/${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
      } catch (e) {
        console.warn("[ServerContext] updateServerProfile error:", e);
      }
    },
    []
  );

  return (
    <ServerContext.Provider
      value={{
        serverUserId,
        isConnected,
        registerOnServer,
        updateServerProfile,
        findUsers,
        getOrCreateDirectChat,
        createServerGroupChat,
        fetchMessages,
        sendServerMessage,
        fetchUserChats,
        onNewMessage,
        emitTyping,
        onTyping,
        emitChatRead,
        onReadReceipt,
      }}
    >
      {children}
    </ServerContext.Provider>
  );
}

export function useServer() {
  const ctx = useContext(ServerContext);
  if (!ctx) throw new Error("useServer must be used within ServerProvider");
  return ctx;
}
