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
import { AppState, AppStateStatus, Platform } from "react-native";
import { io, Socket } from "socket.io-client";
import {
  buildRecoveredAccountUpdate,
  type RegistrationOptions,
} from "@/utils/registration";
import { useProfile } from "@/context/ProfileContext";
import { clearCachedLanguageForIdentitySwitch } from "@/utils/language-sync";
import { mapRecoveryEmailResponse, parseRetryAfterSeconds, type RecoveryEmailOutcome } from "@/utils/recovery-email";
import {
  SESSION_INVALID_MESSAGE,
  pickRehydratedAuthToken,
  resolveServerIdentity,
  serializeServerIdentity,
} from "@/utils/server-identity";
import {
  outboxStorageKey,
  removeOutboxEntry,
  restMessageBody,
  socketMessagePayload,
  upsertOutboxEntry,
  type MessageOutboxEntry,
  type ServerImageMedia,
} from "@/utils/message-outbox";
import { coerceEpochMillis } from "@/utils/message-time";
import {
  JOIN_ACK_TIMEOUT_MS,
  MAX_JOIN_ATTEMPTS,
  advanceLastSeen,
  computeJoinSince,
  emptyDiagnostics,
  isJoinAuthError,
  joinPayload,
  lastCaughtUpStorageKey,
  lastSeenStorageKey,
  shouldForceReconnect,
  type SocketDiagnostics,
} from "@/utils/socket-session";

export type ServerUser = {
  id: string;
  displayName: string;
  username?: string;
  phone?: string;
  /** Optional recovery email (vm_users.email); absent for phone-only accounts. */
  email?: string | null;
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
  /** Sender localId when a history row includes it. Reaction fanout calls this `clientId`. */
  clientId?: string;
  reactions?: Record<string, string[]>;
  media?: ServerImageMedia | null;
};

/** REST response and `message:reaction` fanout. `reactions` is the full map after the toggle. */
export type MessageReactionEvent = {
  messageId: string;
  clientId?: string;
  chatId: string;
  emoji: string;
  userId: string;
  action: "added" | "removed";
  reactions: Record<string, string[]>;
};

export type ServerChat = {
  id: string;
  type: "direct" | "group";
  name: string | null;
  description: string | null;
  lastMessageAt: number | null;
  members: Array<{ id: string; displayName: string; avatar: string | null; isOnline: boolean }>;
};

export type ServerCheckInReply = {
  id: string;
  broadcastId?: string;
  clientId?: string;
  memberId: string;
  text: string;
  audioAttachment?: unknown;
  timestamp: number;
  read?: boolean;
};
export type ServerCheckInBroadcast = {
  id: string;
  groupId: string;
  senderId: string;
  text: string;
  audioAttachment?: unknown;
  timestamp: number;
  deadline?: number;
  replies: Record<string, ServerCheckInReply[]>;
  progress?: { total: number; replied: number };
  clientId?: string;
};
export type ServerCheckInGroup = {
  id: string;
  name: string;
  description?: string | null;
  memberIds: string[];
  memberCount?: number;
  createdAt: number;
  anonymous: boolean;
  creatorId: string;
};
export type CheckInFetchResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

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
type TimeOverrideHandler = (data: { childId: string; overrideUntil: number | null }) => void;
type ReadReceiptHandler = (data: { chatId: string; readByUserId: string; readAt: number }) => void;
type MessageReactionHandler = (event: MessageReactionEvent) => void;
type CheckinBroadcastHandler = (broadcast: ServerCheckInBroadcast) => void;
type CheckinReplyHandler = (reply: ServerCheckInReply) => void;
type CheckinProgressHandler = (data: { broadcastId: string; total: number; replied: number }) => void;

export type ChatBackupMeta = {
  id: string;
  localChatId: string;
  chatName: string;
  messageCount: number;
  backedUpAt: number;
};

export type ScheduledMessage = {
  id: string;
  chatId: string;
  chatName: string;
  text: string;
  scheduledFor: number;
  status: "pending" | "sending" | "sent" | "cancelled" | "failed";
  createdAt: number;
  updatedAt: number;
  sentMessageId?: string | null;
  failureReason?: string | null;
  approvalReminderMinutes?: number | null;
  reminderSentAt?: number | null;
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
  /** Public, unauthenticated: ask the server to email a recovery code (never returned to the client). */
  requestRecoveryEmail: (target: { email?: string; phone?: string }) => Promise<RecoveryEmailOutcome>;
  /** Authenticated: GET /users/:id/email — the signed-in user's recovery email, or null. */
  fetchRecoveryEmail: () => Promise<string | null>;
  /** Authenticated: PUT /users/:id/email (PATCH /users/:id fallback) to set/update the recovery email. */
  updateRecoveryEmail: (email: string) => Promise<boolean>;
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
  sendServerMessage: (
    chatId: string,
    senderId: string,
    text: string,
    localId?: string,
    media?: ServerImageMedia,
  ) => Promise<{ ok: true } | { ok: false; error: string; retryable: boolean; suppressed?: boolean; code?: string }>;
  /**
   * Toggle a reaction. `messageId` is the server uuid when this phone knows it,
   * otherwise the local message id (the sender's `localId` / reaction `clientId`).
   * Body is `{ emoji }` only. Response matches `MessageReactionEvent`.
   */
  postMessageReaction: (chatId: string, messageId: string, emoji: string) => Promise<MessageReactionEvent | null>;
  onMessageReaction: (handler: (event: MessageReactionEvent) => void) => () => void;
  listScheduledMessages: () => Promise<ScheduledMessage[]>;
  createScheduledMessage: (input: { chatId: string; text: string; scheduledFor: number; approvalReminderMinutes?: number | null }) => Promise<ScheduledMessage>;
  updateScheduledMessage: (id: string, input: { text?: string; scheduledFor?: number; approvalReminderMinutes?: number | null }) => Promise<ScheduledMessage>;
  cancelScheduledMessage: (id: string) => Promise<void>;
  fetchUserChats: (userId: string) => Promise<ServerChat[]>;
  fetchCheckInGroups: () => Promise<CheckInFetchResult<ServerCheckInGroup[]>>;
  fetchCheckInBroadcasts: () => Promise<CheckInFetchResult<ServerCheckInBroadcast[]>>;
  markCheckInBroadcastsRead: (broadcastId: string) => Promise<void>;
  createCheckInGroup: (input: { name: string; memberIds: string[]; anonymous?: boolean; description?: string }) => Promise<ServerCheckInGroup | null>;
  sendCheckinBroadcast: (input: { groupId: string; text: string; audioAttachment?: unknown; deadline?: number; clientId?: string }) => Promise<ServerCheckInBroadcast>;
  replyToCheckin: (input: { broadcastId: string; text: string; audioAttachment?: unknown; clientId?: string }) => Promise<ServerCheckInReply>;
  onCheckinBroadcast: (handler: CheckinBroadcastHandler) => () => void;
  onCheckinReply: (handler: CheckinReplyHandler) => () => void;
  onCheckinProgress: (handler: CheckinProgressHandler) => () => void;
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
  exportServerChat: (chatId: string) => Promise<{
    chatName: string | null;
    messages: Array<{ id: string; senderId: string; senderName: string; text: string; type: string; createdAt: number }>;
  } | null>;
  summarizeChatForExport: (opts: {
    chatName?: string;
    format: "summary" | "bullets";
    messages: Array<{ senderName?: string; text: string; timestamp?: number }>;
  }) => Promise<{ appendix: string; sourceTruncated: boolean } | null>;
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
const REGISTRATION_TIMEOUT_MS = 15_000;

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REGISTRATION_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function getApiBase(): string {
  const override = process.env["EXPO_PUBLIC_API_URL"];
  if (override) return override;
  const domain = process.env["EXPO_PUBLIC_DOMAIN"];
  if (domain) return `https://${domain}/api`;
  return PRODUCTION_API;
}

function getSocketUrl(): string {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"];
  if (domain) return `https://${domain}`;
  return "https://echo-stream.replit.app";
}

const SOCKET_DIAGNOSTICS_ENABLED =
  (typeof __DEV__ !== "undefined" && __DEV__) ||
  process.env["EXPO_PUBLIC_E2E_DIAGNOSTICS"] === "1";

/** While active and joined, re-run user:join with `since` so a dropped fan-out can be recovered. */
const FOREGROUND_CATCH_UP_INTERVAL_MS = 90 * 1000;

let socketDiagnostics: SocketDiagnostics = emptyDiagnostics("");

function updateDiagnostics(patch: Partial<SocketDiagnostics>, event?: string) {
  socketDiagnostics = { ...socketDiagnostics, ...patch };
  if (SOCKET_DIAGNOSTICS_ENABLED && event) {
    console.log(`[ServerContext][socket] ${event}`, JSON.stringify(patch));
  }
}

/** Snapshot for a diagnostics screen. Transport-open is not the same as joined. */
export function getSocketDiagnostics(): SocketDiagnostics {
  return { ...socketDiagnostics };
}

export type { RecoveryEmailOutcome } from "@/utils/recovery-email";


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
  const reactionHandlers = useRef<Set<MessageReactionHandler>>(new Set());
  const messageBlockedHandlers = useRef<Set<MessageBlockedHandler>>(new Set());
  const contactRequestHandlers = useRef<Set<ContactRequestHandler>>(new Set());
  const contactApprovedHandlers = useRef<Set<ContactApprovedHandler>>(new Set());
  const timeOverrideHandlers = useRef<Set<TimeOverrideHandler>>(new Set());
  const checkinBroadcastHandlers = useRef<Set<CheckinBroadcastHandler>>(new Set());
  const checkinReplyHandlers = useRef<Set<CheckinReplyHandler>>(new Set());
  const checkinProgressHandlers = useRef<Set<CheckinProgressHandler>>(new Set());
  const authTokenRef = useRef<string | null>(null);
  const outboxRef = useRef<MessageOutboxEntry[]>([]);
  const outboxInFlightRef = useRef<Set<string>>(new Set());
  const flushOutboxRef = useRef<() => Promise<void>>(async () => {});
  // Tracks when the socket last disconnected so we can request missed messages on rejoin
  const disconnectTimeRef = useRef<number | null>(null);
  const serverUserIdRef = useRef<string | null>(null);
  // Newest server createdAt this device has received (server clock).
  const lastSeenMessageAtRef = useRef<number | null>(null);
  const lastSeenLoadedForRef = useRef<string | null>(null);
  // Device time of the last user:join the server acknowledged.
  const lastCaughtUpAtRef = useRef<number | null>(null);
  const pendingCatchUpAtRef = useRef<number | null>(null);
  const candidateCatchUpAtRef = useRef<number | null>(null);
  const socketUserIdRef = useRef<string | null>(null);
  const backgroundedAtRef = useRef<number | null>(null);
  // True only after the server acknowledged user:join with user:joined.
  const userJoinedRef = useRef(false);
  const joinAttemptsRef = useRef(0);
  const joinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingChatJoinsRef = useRef<Set<string>>(new Set());

  async function persistServerIdentity(userId: string, authToken: string): Promise<void> {
    authTokenRef.current = authToken;
    cachedAuthToken = authToken;
    await AsyncStorage.multiSet([
      [SERVER_USER_KEY, userId],
      [SERVER_TOKEN_KEY, authToken],
    ]);
    try {
      if (Platform.OS === "web") return;
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
      Platform.OS === "web"
        ? Promise.resolve(null)
        : SecureStore.getItemAsync(SECURE_SERVER_IDENTITY_KEY).catch(() => null),
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

  // API #15: leaving active emits "user:away" with no payload. The socket
  // stays up so rooms and the outbox survive. The server marks this
  // connection away (another foreground socket for the same user stays
  // online). Foreground is the existing user:join, which still sends `since`.
  // TF build 29 ASC AHrW0N4I20KFwkP7MjR9J74.
  useEffect(() => {
    function emitUserAway() {
      const socket = socketRef.current;
      if (!socket?.connected) return;
      socket.emit("user:away");
      updateDiagnostics({}, "user:away");
    }

    function handleAppStateChange(nextState: AppStateStatus) {
      if (nextState === "background" || nextState === "inactive") {
        if (backgroundedAtRef.current === null) backgroundedAtRef.current = Date.now();
        emitUserAway();
        return;
      }
      if (nextState !== "active") return;
      const userId = serverUserIdRef.current;
      if (!userId) return;
      const socket = socketRef.current;
      if (!socket) {
        connectSocket(userId);
        return;
      }
      if (!socket.connected) {
        // Socket.io auto-reconnects; nudge it. "connect" will send user:join.
        socket.connect();
        return;
      }
      if (shouldForceReconnect(backgroundedAtRef.current, Date.now())) {
        // After a long background the OS may have frozen the websocket while
        // socket.connected still reads true. Force a fresh transport.
        updateDiagnostics({}, "foreground: forcing reconnect");
        if (disconnectTimeRef.current === null) disconnectTimeRef.current = backgroundedAtRef.current;
        socket.disconnect();
        socket.connect();
        return;
      }
      sendUserJoin(socket, userId, "foreground");
    }

    const sub = AppState.addEventListener("change", handleAppStateChange);
    const interval = setInterval(() => {
      const socket = socketRef.current;
      const userId = serverUserIdRef.current;
      if (!socket?.connected || !userId || !userJoinedRef.current) return;
      if (AppState.currentState !== "active") return;
      sendUserJoin(socket, userId, "periodic catch-up");
    }, FOREGROUND_CATCH_UP_INTERVAL_MS);
    return () => {
      sub.remove();
      clearInterval(interval);
    };
  }, []);

  async function loadLastSeen(userId: string): Promise<void> {
    if (lastSeenLoadedForRef.current === userId) return;
    lastSeenLoadedForRef.current = userId;
    try {
      const [[, rawSeen], [, rawCaughtUp]] = await AsyncStorage.multiGet([
        lastSeenStorageKey(userId),
        lastCaughtUpStorageKey(userId),
      ]);
      if (serverUserIdRef.current !== userId) return;
      const seen = rawSeen ? Number(rawSeen) : NaN;
      if (Number.isFinite(seen)) {
        lastSeenMessageAtRef.current = advanceLastSeen(lastSeenMessageAtRef.current, seen);
      }
      const caughtUp = rawCaughtUp ? Number(rawCaughtUp) : NaN;
      if (Number.isFinite(caughtUp) && lastCaughtUpAtRef.current === null) {
        lastCaughtUpAtRef.current = caughtUp;
      }
    } catch { /* catch-up falls back to device gap markers */ }
  }

  function noteMessageSeen(createdAt: unknown) {
    const prev = lastSeenMessageAtRef.current;
    const next = advanceLastSeen(prev, createdAt);
    if (next === prev || next === null) return;
    lastSeenMessageAtRef.current = next;
    updateDiagnostics({ lastSeenMessageAt: next });
    const userId = serverUserIdRef.current;
    if (userId) AsyncStorage.setItem(lastSeenStorageKey(userId), String(next)).catch(() => {});
  }

  function commitCatchUpCandidate(userId: string) {
    const candidate = candidateCatchUpAtRef.current;
    candidateCatchUpAtRef.current = null;
    if (candidate === null) return;
    if (lastCaughtUpAtRef.current !== null && candidate <= lastCaughtUpAtRef.current) return;
    lastCaughtUpAtRef.current = candidate;
    updateDiagnostics({ lastCaughtUpAt: candidate });
    AsyncStorage.setItem(lastCaughtUpStorageKey(userId), String(candidate)).catch(() => {});
  }

  function clearJoinTimer() {
    if (joinTimerRef.current) {
      clearTimeout(joinTimerRef.current);
      joinTimerRef.current = null;
    }
  }

  function markNotJoined(reason: string | null) {
    clearJoinTimer();
    pendingCatchUpAtRef.current = null;
    candidateCatchUpAtRef.current = null;
    userJoinedRef.current = false;
    setIsConnected(false);
    updateDiagnostics(
      reason ? { userJoined: false, lastError: reason, lastErrorAt: Date.now() } : { userJoined: false },
      reason ? "not joined" : undefined,
    );
  }

  function resetRealtimeAnchors() {
    lastSeenMessageAtRef.current = null;
    lastSeenLoadedForRef.current = null;
    lastCaughtUpAtRef.current = null;
    pendingCatchUpAtRef.current = null;
    candidateCatchUpAtRef.current = null;
    pendingChatJoinsRef.current.clear();
    disconnectTimeRef.current = null;
    backgroundedAtRef.current = null;
  }

  /**
   * Send user:join with a catch-up `since`, and re-send if the server never
   * acknowledges. Connected stays false until `user:joined`.
   */
  function sendUserJoin(socket: Socket, userId: string, reason: string) {
    if (!socket.connected || socketRef.current !== socket) return;
    clearJoinTimer();
    const since = computeJoinSince({
      lastCaughtUpAt: lastCaughtUpAtRef.current,
      lastSeenMessageAt: lastSeenMessageAtRef.current,
      lastDisconnectAt: disconnectTimeRef.current,
      lastBackgroundAt: backgroundedAtRef.current,
      now: Date.now(),
    });
    joinAttemptsRef.current += 1;
    if (pendingCatchUpAtRef.current === null) pendingCatchUpAtRef.current = Date.now();
    socket.emit("user:join", joinPayload(userId, since));
    updateDiagnostics({
      joinAttempts: joinAttemptsRef.current,
      lastJoinSentAt: Date.now(),
      lastJoinSince: since ?? null,
    }, `user:join (${reason})`);
    joinTimerRef.current = setTimeout(() => {
      joinTimerRef.current = null;
      if (userJoinedRef.current || socketRef.current !== socket || !socket.connected) return;
      if (joinAttemptsRef.current >= MAX_JOIN_ATTEMPTS) {
        markNotJoined("user:join not acknowledged");
        return;
      }
      sendUserJoin(socket, userId, "retry");
    }, JOIN_ACK_TIMEOUT_MS * Math.min(joinAttemptsRef.current, 3));
  }

  function joinChatRoom(chatId: string) {
    const socket = socketRef.current;
    if (socket?.connected && userJoinedRef.current) {
      socket.emit("chat:join", chatId);
    } else {
      pendingChatJoinsRef.current.add(chatId);
    }
  }

  function teardownSocket() {
    clearJoinTimer();
    const old = socketRef.current;
    socketRef.current = null;
    if (old) {
      old.removeAllListeners();
      old.disconnect();
    }
    socketUserIdRef.current = null;
    pendingCatchUpAtRef.current = null;
    candidateCatchUpAtRef.current = null;
    userJoinedRef.current = false;
    setIsConnected(false);
  }

  function connectSocket(userId: string) {
    const existing = socketRef.current;
    if (existing && socketUserIdRef.current !== userId) {
      teardownSocket();
    } else if (existing && (existing.connected || existing.active)) {
      if (!existing.connected) existing.connect();
      return;
    }
    if (socketRef.current) teardownSocket();

    const serverUrl = getSocketUrl();
    socketDiagnostics = emptyDiagnostics(serverUrl);
    updateDiagnostics({ userId, lastSeenMessageAt: lastSeenMessageAtRef.current }, "connectSocket");
    void loadLastSeen(userId);

    const socket = io(serverUrl, {
      path: "/api/socket.io",
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 2000,
      timeout: 10000,
      auth: (cb) => cb({ token: authTokenRef.current }),
    });
    socketRef.current = socket;
    socketUserIdRef.current = userId;

    socket.on("connect", () => {
      // Transport is up, but we are NOT ready until user:joined arrives.
      userJoinedRef.current = false;
      joinAttemptsRef.current = 0;
      setIsConnected(false);
      updateDiagnostics({ transportConnected: true, socketId: socket.id ?? null, userJoined: false }, "connect");
      void loadLastSeen(userId).finally(() => {
        if (socketRef.current === socket) sendUserJoin(socket, userId, "connect");
      });
    });

    socket.on("user:joined", (data: { userId?: string; chatRooms?: string[] }) => {
      if (socketRef.current !== socket) return;
      if (data?.userId && data.userId !== userId) {
        markNotJoined(`user:joined for unexpected user ${data.userId}`);
        return;
      }
      clearJoinTimer();
      userJoinedRef.current = true;
      setIsConnected(true);
      joinAttemptsRef.current = 0;
      commitCatchUpCandidate(userId);
      candidateCatchUpAtRef.current = pendingCatchUpAtRef.current;
      pendingCatchUpAtRef.current = null;
      disconnectTimeRef.current = null;
      backgroundedAtRef.current = null;
      updateDiagnostics({
        userJoined: true,
        lastJoinedAt: Date.now(),
        joinedRoomCount: Array.isArray(data?.chatRooms) ? data.chatRooms.length : null,
      }, "user:joined");
      const pending = [...pendingChatJoinsRef.current];
      pendingChatJoinsRef.current.clear();
      pending.forEach((chatId) => socket.emit("chat:join", chatId));
      void flushOutboxRef.current();
    });

    socket.on("error", (payload: unknown) => {
      const message = typeof (payload as { message?: unknown } | null)?.message === "string"
        ? (payload as { message: string }).message
        : String(payload);
      if (isJoinAuthError(payload)) {
        markNotJoined(message);
      } else {
        updateDiagnostics({ lastError: message, lastErrorAt: Date.now() }, "server error");
      }
    });

    socket.on("disconnect", (reason: string) => {
      clearJoinTimer();
      pendingCatchUpAtRef.current = null;
      candidateCatchUpAtRef.current = null;
      userJoinedRef.current = false;
      setIsConnected(false);
      if (disconnectTimeRef.current === null) disconnectTimeRef.current = Date.now();
      updateDiagnostics({ transportConnected: false, userJoined: false, lastError: `disconnect: ${reason}`, lastErrorAt: Date.now() }, "disconnect");
    });

    socket.on("message:new", (msg: ServerMessage) => {
      noteMessageSeen(msg?.createdAt);
      updateDiagnostics({ lastMessageNewAt: Date.now() });
      const createdAt = coerceEpochMillis(msg?.createdAt);
      const normalized = { ...msg, createdAt: Number.isFinite(createdAt) ? createdAt : 0 };
      messageHandlers.current.forEach((h) => h(normalized, "live"));
    });

    // Deliver any messages that arrived while the socket was disconnected
    socket.on("missed_messages", (data: { messages: ServerMessage[] }) => {
      if (Array.isArray(data?.messages)) {
        updateDiagnostics({ lastMissedBatchSize: data.messages.length }, "missed_messages");
        queueMicrotask(() => { if (socketRef.current === socket) commitCatchUpCandidate(userId); });
        data.messages.forEach((msg) => {
          noteMessageSeen(msg?.createdAt);
          const createdAt = coerceEpochMillis(msg?.createdAt);
          const normalized = { ...msg, createdAt: Number.isFinite(createdAt) ? createdAt : 0 };
          messageHandlers.current.forEach((h) => h(normalized, "missed"));
        });
      }
    });

    socket.on("typing:update", (data: { chatId: string; userId: string; name: string; typing: boolean; emoji?: string }) => {
      typingHandlers.current.forEach((h) => h(data));
    });

    socket.on("message:read", (data: { chatId: string; readByUserId: string; readAt: number }) => {
      readReceiptHandlers.current.forEach((h) => h(data));
    });

    socket.on("message:reaction", (data: MessageReactionEvent) => {
      if (!data || typeof data.chatId !== "string" || typeof data.messageId !== "string") return;
      reactionHandlers.current.forEach((h) => h(data));
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

    socket.on("time:override", (data: { childId: string; overrideUntil: number | null }) => {
      timeOverrideHandlers.current.forEach((h) => h(data));
    });

    socket.on("checkin:hydrate", (data: { broadcasts?: ServerCheckInBroadcast[] }) => {
      (data.broadcasts ?? []).forEach((broadcast) => {
        checkinBroadcastHandlers.current.forEach((handler) => handler(broadcast));
      });
    });
    socket.on("checkin:new", (broadcast: ServerCheckInBroadcast) => {
      checkinBroadcastHandlers.current.forEach((handler) => handler(broadcast));
    });
    socket.on("checkin:reply", (reply: ServerCheckInReply) => {
      checkinReplyHandlers.current.forEach((handler) => handler(reply));
    });
    socket.on("checkin:progress", (data: { broadcastId: string; total: number; replied: number }) => {
      checkinProgressHandlers.current.forEach((handler) => handler(data));
    });

    socket.on("connect_error", (err) => {
      console.log("[ServerContext] socket connect_error:", err.message);
      updateDiagnostics({ lastError: `connect_error: ${err.message}`, lastErrorAt: Date.now() }, "connect_error");
    });
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

        await persistServerIdentity(data.user.id, data.authToken);
        setServerUserId(data.user.id);
        serverUserIdRef.current = data.user.id;
        resetRealtimeAnchors();
        teardownSocket();
        connectSocket(data.user.id);
        return data.user;
      } catch (error) {
        console.warn("[ServerContext] account recovery failed", error);
        return null;
      }
    },
    []
  );

  const requestRecoveryEmail = useCallback(
    async (target: { email?: string; phone?: string }): Promise<RecoveryEmailOutcome> => {
      const email = target.email?.trim() || undefined;
      const phone = target.phone?.trim() || undefined;
      if (!email && !phone) return { result: "missing_target" };
      try {
        const res = await fetchWithTimeout(`${getApiBase()}/users/recover/request-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...(email ? { email } : {}), ...(phone ? { phone } : {}) }),
        });
        if (res.ok) return { result: "sent" };
        const body = await res.json().catch(() => ({})) as { error?: unknown; retryAfterSeconds?: unknown };
        const errorCode = typeof body.error === "string" ? body.error : undefined;
        const result = mapRecoveryEmailResponse(res.status, errorCode);
        if (result === "rate_limited") {
          return { result, retryAfterSeconds: parseRetryAfterSeconds(body.retryAfterSeconds, res.headers?.get?.("Retry-After")) };
        }
        return { result };
      } catch (error) {
        console.warn("[ServerContext] recovery email request failed", error);
        return { result: "network_error" };
      }
    },
    []
  );

  const fetchRecoveryEmail = useCallback(async (): Promise<string | null> => {
    const userId = serverUserIdRef.current;
    if (!userId) return null;
    try {
      const res = await fetchWithTimeout(`${getApiBase()}/users/${userId}/email`, {
        headers: await getAuthHeaders(),
      });
      if (!res.ok) return null;
      const body = await res.json().catch(() => ({})) as { email?: unknown };
      return typeof body.email === "string" && body.email.trim() ? body.email.trim() : null;
    } catch (error) {
      console.warn("[ServerContext] fetchRecoveryEmail failed", error);
      return null;
    }
  }, []);

  const updateRecoveryEmail = useCallback(async (email: string): Promise<boolean> => {
    const userId = serverUserIdRef.current;
    const clean = email.trim();
    if (!userId || !clean) return false;
    const headers = { "Content-Type": "application/json", ...(await getAuthHeaders()) };
    const body = JSON.stringify({ email: clean });
    try {
      const res = await fetchWithTimeout(`${getApiBase()}/users/${userId}/email`, { method: "PUT", headers, body });
      if (res.ok) return true;
      if (res.status !== 404 && res.status !== 405) return false;
      const fallback = await fetchWithTimeout(`${getApiBase()}/users/${userId}`, { method: "PATCH", headers, body });
      return fallback.ok;
    } catch (error) {
      console.warn("[ServerContext] updateRecoveryEmail failed", error);
      return false;
    }
  }, []);

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
        joinChatRoom(data.chatId);
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
    await persistServerIdentity(userId, authToken);
    setServerUserId(userId);
    serverUserIdRef.current = userId;
    resetRealtimeAnchors();
    teardownSocket();
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
      await persistServerIdentity(prev.userId, prev.authToken);
      setServerUserId(prev.userId);
      serverUserIdRef.current = prev.userId;
      resetRealtimeAnchors();
      teardownSocket();
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
        joinChatRoom(data.chatId);
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
        return (data.messages ?? []).map((message) => {
          const createdAt = coerceEpochMillis(message.createdAt);
          return { ...message, createdAt: Number.isFinite(createdAt) ? createdAt : 0 };
        });
      } catch {
        return [];
      }
    },
    []
  );

  const persistOutbox = useCallback((ownerUserId: string, entries: MessageOutboxEntry[]) => {
    outboxRef.current = entries;
    AsyncStorage.setItem(outboxStorageKey(ownerUserId), JSON.stringify(entries)).catch(() => {});
  }, []);

  const postOutboxEntry = useCallback(async (entry: MessageOutboxEntry) => {
    const send = async () => {
      const headers = await getAuthHeaders();
      if (headers["X-Auth-Token"] && !authTokenRef.current) {
        authTokenRef.current = headers["X-Auth-Token"];
      }
      return fetch(`${getApiBase()}/chats/${entry.chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(restMessageBody(entry)),
      });
    };
    let res = await send();
    if (res.status === 401) {
      const recovered = await rehydrateAuthToken(cachedAuthToken);
      if (recovered) authTokenRef.current = recovered;
      res = await send();
    }
    const data = await res.json().catch(() => ({})) as { error?: string; code?: string; approval?: string };
    if (res.ok) return { ok: true as const };
    const status = data.code || data.approval || "";
    const authFailed = res.status === 401 || status === "auth";
    return {
      ok: false as const,
      error: authFailed ? SESSION_INVALID_MESSAGE : (data.error ?? "Message not delivered"),
      retryable: res.status >= 500,
      suppressed: status === "blocked" || status === "pending" || status === "group_limit",
      ...(authFailed ? { code: "auth" } : status ? { code: status } : {}),
    };
  }, []);

  const deliverOutboxEntry = useCallback(async (entry: MessageOutboxEntry) => {
    const flightKey = `${entry.ownerUserId}:${entry.localId}`;
    if (outboxInFlightRef.current.has(flightKey)) {
      return { ok: false as const, error: "Message not delivered", retryable: true };
    }
    outboxInFlightRef.current.add(flightKey);
    try {
      const payload = socketMessagePayload(entry);
      const socket = socketRef.current;
      // An unjoined socket rejects message:send as auth. REST uses X-Auth-Token
      // and is the path until user:joined, including image data URLs.
      if (socket?.connected && userJoinedRef.current) {
        const acked = await new Promise<{ ok: boolean; error?: string; status?: string } | null>((resolve) => {
          let settled = false;
          const finish = (value: { ok: boolean; error?: string; status?: string } | null) => {
            if (settled) return;
            settled = true;
            resolve(value);
          };
          socket.timeout(20000).emit("message:send", payload, (err: unknown, result?: { ok: boolean; error?: string; status?: string }) => {
            if (err || !result) finish(null);
            else finish(result);
          });
        });
        if (acked?.ok) {
          persistOutbox(entry.ownerUserId, removeOutboxEntry(outboxRef.current, entry.ownerUserId, entry.localId));
          return { ok: true as const };
        }
        const terminal = acked?.status != null && ["invalid", "not_member", "blocked", "pending", "group_limit"].includes(acked.status);
        if (acked && acked.ok === false && terminal) {
          persistOutbox(entry.ownerUserId, removeOutboxEntry(outboxRef.current, entry.ownerUserId, entry.localId));
          return {
            ok: false as const,
            error: acked.error ?? "Message not delivered",
            retryable: false,
            suppressed: acked.status === "blocked" || acked.status === "pending" || acked.status === "group_limit",
            code: acked.status,
          };
        }
      }
      const posted = await postOutboxEntry(entry);
      if (posted.ok || !posted.retryable) {
        persistOutbox(entry.ownerUserId, removeOutboxEntry(outboxRef.current, entry.ownerUserId, entry.localId));
      }
      return posted;
    } catch {
      return { ok: false as const, error: "Message not delivered", retryable: true };
    } finally {
      outboxInFlightRef.current.delete(flightKey);
    }
  }, [persistOutbox, postOutboxEntry]);

  const flushOutbox = useCallback(async () => {
    const ownerUserId = serverUserIdRef.current;
    if (!ownerUserId) return;
    const pending = outboxRef.current.filter((entry) => entry.ownerUserId === ownerUserId);
    for (const entry of pending) {
      await deliverOutboxEntry(entry);
    }
  }, [deliverOutboxEntry]);
  flushOutboxRef.current = flushOutbox;

  const sendServerMessage = useCallback(
    async (
      chatId: string,
      senderId: string,
      text: string,
      localId?: string,
      media?: ServerImageMedia,
    ) => {
      if (!localId) {
        return { ok: false as const, error: "Message not delivered", retryable: true };
      }
      const entry: MessageOutboxEntry = { chatId, text, localId, ownerUserId: senderId, ...(media ? { media } : {}) };
      persistOutbox(senderId, upsertOutboxEntry(outboxRef.current, entry));
      return deliverOutboxEntry(entry);
    },
    [deliverOutboxEntry, persistOutbox],
  );

  useEffect(() => {
    if (!serverUserId) {
      outboxRef.current = [];
      return;
    }
    let cancelled = false;
    AsyncStorage.getItem(outboxStorageKey(serverUserId)).then((raw) => {
      if (cancelled || !raw) return;
      try {
        const parsed = JSON.parse(raw) as MessageOutboxEntry[];
        if (!Array.isArray(parsed)) return;
        outboxRef.current = parsed.filter((entry) => entry?.ownerUserId === serverUserId && entry.chatId && entry.localId);
        void flushOutboxRef.current();
      } catch {
        // A corrupt queue must not block new sends.
      }
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [serverUserId]);

  const scheduledRequest = useCallback(async <T,>(
    path: string,
    init?: RequestInit,
  ): Promise<T> => {
    const res = await fetch(`${getApiBase()}/scheduled-messages${path}`, {
      ...init,
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(await getAuthHeaders()),
        ...init?.headers,
      },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(data.error ?? "Scheduled message request failed");
    }
    return (res.status === 204 ? undefined : await res.json()) as T;
  }, []);

  const listScheduledMessages = useCallback(async () => {
    const data = await scheduledRequest<{ scheduledMessages: ScheduledMessage[] }>("");
    return data.scheduledMessages;
  }, [scheduledRequest]);

  const createScheduledMessage = useCallback(
    (input: { chatId: string; text: string; scheduledFor: number; approvalReminderMinutes?: number | null }) =>
      scheduledRequest<ScheduledMessage>("", { method: "POST", body: JSON.stringify(input) }),
    [scheduledRequest],
  );

  const updateScheduledMessage = useCallback(
    (id: string, input: { text?: string; scheduledFor?: number; approvalReminderMinutes?: number | null }) =>
      scheduledRequest<ScheduledMessage>(`/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    [scheduledRequest],
  );

  const cancelScheduledMessage = useCallback(
    (id: string) => scheduledRequest<void>(`/${id}`, { method: "DELETE" }),
    [scheduledRequest],
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

  const checkinRequest = useCallback(async <T,>(
    path: string,
    init?: RequestInit,
  ): Promise<T> => {
    const res = await fetch(`${getApiBase()}/checkins${path}`, {
      ...init,
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(await getAuthHeaders()),
        ...init?.headers,
      },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(data.error ?? "Check-in request failed");
    }
    return (res.status === 204 ? undefined : await res.json()) as T;
  }, []);

  const fetchCheckInGroups = useCallback(async (): Promise<CheckInFetchResult<ServerCheckInGroup[]>> => {
    try {
      const data = await checkinRequest<{ groups: ServerCheckInGroup[] }>("/groups");
      return { ok: true, data: data.groups ?? [] };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Unable to fetch check-in groups" };
    }
  }, [checkinRequest]);

  const fetchCheckInBroadcasts = useCallback(async (): Promise<CheckInFetchResult<ServerCheckInBroadcast[]>> => {
    try {
      const data = await checkinRequest<{ broadcasts: ServerCheckInBroadcast[] }>("/broadcasts");
      return { ok: true, data: data.broadcasts ?? [] };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Unable to fetch check-in broadcasts" };
    }
  }, [checkinRequest]);

  const markCheckInBroadcastsRead = useCallback(async (broadcastId: string): Promise<void> => {
    await checkinRequest(`/broadcasts/${broadcastId}/read`, { method: "POST" });
  }, [checkinRequest]);

  const createCheckInGroup = useCallback(async (input: {
    name: string;
    memberIds: string[];
    anonymous?: boolean;
    description?: string;
  }): Promise<ServerCheckInGroup | null> => {
    try {
      const data = await checkinRequest<{ group: ServerCheckInGroup }>("/groups", {
        method: "POST",
        body: JSON.stringify(input),
      });
      return data.group ?? null;
    } catch {
      return null;
    }
  }, [checkinRequest]);

  const sendCheckinBroadcast = useCallback((input: {
    groupId: string;
    text: string;
    audioAttachment?: unknown;
    deadline?: number;
    clientId?: string;
  }): Promise<ServerCheckInBroadcast> => {
    const socket = socketRef.current;
    if (!socket?.connected) return Promise.reject(new Error("Check-in socket is disconnected"));
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (callback: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        socket.off("disconnect", onDisconnect);
        callback();
      };
      const onDisconnect = () => finish(() => reject(new Error("Check-in socket disconnected")));
      const timeout = setTimeout(
        () => finish(() => reject(new Error("Check-in broadcast acknowledgement timed out"))),
        10000,
      );
      socket.once("disconnect", onDisconnect);
      socket.emit("checkin:send", input, (result: {
        ok: boolean;
        broadcast?: ServerCheckInBroadcast;
        error?: string;
      }) => {
        if (result?.ok && result.broadcast) {
          finish(() => resolve(result.broadcast!));
        } else {
          finish(() => reject(new Error(result?.error ?? "Check-in broadcast failed")));
        }
      });
    });
  }, []);

  const replyToCheckin = useCallback((input: {
    broadcastId: string;
    text: string;
    audioAttachment?: unknown;
    clientId?: string;
  }): Promise<ServerCheckInReply> => {
    const socket = socketRef.current;
    if (!socket?.connected) return Promise.reject(new Error("Check-in socket is disconnected"));
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (callback: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        socket.off("disconnect", onDisconnect);
        callback();
      };
      const onDisconnect = () => finish(() => reject(new Error("Check-in socket disconnected")));
      const timeout = setTimeout(
        () => finish(() => reject(new Error("Check-in reply acknowledgement timed out"))),
        10000,
      );
      socket.once("disconnect", onDisconnect);
      socket.emit("checkin:reply", input, (result: {
        ok: boolean;
        reply?: ServerCheckInReply;
        error?: string;
      }) => {
        if (result?.ok && result.reply) {
          finish(() => resolve(result.reply!));
        } else {
          finish(() => reject(new Error(result?.error ?? "Check-in reply failed")));
        }
      });
    });
  }, []);

  const onCheckinBroadcast = useCallback((handler: CheckinBroadcastHandler) => {
    checkinBroadcastHandlers.current.add(handler);
    return () => { checkinBroadcastHandlers.current.delete(handler); };
  }, []);
  const onCheckinReply = useCallback((handler: CheckinReplyHandler) => {
    checkinReplyHandlers.current.add(handler);
    return () => { checkinReplyHandlers.current.delete(handler); };
  }, []);
  const onCheckinProgress = useCallback((handler: CheckinProgressHandler) => {
    checkinProgressHandlers.current.add(handler);
    return () => { checkinProgressHandlers.current.delete(handler); };
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

  const postMessageReaction = useCallback(
    async (chatId: string, messageId: string, emoji: string): Promise<MessageReactionEvent | null> => {
      try {
        const res = await fetch(
          `${getApiBase()}/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}/reactions`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
            body: JSON.stringify({ emoji }),
          },
        );
        if (!res.ok) return null;
        const data = await res.json() as MessageReactionEvent;
        if (!data || typeof data.messageId !== "string" || typeof data.chatId !== "string") return null;
        return data;
      } catch (error) {
        console.warn("[ServerContext] postMessageReaction error:", error);
        return null;
      }
    },
    [],
  );

  const onMessageReaction = useCallback((handler: MessageReactionHandler) => {
    reactionHandlers.current.add(handler);
    return () => { reactionHandlers.current.delete(handler); };
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

  const exportServerChat = useCallback(async (chatId: string) => {
    try {
      const res = await fetch(`${getApiBase()}/chats/${encodeURIComponent(chatId)}/export`, {
        headers: await getAuthHeaders(),
      });
      if (!res.ok) return null;
      const data = await res.json() as {
        chatName?: string | null;
        messages?: Array<{ id: string; senderId: string; senderName: string; text: string; type: string; createdAt: number }>;
      };
      return { chatName: data.chatName ?? null, messages: data.messages ?? [] };
    } catch {
      return null;
    }
  }, []);

  const summarizeChatForExport = useCallback(async (opts: {
    chatName?: string;
    format: "summary" | "bullets";
    messages: Array<{ senderName?: string; text: string; timestamp?: number }>;
  }) => {
    try {
      const res = await fetch(`${getApiBase()}/chat-export-summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
        body: JSON.stringify(opts),
      });
      if (!res.ok) return null;
      const data = await res.json() as { appendix?: string; sourceTruncated?: boolean };
      return data.appendix ? { appendix: data.appendix, sourceTruncated: !!data.sourceTruncated } : null;
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
        requestRecoveryEmail,
        fetchRecoveryEmail,
        updateRecoveryEmail,
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
        postMessageReaction,
        onMessageReaction,
        listScheduledMessages,
        createScheduledMessage,
        updateScheduledMessage,
        cancelScheduledMessage,
        fetchUserChats,
        fetchCheckInGroups,
        fetchCheckInBroadcasts,
         markCheckInBroadcastsRead,
        createCheckInGroup,
        sendCheckinBroadcast,
        replyToCheckin,
        onCheckinBroadcast,
        onCheckinReply,
        onCheckinProgress,
        onNewMessage,
        emitTyping,
        onTyping,
        emitChatRead,
        onReadReceipt,
        translateMessage,
        getSuggestedReply,
        exportServerChatAsText,
        exportServerChat,
        summarizeChatForExport,
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

/**
 * Re-read the auth token from AsyncStorage, falling back to the SecureStore
 * recovery identity. When `rejectedToken` is given (REST 401), a different
 * stored copy is preferred. Restores AsyncStorage from SecureStore if missing.
 */
async function rehydrateAuthToken(rejectedToken: string | null = null): Promise<string | null> {
  const localToken = await AsyncStorage.getItem(SERVER_TOKEN_KEY).catch(() => null);
  const secureIdentity = Platform.OS === "web"
    ? null
    : await SecureStore.getItemAsync(SECURE_SERVER_IDENTITY_KEY).catch(() => null);
  const token = pickRehydratedAuthToken(localToken, secureIdentity, rejectedToken);
  if (token) {
    cachedAuthToken = token;
    if (token !== localToken) {
      await AsyncStorage.setItem(SERVER_TOKEN_KEY, token).catch(() => {});
    }
  }
  return token;
}

/** Auth headers for server requests that require a proven identity. */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  if (!cachedAuthToken) {
    await rehydrateAuthToken();
  }
  return cachedAuthToken ? { "X-Auth-Token": cachedAuthToken } : {};
}
