import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, AppStateStatus } from "react-native";
import { io, Socket } from "socket.io-client";

export type ServerUser = {
  id: string;
  displayName: string;
  username?: string;
  phone?: string;
  avatar?: string;
  statusMessage?: string;
  preferredLanguage?: string;
  isOnline?: boolean;
  lastSeen?: number;
  /** "child" | "parent" | null — set server-side; clients must not trust a self-asserted value. */
  accountType?: "child" | "parent" | null;
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

export type DirectChatResult = {
  chatId: string | null;
  /** Set when a parent hasn't approved (or has blocked) this contact for a child account. */
  approval?: "pending" | "blocked";
  error?: string;
};
type MessageHandler = (msg: ServerMessage) => void;

type MessageBlockedHandler = (data: {
  chatId: string;
  localId?: string;
  status: "pending" | "blocked";
  message: string;
}) => void;

type ContactRequestHandler = (data: {
  childId: string;
  childName: string;
  contactId: string;
  contactName: string;
  requestedAt: number;
}) => void;
type ReadReceiptHandler = (data: { chatId: string; readByUserId: string; readAt: number }) => void;

export type ChatBackupMeta = {
  id: string;
  localChatId: string;
  chatName: string;
  messageCount: number;
  backedUpAt: number;
};

interface ServerContextValue {
  serverUserId: string | null;
  /**
   * True once the initial AsyncStorage identity hydration has resolved.
   * While false, `serverUserId === null` means "still loading", not "signed out".
   */
  identityReady: boolean;
  isConnected: boolean;
  registerOnServer: (opts: {
    displayName: string;
    username?: string;
    phone?: string;
    avatar?: string;
    statusMessage?: string;
    preferredLanguage?: string;
  }) => Promise<string | null>;
  updateServerProfile: (userId: string, updates: {
    displayName?: string;
    username?: string;
    statusMessage?: string;
    avatar?: string;
    pushToken?: string;
    preferredLanguage?: string;
  }) => Promise<void>;
  fetchServerUser: (userId: string) => Promise<ServerUser | null>;
  findUsers: (query: string) => Promise<ServerUser[]>;
  getOrCreateDirectChat: (myUserId: string, theirUserId: string) => Promise<DirectChatResult>;
  onMessageBlocked: (handler: MessageBlockedHandler) => () => void;
  onContactRequest: (handler: ContactRequestHandler) => () => void;
  /** Switch this device's active server account (e.g. parent-mediated child handoff). */
  switchActiveUser: (userId: string, authToken: string) => Promise<void>;
  /** Non-null when a previous identity (e.g. the parent) was saved during a switch. */
  previousUserId: string | null;
  /** Restore the identity that was active before the last switchActiveUser. */
  switchBackToPreviousUser: () => Promise<boolean>;
  createServerGroupChat: (myUserId: string, name: string, memberIds: string[]) => Promise<string | null>;
  fetchMessages: (chatId: string, before?: number) => Promise<ServerMessage[]>;
  sendServerMessage: (chatId: string, senderId: string, text: string, localId?: string) => void;
  fetchUserChats: (userId: string) => Promise<ServerChat[]>;
  onNewMessage: (handler: MessageHandler) => () => void;
  emitTyping: (chatId: string, userId: string, name: string, isTyping: boolean, emoji?: string) => void;
  onTyping: (handler: (data: { chatId: string; userId: string; name: string; typing: boolean; emoji?: string }) => void) => () => void;
  emitChatRead: (chatId: string, userId: string) => void;
  onReadReceipt: (handler: ReadReceiptHandler) => () => void;
  translateMessage: (text: string, targetLanguage: string, sourceLanguage?: string) => Promise<string>;
  getSuggestedReply: (opts: {
    messages: Array<{ sender: "me" | "them"; senderName?: string; text: string }>;
    chatName?: string;
    myName?: string;
    recipientLanguage?: string;
  }) => Promise<string>;
  exportServerChatAsText: (chatId: string) => Promise<string | null>;
  backupLocalChat: (opts: { localChatId: string; chatName: string; encryptedData: string; messageCount: number }) => Promise<boolean>;
  listBackups: () => Promise<ChatBackupMeta[]>;
  restoreBackup: (localChatId: string) => Promise<string | null>;
  deleteBackup: (localChatId: string) => Promise<void>;
}

const ServerContext = createContext<ServerContextValue | null>(null);

const SERVER_USER_KEY = "@zivr_server_user_id";

const SERVER_TOKEN_KEY = "@zivr_server_auth_token";
// The identity that was active before the last account switch (parent handoff)
const PREVIOUS_IDENTITY_KEY = "@zivr_previous_identity";
const PRODUCTION_API = "https://echo-stream.replit.app/api";

function getApiBase(): string {
  const override = process.env["EXPO_PUBLIC_API_URL"];
  if (override) return override;
  const domain = process.env["EXPO_PUBLIC_DOMAIN"];
  if (domain) return `https://${domain}/api`;
  return PRODUCTION_API;
}

function getSocketUrl(): string {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"];
  if (domain) return `https://${domain}/api`;
  return PRODUCTION_API;
}

export function ServerProvider({ children }: { children: React.ReactNode }) {
  const [serverUserId, setServerUserId] = useState<string | null>(null);
  const [identityReady, setIdentityReady] = useState(false);
  const [previousUserId, setPreviousUserId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const messageHandlers = useRef<Set<MessageHandler>>(new Set());
  const typingHandlers = useRef<Set<(d: { chatId: string; userId: string; name: string; typing: boolean; emoji?: string }) => void>>(new Set());
  const readReceiptHandlers = useRef<Set<ReadReceiptHandler>>(new Set());
  const messageBlockedHandlers = useRef<Set<MessageBlockedHandler>>(new Set());
  const contactRequestHandlers = useRef<Set<ContactRequestHandler>>(new Set());
  const authTokenRef = useRef<string | null>(null);
  // Tracks when the socket last disconnected so we can request missed messages on rejoin
  const disconnectTimeRef = useRef<number | null>(null);
  const serverUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(SERVER_USER_KEY),
      AsyncStorage.getItem(SERVER_TOKEN_KEY),
      AsyncStorage.getItem(PREVIOUS_IDENTITY_KEY),
    ]).then(async ([id, token, prevRaw]) => {
      if (prevRaw) {
        try { setPreviousUserId((JSON.parse(prevRaw) as { userId: string }).userId); } catch { /* ignore */ }
      }
      if (!id) return;
      setServerUserId(id);
      serverUserIdRef.current = id;
      if (token) {
        authTokenRef.current = token;
        cachedAuthToken = token;
      } else {
        // No stored credential. A user ID alone is public data, never a
        // credential, so there is deliberately no way to "claim" a token for
        // an existing account — the user must re-register (or, for child
        // accounts, receive their credential from the authenticated parent).
        console.warn("[ServerContext] no auth token stored for this account; re-registration required for authenticated actions");
      }
      connectSocket(id);
    }).finally(() => {
      // Signal that the stored identity has been resolved — null now means
      // "genuinely signed out", not "still loading".
      setIdentityReady(true);
    });
    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  // Re-connect and catch up on missed messages when the app returns to foreground
  useEffect(() => {
    function handleAppStateChange(nextState: AppStateStatus) {
      if (nextState === "active") {
        const userId = serverUserIdRef.current;
        if (!userId) return;
        if (!socketRef.current) {
          connectSocket(userId);
          return;
        }
        if (!socketRef.current.connected) {
          // Socket.io auto-reconnects, but if it hasn't yet we nudge it manually
          socketRef.current.connect();
        } else {
          // Already connected — re-emit user:join so the server rejoins us to
          // all chat rooms and sends any messages we missed while backgrounded.
          const since = disconnectTimeRef.current ?? undefined;
          socketRef.current.emit("user:join", since ? { userId, since } : userId);
        }
      }
    }

    const sub = AppState.addEventListener("change", handleAppStateChange);
    return () => sub.remove();
  }, []);

  function connectSocket(userId: string) {
    if (socketRef.current?.connected) return;

    const socket = io(getSocketUrl(), {
      path: "/api/socket.io",
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 2000,
      timeout: 10000,
      auth: (cb) => cb({ token: authTokenRef.current }),
    });

    socket.on("connect", () => {
      setIsConnected(true);
      // Pass `since` so the server can deliver messages missed during the gap
      const since = disconnectTimeRef.current ?? undefined;
      socket.emit("user:join", since ? { userId, since } : userId);
      disconnectTimeRef.current = null;
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
      disconnectTimeRef.current = Date.now();
    });

    socket.on("message:new", (msg: ServerMessage) => {
      messageHandlers.current.forEach((h) => h(msg));
    });

    // Deliver any messages that arrived while the socket was disconnected
    socket.on("missed_messages", (data: { messages: ServerMessage[] }) => {
      if (Array.isArray(data?.messages)) {
        data.messages.forEach((msg) => {
          messageHandlers.current.forEach((h) => h(msg));
        });
      }
    });

    socket.on("typing:update", (data: { chatId: string; userId: string; name: string; typing: boolean; emoji?: string }) => {
      typingHandlers.current.forEach((h) => h(data));
    });

    socket.on("message:read", (data: { chatId: string; readByUserId: string; readAt: number }) => {
      readReceiptHandlers.current.forEach((h) => h(data));
    });

    socket.on("message:blocked", (data: { chatId: string; localId?: string; status: "pending" | "blocked"; message: string }) => {
      messageBlockedHandlers.current.forEach((h) => h(data));
    });

    // In-app parent notification: child attempted to contact someone new
    socket.on("contact:request", (data: { childId: string; childName: string; contactId: string; contactName: string; requestedAt: number }) => {
      contactRequestHandlers.current.forEach((h) => h(data));
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
      preferredLanguage?: string;
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
        const data = await res.json() as { user: { id: string }; authToken?: string };
        const userId = data.user.id;
        if (data.authToken) {
          authTokenRef.current = data.authToken;
          cachedAuthToken = data.authToken;
          await AsyncStorage.setItem(SERVER_TOKEN_KEY, data.authToken);
        }
        await AsyncStorage.setItem(SERVER_USER_KEY, userId);
        setServerUserId(userId);
        serverUserIdRef.current = userId;
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
    async (myUserId: string, theirUserId: string): Promise<DirectChatResult> => {
      try {
        const res = await fetch(`${getApiBase()}/chats/direct`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
          body: JSON.stringify({ myUserId, theirUserId }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { error?: string; approval?: "pending" | "blocked" };
          return { chatId: null, approval: err.approval, error: err.error };
        }
        const data = await res.json() as { chatId: string };
        socketRef.current?.emit("chat:join", data.chatId);
        return { chatId: data.chatId };
      } catch {
        return { chatId: null, error: "Network error" };
      }
    },
    []
  );

  const onMessageBlocked = useCallback((handler: MessageBlockedHandler) => {
    messageBlockedHandlers.current.add(handler);
    return () => { messageBlockedHandlers.current.delete(handler); };
  }, []);

  const switchActiveUser = useCallback(async (userId: string, authToken: string) => {
    // Preserve the current identity (e.g. the parent) so the user can switch back
    const prevId = serverUserIdRef.current;
    const prevToken = authTokenRef.current;
    if (prevId && prevToken && prevId !== userId) {
      await AsyncStorage.setItem(
        PREVIOUS_IDENTITY_KEY,
        JSON.stringify({ userId: prevId, authToken: prevToken })
      );
      setPreviousUserId(prevId);
    }
    authTokenRef.current = authToken;
    cachedAuthToken = authToken;
    await AsyncStorage.multiSet([
      [SERVER_USER_KEY, userId],
      [SERVER_TOKEN_KEY, authToken],
    ]);
    setServerUserId(userId);
    serverUserIdRef.current = userId;
    // Reconnect the socket as the new identity
    socketRef.current?.disconnect();
    socketRef.current = null;
    disconnectTimeRef.current = null;
    connectSocket(userId);
  }, []);

  const switchBackToPreviousUser = useCallback(async (): Promise<boolean> => {
    try {
      const raw = await AsyncStorage.getItem(PREVIOUS_IDENTITY_KEY);
      if (!raw) return false;
      const prev = JSON.parse(raw) as { userId: string; authToken: string };
      if (!prev.userId || !prev.authToken) return false;
      await AsyncStorage.removeItem(PREVIOUS_IDENTITY_KEY);
      setPreviousUserId(null);
      authTokenRef.current = prev.authToken;
      cachedAuthToken = prev.authToken;
      await AsyncStorage.multiSet([
        [SERVER_USER_KEY, prev.userId],
        [SERVER_TOKEN_KEY, prev.authToken],
      ]);
      setServerUserId(prev.userId);
      serverUserIdRef.current = prev.userId;
      socketRef.current?.disconnect();
      socketRef.current = null;
      disconnectTimeRef.current = null;
      connectSocket(prev.userId);
      return true;
    } catch {
      return false;
    }
  }, []);

  const onContactRequest = useCallback((handler: ContactRequestHandler) => {
    contactRequestHandlers.current.add(handler);
    return () => { contactRequestHandlers.current.delete(handler); };
  }, []);

  const createServerGroupChat = useCallback(
    async (myUserId: string, name: string, memberIds: string[]): Promise<string | null> => {
      try {
        const res = await fetch(`${getApiBase()}/chats/group`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
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
        const res = await fetch(url, { headers: await getAuthHeaders() });
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
      const res = await fetch(`${getApiBase()}/chats/user/${userId}`, {
        headers: await getAuthHeaders(),
      });
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

  const translateMessage = useCallback(
    async (text: string, targetLanguage: string, sourceLanguage?: string): Promise<string> => {
      try {
        const res = await fetch(`${getApiBase()}/translate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, targetLanguage, sourceLanguage }),
        });
        if (!res.ok) return text;
        const data = await res.json() as { translatedText?: string };
        return data.translatedText ?? text;
      } catch {
        return text;
      }
    },
    []
  );

  const getSuggestedReply = useCallback(
    async (opts: {
      messages: Array<{ sender: "me" | "them"; senderName?: string; text: string }>;
      chatName?: string;
      myName?: string;
      recipientLanguage?: string;
    }): Promise<string> => {
      try {
        const res = await fetch(`${getApiBase()}/suggest-reply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(opts),
        });
        if (!res.ok) return "";
        const data = await res.json() as { suggestedReply?: string };
        return data.suggestedReply ?? "";
      } catch {
        return "";
      }
    },
    []
  );

  const exportServerChatAsText = useCallback(async (chatId: string): Promise<string | null> => {
    try {
      const uid = serverUserIdRef.current;
      const res = await fetch(`${getApiBase()}/chats/${chatId}/export?format=txt`, {
        headers: await getAuthHeaders(),
      });
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null;
    }
  }, []);

  const backupLocalChat = useCallback(async (opts: {
    localChatId: string;
    chatName: string;
    encryptedData: string;
    messageCount: number;
  }): Promise<boolean> => {
    const uid = serverUserIdRef.current;
    if (!uid) return false;
    try {
      const res = await fetch(`${getApiBase()}/backup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
        body: JSON.stringify({ userId: uid, ...opts }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  const listBackups = useCallback(async (): Promise<ChatBackupMeta[]> => {
    const uid = serverUserIdRef.current;
    if (!uid) return [];
    try {
      const res = await fetch(`${getApiBase()}/backup?userId=${uid}`, {
        headers: await getAuthHeaders(),
      });
      if (!res.ok) return [];
      const data = await res.json() as { backups: ChatBackupMeta[] };
      return data.backups ?? [];
    } catch {
      return [];
    }
  }, []);

  const restoreBackup = useCallback(async (localChatId: string): Promise<string | null> => {
    const uid = serverUserIdRef.current;
    if (!uid) return null;
    try {
      const res = await fetch(`${getApiBase()}/backup/${encodeURIComponent(localChatId)}?userId=${uid}`, {
        headers: await getAuthHeaders(),
      });
      if (!res.ok) return null;
      const data = await res.json() as { backup: { encryptedData: string } };
      return data.backup?.encryptedData ?? null;
    } catch {
      return null;
    }
  }, []);

  const deleteBackup = useCallback(async (localChatId: string): Promise<void> => {
    const uid = serverUserIdRef.current;
    if (!uid) return;
    try {
      await fetch(`${getApiBase()}/backup/${encodeURIComponent(localChatId)}?userId=${uid}`, {
        method: "DELETE",
        headers: await getAuthHeaders(),
      });
    } catch { /* silent */ }
  }, []);

  const fetchServerUser = useCallback(async (userId: string): Promise<ServerUser | null> => {
    try {
      const res = await fetch(`${getApiBase()}/users/${userId}`);
      if (!res.ok) return null;
      const data = await res.json() as { user: ServerUser };
      return data.user ?? null;
    } catch {
      return null;
    }
  }, []);

  const updateServerProfile = useCallback(
    async (userId: string, updates: { displayName?: string; username?: string; statusMessage?: string; avatar?: string; pushToken?: string; preferredLanguage?: string }) => {
      try {
        await fetch(`${getApiBase()}/users/${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
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
        identityReady,
        isConnected,
        registerOnServer,
        updateServerProfile,
        fetchServerUser,
        findUsers,
        getOrCreateDirectChat,
        onMessageBlocked,
        onContactRequest,
        switchActiveUser,
        previousUserId,
        switchBackToPreviousUser,
        createServerGroupChat,
        fetchMessages,
        sendServerMessage,
        fetchUserChats,
        onNewMessage,
        emitTyping,
        onTyping,
        emitChatRead,
        onReadReceipt,
        translateMessage,
        getSuggestedReply,
        exportServerChatAsText,
        backupLocalChat,
        listBackups,
        restoreBackup,
        deleteBackup,
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

let cachedAuthToken: string | null = null;

/** Auth headers for server requests that require a proven identity. */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  if (!cachedAuthToken) {
    cachedAuthToken = await AsyncStorage.getItem(SERVER_TOKEN_KEY);
  }
  return cachedAuthToken ? { "X-Auth-Token": cachedAuthToken } : {};
}
