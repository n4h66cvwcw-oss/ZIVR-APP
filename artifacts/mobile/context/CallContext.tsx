import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export type CallType = "voice" | "video";
export type CallStatus =
  | "idle"
  | "outgoing"
  | "incoming"
  | "connecting"
  | "active"
  | "ended";

export type CallRecord = {
  id: string;
  contactId: string;
  contactName: string;
  type: CallType;
  direction: "outgoing" | "incoming";
  status: "answered" | "missed" | "declined";
  startedAt: number;
  duration: number;
};

interface ActiveCall {
  id: string;
  contactId: string;
  contactName: string;
  type: CallType;
  direction: "outgoing" | "incoming";
  status: CallStatus;
  startedAt?: number;
}

interface CallContextValue {
  activeCall: ActiveCall | null;
  callHistory: CallRecord[];
  startCall: (contactId: string, contactName: string, type: CallType) => void;
  answerCall: () => void;
  declineCall: () => void;
  endCall: () => void;
  isMuted: boolean;
  isSpeaker: boolean;
  isVideoOff: boolean;
  isHeld: boolean;
  toggleMute: () => void;
  toggleSpeaker: () => void;
  toggleVideo: () => void;
  toggleHold: () => void;
  clearHistory: () => void;
  missedCount: number;
}

const CallContext = createContext<CallContextValue | null>(null);

const STORAGE_KEY = "@zivr_call_history";

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

export function CallProvider({ children }: { children: React.ReactNode }) {
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [callHistory, setCallHistory] = useState<CallRecord[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isHeld, setIsHeld] = useState(false);
  const connectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const incomingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((s) => {
      if (s) setCallHistory(JSON.parse(s));
    });
    return () => {
      if (connectTimerRef.current) clearTimeout(connectTimerRef.current);
      if (incomingTimerRef.current) clearTimeout(incomingTimerRef.current);
    };
  }, []);

  const saveHistory = useCallback(async (history: CallRecord[]) => {
    setCallHistory(history);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }, []);

  const addRecord = useCallback(
    async (call: ActiveCall, status: "answered" | "missed" | "declined", duration: number) => {
      const record: CallRecord = {
        id: genId(),
        contactId: call.contactId,
        contactName: call.contactName,
        type: call.type,
        direction: call.direction,
        status,
        startedAt: call.startedAt || Date.now(),
        duration,
      };
      const updated = [record, ...callHistory].slice(0, 100);
      await saveHistory(updated);
    },
    [callHistory, saveHistory]
  );

  const startCall = useCallback(
    (contactId: string, contactName: string, type: CallType) => {
      if (activeCall) return;
      const call: ActiveCall = {
        id: genId(),
        contactId,
        contactName,
        type,
        direction: "outgoing",
        status: "outgoing",
      };
      setActiveCall(call);
      setIsMuted(false);
      setIsSpeaker(type === "video");
      setIsVideoOff(false);
      setIsHeld(false);

      connectTimerRef.current = setTimeout(() => {
        setActiveCall((prev) =>
          prev ? { ...prev, status: "active", startedAt: Date.now() } : null
        );
      }, 3000 + Math.random() * 2000);
    },
    [activeCall]
  );

  const answerCall = useCallback(() => {
    setActiveCall((prev) =>
      prev ? { ...prev, status: "active", startedAt: Date.now() } : null
    );
    if (incomingTimerRef.current) clearTimeout(incomingTimerRef.current);
    setIsSpeaker(activeCall?.type === "video");
  }, [activeCall]);

  const declineCall = useCallback(async () => {
    if (incomingTimerRef.current) clearTimeout(incomingTimerRef.current);
    if (activeCall) {
      await addRecord(activeCall, "declined", 0);
      setActiveCall(null);
    }
  }, [activeCall, addRecord]);

  const endCall = useCallback(async () => {
    if (connectTimerRef.current) clearTimeout(connectTimerRef.current);
    if (activeCall) {
      const duration =
        activeCall.startedAt ? Math.floor((Date.now() - activeCall.startedAt) / 1000) : 0;
      const wasAnswered = activeCall.status === "active";
      await addRecord(activeCall, wasAnswered ? "answered" : "missed", duration);
      setActiveCall(null);
    }
  }, [activeCall, addRecord]);

  const toggleMute = useCallback(() => setIsMuted((v) => !v), []);
  const toggleSpeaker = useCallback(() => setIsSpeaker((v) => !v), []);
  const toggleVideo = useCallback(() => setIsVideoOff((v) => !v), []);
  const toggleHold = useCallback(() => setIsHeld((v) => !v), []);
  const clearHistory = useCallback(async () => {
    await saveHistory([]);
  }, [saveHistory]);

  const missedCount = callHistory.filter(
    (r) => r.status === "missed" || (r.status === "declined" && r.direction === "incoming")
  ).length;

  return (
    <CallContext.Provider
      value={{
        activeCall,
        callHistory,
        startCall,
        answerCall,
        declineCall,
        endCall,
        isMuted,
        isSpeaker,
        isVideoOff,
        isHeld,
        toggleMute,
        toggleSpeaker,
        toggleVideo,
        toggleHold,
        clearHistory,
        missedCount,
      }}
    >
      {children}
    </CallContext.Provider>
  );
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCall must be used within CallProvider");
  return ctx;
}
