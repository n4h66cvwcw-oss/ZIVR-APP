import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAuthHeaders } from "@/context/ServerContext";

export type ChildAccount = {
  id: string;
  displayName: string;
  username: string | null;
  avatar: string | null;
  isOnline: boolean;
  lastSeen: number;
  unflaggedCount: number;
};

export type TimeRestriction = {
  enabled: boolean;
  startHour: number;
  endHour: number;
  days: string; // comma-separated: mon,tue,wed,thu,fri,sat,sun
  overrideUntil?: number | null;
};

export type ContactApproval = {
  contactId: string;
  displayName: string;
  username: string | null;
  avatar: string | null;
  status: "pending" | "approved" | "blocked";
  requestedAt: number;
};

export type ContentFlag = {
  id: string;
  flaggedText: string;
  severity: "low" | "medium" | "high";
  aiReason: string | null;
  isReviewed: boolean;
  createdAt: number;
  senderName: string | null;
  chatId: string | null;
};

export type ContentAlertThreshold = "all" | "medium" | "high";

interface ParentalContextValue {
  isParentMode: boolean;
  parentUserId: string | null;
  setParentMode: (enabled: boolean, userId?: string) => Promise<void>;

  loadAlertPreference: () => Promise<ContentAlertThreshold>;
  updateAlertPreference: (minimumSeverity: ContentAlertThreshold) => Promise<void>;

  children: ChildAccount[];
  loadChildren: () => Promise<void>;

  createChildAccount: (opts: {
    displayName: string;
    username?: string;
  }) => Promise<string | null>;

  loadChildDetail: (childId: string) => Promise<{ child: ChildAccount; timeRestriction: TimeRestriction } | null>;

  updateTimeRestrictions: (childId: string, restriction: TimeRestriction) => Promise<void>;
  grantTimeOverride: (childId: string, durationHours: 1 | 2) => Promise<number>;
  endTimeOverride: (childId: string) => Promise<void>;

  /** Auth token for a child created on this device (parent-mediated bootstrap). */
  getChildToken: (childId: string) => Promise<string | null>;

  loadContacts: (childId: string) => Promise<ContactApproval[]>;
  updateContactStatus: (childId: string, contactId: string, status: "approved" | "blocked") => Promise<void>;

  loadFlags: (childId: string, reviewed?: boolean) => Promise<ContentFlag[]>;
  markFlagReviewed: (childId: string, flagId: string) => Promise<void>;

  // For child accounts: check access (fail-open, safe for dashboards)
  checkAccess: (childId: string) => Promise<{
    allowed: boolean;
    startHour?: number;
    endHour?: number;
    overrideUntil?: number | null;
    overrideRemainingMs?: number | null;
  }>;

  /**
   * Like checkAccess but throws on network/auth error instead of defaulting to
   * allowed.  Use this wherever failing silently would be a security issue (e.g.
   * the time-lock gate on app launch).
   */
  checkAccessStrict: (childId: string) => Promise<{
    allowed: boolean;
    startHour?: number;
    endHour?: number;
    overrideUntil?: number | null;
    overrideRemainingMs?: number | null;
  }>;
}

const ParentalContext = createContext<ParentalContextValue | null>(null);

const PARENT_MODE_KEY = "@zivr_parent_mode";
const CHILD_TOKENS_KEY = "@zivr_child_auth_tokens";
const PARENT_USER_KEY = "@zivr_parent_user_id";

const PRODUCTION_API = "https://echo-stream.replit.app/api";

function getApiBase(): string {
  const override = process.env["EXPO_PUBLIC_API_URL"];
  if (override) return override;
  const domain = process.env["EXPO_PUBLIC_DOMAIN"];
  if (domain) return `https://${domain}/api`;
  return PRODUCTION_API;
}

async function apiCall<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(await getAuthHeaders()),
      ...(options?.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function ParentalProvider({ children: reactChildren }: { children: React.ReactNode }) {
  const [isParentMode, setIsParentMode] = useState(false);
  const [parentUserId, setParentUserId] = useState<string | null>(null);
  const [children, setChildren] = useState<ChildAccount[]>([]);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(PARENT_MODE_KEY),
      AsyncStorage.getItem(PARENT_USER_KEY),
    ]).then(([mode, uid]) => {
      if (mode === "true") setIsParentMode(true);
      if (uid) setParentUserId(uid);
    });
  }, []);

  const setParentMode = useCallback(async (enabled: boolean, userId?: string) => {
    setIsParentMode(enabled);
    await AsyncStorage.setItem(PARENT_MODE_KEY, String(enabled));
    if (userId) {
      setParentUserId(userId);
      await AsyncStorage.setItem(PARENT_USER_KEY, userId);
    }
  }, []);

  const loadAlertPreference = useCallback(async (): Promise<ContentAlertThreshold> => {
    try {
      const data = await apiCall<{ minimumSeverity: ContentAlertThreshold }>(
        "/parental/alert-preferences"
      );
      return data.minimumSeverity;
    } catch (err) {
      console.warn("[parental] loadAlertPreference error", err);
      return "medium";
    }
  }, []);

  const updateAlertPreference = useCallback(async (
    minimumSeverity: ContentAlertThreshold
  ): Promise<void> => {
    await apiCall("/parental/alert-preferences", {
      method: "PUT",
      body: JSON.stringify({ minimumSeverity }),
    });
  }, []);

  const loadChildren = useCallback(async () => {
    if (!parentUserId) return;
    try {
      const data = await apiCall<{ children: ChildAccount[] }>(
        `/parental/children?parentId=${parentUserId}`
      );
      setChildren(data.children);
    } catch (err) {
      console.warn("[parental] loadChildren error", err);
    }
  }, [parentUserId]);

  const createChildAccount = useCallback(async (opts: {
    displayName: string;
    username?: string;
  }): Promise<string | null> => {
    if (!parentUserId) return null;
    try {
      const data = await apiCall<{ child: { id: string; authToken?: string } }>("/parental/children", {
        method: "POST",
        body: JSON.stringify({ parentId: parentUserId, ...opts }),
      });
      // Parent-mediated bootstrap: keep the child's auth token so the child
      // profile on this device can act as the child account.
      if (data.child.authToken) {
        try {
          const raw = await AsyncStorage.getItem(CHILD_TOKENS_KEY);
          const map = raw ? JSON.parse(raw) as Record<string, string> : {};
          map[data.child.id] = data.child.authToken;
          await AsyncStorage.setItem(CHILD_TOKENS_KEY, JSON.stringify(map));
        } catch { /* non-fatal */ }
      }
      await loadChildren();
      return data.child.id;
    } catch (err) {
      console.warn("[parental] createChildAccount error", err);
      return null;
    }
  }, [parentUserId, loadChildren]);

  const loadChildDetail = useCallback(async (childId: string) => {
    try {
      return await apiCall<{ child: ChildAccount; timeRestriction: TimeRestriction }>(
        `/parental/children/${childId}`
      );
    } catch {
      return null;
    }
  }, []);

  const updateTimeRestrictions = useCallback(async (childId: string, restriction: TimeRestriction) => {
    await apiCall(`/parental/children/${childId}/time-restrictions`, {
      method: "PUT",
      body: JSON.stringify(restriction),
    });
  }, []);

  const grantTimeOverride = useCallback(async (childId: string, durationHours: 1 | 2): Promise<number> => {
    const data = await apiCall<{ ok: true; overrideUntil: number }>(
      `/parental/children/${childId}/override`,
      {
        method: "PUT",
        body: JSON.stringify({ durationHours }),
      }
    );
    return data.overrideUntil;
  }, []);

  const endTimeOverride = useCallback(async (childId: string): Promise<void> => {
    await apiCall(`/parental/children/${childId}/override`, {
      method: "DELETE",
    });
  }, []);

  const getChildToken = useCallback(async (childId: string): Promise<string | null> => {
    try {
      const raw = await AsyncStorage.getItem(CHILD_TOKENS_KEY);
      const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
      if (map[childId]) return map[childId];
      // Fallback: recover the child's credential as the authenticated parent
      const data = await apiCall<{ authToken: string }>(`/parental/children/${childId}/token`, {
        method: "POST",
      });
      if (data.authToken) {
        map[childId] = data.authToken;
        await AsyncStorage.setItem(CHILD_TOKENS_KEY, JSON.stringify(map));
        return data.authToken;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const loadContacts = useCallback(async (childId: string): Promise<ContactApproval[]> => {
    try {
      const data = await apiCall<{ contacts: ContactApproval[] }>(
        `/parental/children/${childId}/contacts`
      );
      return data.contacts;
    } catch {
      return [];
    }
  }, []);

  const updateContactStatus = useCallback(async (
    childId: string,
    contactId: string,
    status: "approved" | "blocked"
  ) => {
    await apiCall(`/parental/children/${childId}/contacts/${contactId}`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    });
  }, []);

  const loadFlags = useCallback(async (childId: string, reviewed?: boolean): Promise<ContentFlag[]> => {
    try {
      const qs = reviewed !== undefined ? `?reviewed=${reviewed}` : "";
      const data = await apiCall<{ flags: ContentFlag[] }>(
        `/parental/children/${childId}/flags${qs}`
      );
      return data.flags;
    } catch {
      return [];
    }
  }, []);

  const markFlagReviewed = useCallback(async (childId: string, flagId: string) => {
    await apiCall(`/parental/children/${childId}/flags/${flagId}`, {
      method: "PATCH",
    });
  }, []);

  const checkAccess = useCallback(async (childId: string) => {
    try {
      return await apiCall<{
        allowed: boolean;
        startHour?: number;
        endHour?: number;
        overrideUntil?: number | null;
        overrideRemainingMs?: number | null;
      }>(
        `/parental/check-access/${childId}`
      );
    } catch {
      return { allowed: true };
    }
  }, []);

  const checkAccessStrict = useCallback(async (childId: string) => {
    // Intentionally does NOT catch — callers must handle errors themselves.
    return apiCall<{
      allowed: boolean;
      startHour?: number;
      endHour?: number;
      overrideUntil?: number | null;
      overrideRemainingMs?: number | null;
    }>(
      `/parental/check-access/${childId}`
    );
  }, []);

  return (
    <ParentalContext.Provider value={{
      isParentMode,
      parentUserId,
      setParentMode,
      loadAlertPreference,
      updateAlertPreference,
      children,
      loadChildren,
      createChildAccount,
      loadChildDetail,
      updateTimeRestrictions,
      grantTimeOverride,
      endTimeOverride,
      getChildToken,
      loadContacts,
      updateContactStatus,
      loadFlags,
      markFlagReviewed,
      checkAccess,
      checkAccessStrict,
    }}>
      {reactChildren}
    </ParentalContext.Provider>
  );
}

export function useParental() {
  const ctx = useContext(ParentalContext);
  if (!ctx) throw new Error("useParental must be used inside ParentalProvider");
  return ctx;
}
