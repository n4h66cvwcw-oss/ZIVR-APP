import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
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
import {
  buildRecoveredAccountUpdate,
  type RegistrationOptions,
} from "@/utils/registration";
import { useProfile } from "@/context/ProfileContext";
import { clearCachedLanguageForIdentitySwitch } from "@/utils/language-sync";
import {
  resolveServerIdentity,
  serializeServerIdentity,
} from "@/utils/server-identity";

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

type RegistrationResult = {
  userId: string;
  recoveryCode?: string;
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
export type GroupChatResult = {
  chatId: string | null;
  /** Set when a group includes an unapproved or blocked contact for a child account. */
  approval?: "pending" | "blocked";
  error?: string;
};
export type MessageDelivery = "live" | "missed";
type MessageHandler = (msg: ServerMessage, delivery: MessageDelivery) => void;

type MessageBlockedHandler = (data: {
  chatId: string;
  localId?: string;
  status: "pending" | "blocked" | "group_limit";
  message: string;
}) => void;

type ContactRequestHandler = (data: {
  childId: string;
  childName: string;
  contactId: string;
  contactName: string;
  requestedAt: number;
}) => void;
export type ServerContactApproval = {
  contactId: string;
  displayName: string;
  username: string | null;
  avatar: string | null;
  status: "pending" | "approved" | "blocked";
  requestedAt: number;
};
export type ContactApprovedHandler = (data: {
  childId: string;
  contactId: string;
  contactName: string;
}) => void;
type TimeOverrideHandler = (data: { childId: string; overrideUntil: number }) => void;
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
  recoveryCodeToSave: string | null;
  recoveryCodeNeedsReplacement: boolean;
  showRecoveryCode: (code: string) => void;
  acknowledgeRecoveryCode: () => Promise<boolean>;
  replaceRecoveryCode: () => Promise<boolean>;
  registerOnServer: (opts: RegistrationOptions) => Promise<RegistrationResult | null>;
  recoverServerAccount: (recoveryCode: string) => Promise<ServerUser | null>;
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
  onContactApproved: (handler: ContactApprovedHandler) => () => void;
  onTimeOverride: (handler: TimeOverrideHandler) => () => void;
  fetchContactApprovals: (childId: string) => Promise<ServerContactApproval[]>;
  /** Switch this device's active server account (e.g. parent-mediated child handoff). */
  switchActiveUser: (userId: string, authToken: string) => Promise<void>;
  /** Non-null when a previous identity (e.g. the parent) was saved during a switch. */
  previousUserId: string | null;
  /** Restore the identity that was active before the last switchActiveUser. */
  switchBackToPreviousUser: () => Promise<boolean>;
  createServerGroupChat: (myUserId: string, name: string, memberIds: string[]) => Promise<GroupChatResult>;
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
// Stored in the OS credential store so an authenticated account can be
// recovered after app-local AsyncStorage is cleared by a reinstall.
const SECURE_SERVER_IDENTITY_KEY = "@zivr_server_identity";
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
  const { updateProfile } = useProfile();
  const [serverUserId, setServerUserId] = useState<string | null>(null);
  const [identityReady, setIdentityReady] = useState(false);
  const [previousUserId, setPreviousUserId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [recoveryCodeToSave, setRecoveryCodeToSave] = useState<string | null>(null);
  const [recoveryCodeNeedsReplacement, setRecoveryCodeNeedsReplacement] = useState(false);
  const showRecoveryCode = useCallback((code: string) => {
    setRecoveryCodeToSave(code);
    setRecoveryCodeNeedsReplacement(false);
  }, []);
  const socketRef = useRef<Socket | null>(null);
  const messageHandlers = useRef<Set<MessageHandler>>(new Set());
  const typingHandlers = useRef<Set<(d: { chatId: string; userId: string; name: string; typing: boolean; emoji?: string }) => void>>(new Set());
  const readReceiptHandlers = useRef<Set<ReadReceiptHandler>>(new Set());
  const messageBlockedHandlers = useRef<Set<MessageBlockedHandler>>(new Set());
  const contactRequestHandlers = useRef<Set<ContactRequestHandler>>(new Set());
  const contactApprovedHandlers = useRef<Set<ContactApprovedHandler>>(new Set());
  const timeOverrideHandlers = useRef<Set<TimeOverrideHandler>>(new Set());
  const authTokenRef = useRef<string | null>(null);
  // Tracks when the socket last disconnected so we can request missed messages on rejoin
  const disconnectTimeRef = useRef<number | null>(null);
  const serverUserIdRef = useRef<string | null>(null);

  async function persistServerIdentity(userId: string, authToken: string): Promise<void> {
    await AsyncStorage.multiSet([
      [SERVER_USER_KEY, userId],
      [SERVER_TOKEN_KEY, authToken],
    ]);
    try {
      await SecureStore.setItemAsync(
        SECURE_SERVER_IDENTITY_KEY,
        serializeServerIdentity({ userId, authToken }),
      );
    } catch (error) {
      // Keep the active app session functional if a platform does not expose
      // secure storage. The next launch will use the regular AsyncStorage path.
      console.warn("[ServerContext] unable to save recovery identity", error);
    }
  }

  async function provisionRecoveryCode(userId: string, authToken: string): Promise<void> {
    try {
      const res = await fetch(`${getApiBase()}/users/${userId}/recovery-code`, {
        method: "POST",
        headers: { "X-Auth-Token": authToken },
      });
      if (!res.ok) return;
      const data = await res.json() as {
        recoveryCode?: string | null;
        acknowledgementRequired?: boolean;
      };
      if (data.recoveryCode) {
        showRecoveryCode(data.recoveryCode);
      } else {
        setRecoveryCodeNeedsReplacement(data.acknowledgementRequired === true);
      }
    } catch (error) {
      console.warn("[ServerContext] recovery-code provisioning failed", error);
    }
  }

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(SERVER_USER_KEY),
      AsyncStorage.getItem(SERVER_TOKEN_KEY),
      AsyncStorage.getItem(PREVIOUS_IDENTITY_KEY),
      SecureStore.getItemAsync(SECURE_SERVER_IDENTITY_KEY).catch(() => null),
    ]).then(async ([localId, localToken, prevRaw, secureIdentity]) => {
      if (prevRaw) {
        try { setPreviousUserId((JSON.parse(prevRaw) as { userId: string }).userId); } catch { /* ignore */ }
      }
      const identity = resolveServerIdentity(localId, localToken, secureIdentity);
      if (!identity) return;
      if (!localId || !localToken) {
        await AsyncStorage.multiSet([
          [SERVER_USER_KEY, identity.userId],
          [SERVER_TOKEN_KEY, identity.authToken],
        ]);
      }
      setServerUserId(identity.userId);
      serverUserIdRef.current = identity.userId;
      authTokenRef.current = identity.authToken;
      cachedAuthToken = identity.authToken;
      connectSocket(identity.userId);
      void provisionRecoveryCode(identity.userId, identity.authToken);
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
      messageHandlers.current.forEach((h) => h(msg, "live"));
    });

    // Deliver any messages that arrived while the socket was disconnected
    socket.on("missed_messages", (data: { messages: ServerMessage[] }) => {
      if (Array.isArray(data?.messages)) {
        data.messages.forEach((msg) => {
          messageHandlers.current.forEach((h) => h(msg, "missed"));
        });
      }
    });

    socket.on("typing:update", (data: { chatId: string; userId: string; name: string; typing: boolean; emoji?: string }) => {
      typingHandlers.current.forEach((h) => h(data));
    });

    socket.on("message:read", (data: { chatId: string; readByUserId: string; readAt: number }) => {
      readReceiptHandlers.current.forEach((h) => h(data));
    });

    socket.on("message:blocked", (data: {
      chatId: string;
      localId?: string;
      status: "pending" | "blocked" | "group_limit";
      message: string;
    }) => {
      messageBlockedHandlers.current.forEach((h) => h(data));
    });

    // In-app parent notification: child attempted to contact someone new
    socket.on("contact:request", (data: { childId: string; childName: string; contactId: string; contactName: string; requestedAt: number }) => {
      contactRequestHandlers.current.forEach((h) => h(data));
    });

    socket.on("contact:approved", (data: { childId: string; contactId: string; contactName: string }) => {
      contactApprovedHandlers.current.forEach((h) => h(data));
    });

    socket.on("time:override", (data: { childId: string; overrideUntil: number }) => {
      timeOverrideHandlers.current.forEach((h) => h(data));
    });

    socket.on("connect_error", (err) => {
      console.log("[ServerContext] socket connect_error:", err.message);
    });

    socketRef.current = socket;
  }

  const registerOnServer = useCallback(
    async (opts: RegistrationOptions): Promise<RegistrationResult | null> => {
      try {
        const recoveredUserId = serverUserIdRef.current;
        if (recoveredUserId && authTokenRef.current) {
          const res = await fetch(`${getApiBase()}/users/${recoveredUserId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
            body: JSON.stringify(buildRecoveredAccountUpdate(opts)),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({})) as { error?: string };
            console.warn("[ServerContext] recovered account update failed:", err.error);
            return null;
          }
          return { userId: recoveredUserId };
        }

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
        const data = await res.json() as {
          user: { id: string };
          authToken?: string;
          recoveryCode?: string;
        };
        const userId = data.user.id;
        if (data.authToken) {
          authTokenRef.current = data.authToken;
          cachedAuthToken = data.authToken;
          await persistServerIdentity(userId, data.authToken);
        } else {
          await AsyncStorage.setItem(SERVER_USER_KEY, userId);
        }
        setServerUserId(userId);
        serverUserIdRef.current = userId;
        connectSocket(userId);
        return { userId, recoveryCode: data.recoveryCode };
      } catch (e) {
        console.warn("[ServerContext] register error:", e);
        return null;
      }
    },
    []
  );

  const recoverServerAccount = useCallback(
    async (recoveryCode: string): Promise<ServerUser | null> => {
      try {
        const res = await fetch(`${getApiBase()}/users/recover`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recoveryCode: recoveryCode.trim() }),
        });
        if (!res.ok) return null;
        const data = await res.json() as { user?: ServerUser; authToken?: string };
        if (!data.user?.id || !data.authToken) return null;

        authTokenRef.current = data.authToken;
        cachedAuthToken = data.authToken;
        await persistServerIdentity(data.user.id, data.authToken);
        setServerUserId(data.user.id);
        serverUserIdRef.current = data.user.id;
        socketRef.current?.disconnect();
        socketRef.current = null;
        disconnectTimeRef.current = null;
        connectSocket(data.user.id);
        return data.user;
      } catch (error) {
        console.warn("[ServerContext] account recovery failed", error);
        return null;
      }
    },
    []
  );

  const acknowledgeRecoveryCode = useCallback(async (): Promise<boolean> => {
    const userId = serverUserIdRef.current;
    const authToken = authTokenRef.current;
    if (!userId || !authToken) return false;
    try {
      const res = await fetch(`${getApiBase()}/users/${userId}/recovery-code/acknowledge`, {
        method: "POST",
        headers: { "X-Auth-Token": authToken },
      });
      if (!res.ok) return false;
      setRecoveryCodeToSave(null);
      setRecoveryCodeNeedsReplacement(false);
      return true;
    } catch {
      return false;
    }
  }, []);

  const replaceRecoveryCode = useCallback(async (): Promise<boolean> => {
    const userId = serverUserIdRef.current;
    const authToken = authTokenRef.current;
    if (!userId || !authToken) return false;
    try {
      const res = await fetch(`${getApiBase()}/users/${userId}/recovery-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Auth-Token": authToken },
        body: JSON.stringify({ rotate: true }),
      });
      if (!res.ok) return false;
      const data = await res.json() as { recoveryCode?: string | null };
      if (!data.recoveryCode) return false;
      showRecoveryCode(data.recoveryCode);
      return true;
    } catch {
      return false;
    }
  }, [showRecoveryCode]);

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
    if (prevId !== userId) {
      await updateProfile(clearCachedLanguageForIdentitySwitch());
    }
    authTokenRef.current = authToken;
    cachedAuthToken = authToken;
    await persistServerIdentity(userId, authToken);
    setServerUserId(userId);
    serverUserIdRef.current = userId;
    // Reconnect the socket as the new identity
    socketRef.current?.disconnect();
    socketRef.current = null;
    disconnectTimeRef.current = null;
    connectSocket(userId);
    void provisionRecoveryCode(userId, authToken);
  }, [updateProfile]);

  const switchBackToPreviousUser = useCallback(async (): Promise<boolean> => {
    try {
      const raw = await AsyncStorage.getItem(PREVIOUS_IDENTITY_KEY);
      if (!raw) return false;
      const prev = JSON.parse(raw) as { userId: string; authToken: string };
      if (!prev.userId || !prev.authToken) return false;
      await AsyncStorage.removeItem(PREVIOUS_IDENTITY_KEY);
      setPreviousUserId(null);
      if (serverUserIdRef.current !== prev.userId) {
        await updateProfile(clearCachedLanguageForIdentitySwitch());
      }
      authTokenRef.current = prev.authToken;
      cachedAuthToken = prev.authToken;
    await persistServerIdentity(prev.userId, prev.authToken);
      setServerUserId(prev.userId);
      serverUserIdRef.current = prev.userId;
      socketRef.current?.disconnect();
      socketRef.current = null;
      disconnectTimeRef.current = null;
      connectSocket(prev.userId);
      void provisionRecoveryCode(prev.userId, prev.authToken);
      return true;
    } catch {
      return false;
    }
  }, [updateProfile]);

  const onContactRequest = useCallback((handler: ContactRequestHandler) => {
    contactRequestHandlers.current.add(handler);
    return () => { contactRequestHandlers.current.delete(handler); };
  }, []);

  const onContactApproved = useCallback((handler: ContactApprovedHandler) => {
    contactApprovedHandlers.current.add(handler);
    return () => { contactApprovedHandlers.current.delete(handler); };
  }, []);

  const onTimeOverride = useCallback((handler: TimeOverrideHandler) => {
    timeOverrideHandlers.current.add(handler);
    return () => { timeOverrideHandlers.current.delete(handler); };
  }, []);

  const fetchContactApprovals = useCallback(async (childId: string): Promise<ServerContactApproval[]> => {
    try {
      const res = await fetch(`${getApiBase()}/parental/children/${childId}/contacts`, {
        headers: await getAuthHeaders(),
      });
      if (!res.ok) return [];
      const data = await res.json() as { contacts: ServerContactApproval[] };
      return data.contacts ?? [];
    } catch {
      return [];
    }
  }, []);

  const createServerGroupChat = useCallback(
    async (myUserId: string, name: string, memberIds: string[]): Promise<GroupChatResult> => {
      try {
        const res = await fetch(`${getApiBase()}/chats/group`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
          body: JSON.stringify({ myUserId, name, memberIds }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as {
            error?: string;
            approval?: "pending" | "blocked";
          };
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
        recoveryCodeToSave,
        recoveryCodeNeedsReplacement,
        showRecoveryCode,
        acknowledgeRecoveryCode,
        replaceRecoveryCode,
        registerOnServer,
        recoverServerAccount,
        updateServerProfile,
        fetchServerUser,
        findUsers,
        getOrCreateDirectChat,
        onMessageBlocked,
        onContactRequest,
        onContactApproved,
        onTimeOverride,
        fetchContactApprovals,
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
