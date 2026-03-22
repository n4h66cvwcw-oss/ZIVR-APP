import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "vibeMsg_contactGroups";

export type ContactGroup = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  chatIds: string[];
  createdAt: number;
};

const DEFAULT_GROUPS: ContactGroup[] = [
  { id: "g_family",       name: "Family",        emoji: "👨‍👩‍👧",  color: "#30D158", chatIds: [], createdAt: Date.now() },
  { id: "g_close",        name: "Close Friends",  emoji: "❤️",    color: "#FF375F", chatIds: [], createdAt: Date.now() },
  { id: "g_work",         name: "Work",           emoji: "💼",    color: "#0A84FF", chatIds: [], createdAt: Date.now() },
  { id: "g_employees",    name: "Employees",      emoji: "👥",    color: "#BF5AF2", chatIds: [], createdAt: Date.now() },
];

function uid() {
  return "g_" + Math.random().toString(36).slice(2, 10);
}

export function useContactGroups() {
  const [groups, setGroups] = useState<ContactGroup[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          setGroups(JSON.parse(raw));
        } else {
          setGroups(DEFAULT_GROUPS);
          AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_GROUPS)).catch(() => {});
        }
      })
      .catch(() => setGroups(DEFAULT_GROUPS))
      .finally(() => setLoaded(true));
  }, []);

  const persist = useCallback((next: ContactGroup[]) => {
    setGroups(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const createGroup = useCallback((name: string, emoji: string, color: string) => {
    const group: ContactGroup = { id: uid(), name, emoji, color, chatIds: [], createdAt: Date.now() };
    setGroups((prev) => {
      const next = [...prev, group];
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
    return group.id;
  }, []);

  const updateGroup = useCallback((id: string, patch: Partial<Omit<ContactGroup, "id" | "createdAt">>) => {
    setGroups((prev) => {
      const next = prev.map((g) => (g.id === id ? { ...g, ...patch } : g));
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const deleteGroup = useCallback((id: string) => {
    setGroups((prev) => {
      const next = prev.filter((g) => g.id !== id);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const toggleChatInGroup = useCallback((groupId: string, chatId: string) => {
    setGroups((prev) => {
      const next = prev.map((g) => {
        if (g.id !== groupId) return g;
        const already = g.chatIds.includes(chatId);
        return { ...g, chatIds: already ? g.chatIds.filter((id) => id !== chatId) : [...g.chatIds, chatId] };
      });
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const setChatIds = useCallback((groupId: string, chatIds: string[]) => {
    setGroups((prev) => {
      const next = prev.map((g) => (g.id === groupId ? { ...g, chatIds } : g));
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const getGroupsForChat = useCallback(
    (chatId: string) => groups.filter((g) => g.chatIds.includes(chatId)),
    [groups]
  );

  return { groups, loaded, createGroup, updateGroup, deleteGroup, toggleChatInGroup, setChatIds, getGroupsForChat };
}
