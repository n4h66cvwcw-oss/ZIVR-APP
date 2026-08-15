import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Types ────────────────────────────────────────────────────────────────────

export type FavoriteType = "contact" | "chat" | "message";

export type FavoriteItem = {
  id: string;                    // unique favorite id (UUID-ish)
  type: FavoriteType;
  name: string;
  avatar?: string;
  groupId?: string;              // assigned favorite group
  addedAt: number;
  // type-specific
  userId?: string;               // for contact favorites
  chatId?: string;               // for chat or message favorites
  messageId?: string;            // for message favorites
  messagePreview?: string;       // snippet shown in strip
};

export type FavoriteGroup = {
  id: string;
  name: string;
  emoji: string;
  color: string;
};

const DEFAULT_GROUPS: FavoriteGroup[] = [
  { id: "family",  name: "Family",  emoji: "🏠", color: "#FF6B6B" },
  { id: "work",    name: "Work",    emoji: "💼", color: "#4ECDC4" },
  { id: "friends", name: "Friends", emoji: "🎉", color: "#45B7D1" },
  { id: "vip",     name: "VIP",     emoji: "⭐", color: "#FFD93D" },
];

// ─── Context ──────────────────────────────────────────────────────────────────

interface FavoritesContextValue {
  favorites: FavoriteItem[];
  groups: FavoriteGroup[];
  isExpanded: boolean;
  activeGroupFilter: string | null;

  toggleExpanded: () => void;
  setActiveGroupFilter: (groupId: string | null) => void;

  addFavorite: (item: Omit<FavoriteItem, "id" | "addedAt">) => void;
  removeFavorite: (favoriteId: string) => void;
  isFavorited: (chatId?: string, userId?: string, messageId?: string) => boolean;
  assignGroup: (favoriteId: string, groupId: string | undefined) => void;

  addGroup: (name: string, emoji: string, color: string) => void;
  removeGroup: (groupId: string) => void;

  // Filtered view helpers
  filteredFavorites: FavoriteItem[];
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

const STORAGE_KEYS = {
  FAVORITES: "@zivr_favorites",
  GROUPS: "@zivr_fav_groups",
  EXPANDED: "@zivr_fav_expanded",
};

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [groups, setGroups] = useState<FavoriteGroup[]>(DEFAULT_GROUPS);
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeGroupFilter, setActiveGroupFilter] = useState<string | null>(null);

  // Load persisted state
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.FAVORITES),
      AsyncStorage.getItem(STORAGE_KEYS.GROUPS),
      AsyncStorage.getItem(STORAGE_KEYS.EXPANDED),
    ]).then(([favsRaw, groupsRaw, expandedRaw]) => {
      if (favsRaw) {
        try { setFavorites(JSON.parse(favsRaw) as FavoriteItem[]); } catch { /* ignore */ }
      }
      if (groupsRaw) {
        try { setGroups(JSON.parse(groupsRaw) as FavoriteGroup[]); } catch { /* ignore */ }
      }
      if (expandedRaw !== null) {
        setIsExpanded(expandedRaw === "true");
      }
    });
  }, []);

  // Persist on change
  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(groups));
  }, [groups]);

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => {
      const next = !prev;
      AsyncStorage.setItem(STORAGE_KEYS.EXPANDED, String(next));
      return next;
    });
  }, []);

  const addFavorite = useCallback((item: Omit<FavoriteItem, "id" | "addedAt">) => {
    setFavorites((prev) => {
      // Prevent duplicates
      const exists = prev.some(
        (f) =>
          (item.userId && f.userId === item.userId) ||
          (item.chatId && !item.messageId && f.chatId === item.chatId && !f.messageId) ||
          (item.messageId && f.messageId === item.messageId)
      );
      if (exists) return prev;
      return [{ ...item, id: uid(), addedAt: Date.now() }, ...prev];
    });
  }, []);

  const removeFavorite = useCallback((favoriteId: string) => {
    setFavorites((prev) => prev.filter((f) => f.id !== favoriteId));
  }, []);

  const isFavorited = useCallback(
    (chatId?: string, userId?: string, messageId?: string) => {
      return favorites.some(
        (f) =>
          (userId && f.userId === userId) ||
          (messageId && f.messageId === messageId) ||
          (chatId && !messageId && f.chatId === chatId && !f.messageId)
      );
    },
    [favorites]
  );

  const assignGroup = useCallback((favoriteId: string, groupId: string | undefined) => {
    setFavorites((prev) =>
      prev.map((f) => (f.id === favoriteId ? { ...f, groupId } : f))
    );
  }, []);

  const addGroup = useCallback((name: string, emoji: string, color: string) => {
    const newGroup: FavoriteGroup = { id: uid(), name, emoji, color };
    setGroups((prev) => [...prev, newGroup]);
  }, []);

  const removeGroup = useCallback((groupId: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    // Remove group assignment from items
    setFavorites((prev) =>
      prev.map((f) => (f.groupId === groupId ? { ...f, groupId: undefined } : f))
    );
  }, []);

  const filteredFavorites = activeGroupFilter
    ? favorites.filter((f) => f.groupId === activeGroupFilter)
    : favorites;

  return (
    <FavoritesContext.Provider
      value={{
        favorites,
        groups,
        isExpanded,
        activeGroupFilter,
        toggleExpanded,
        setActiveGroupFilter,
        addFavorite,
        removeFavorite,
        isFavorited,
        assignGroup,
        addGroup,
        removeGroup,
        filteredFavorites,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used inside FavoritesProvider");
  return ctx;
}
