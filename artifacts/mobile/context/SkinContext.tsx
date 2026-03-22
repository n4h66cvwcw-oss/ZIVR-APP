import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type BubbleShape = "rounded" | "pill" | "sharp";

export type SkinTheme = {
  id: string;
  name: string;
  description: string;
  emoji: string;
  price: number;
  category: string;
  creator: "official" | "ai";
  tags: string[];
  sentBubble: [string, string];
  receivedBubble: string;
  chatBackground: [string, string];
  accentColor: string;
  textOnSent: string;
  textOnReceived: string;
  bubbleShape: BubbleShape;
  glowColor?: string | null;
  owned?: boolean;
  isNew?: boolean;
};

export const OFFICIAL_SKINS: SkinTheme[] = [
  {
    id: "default",
    name: "VibeMsg Default",
    description: "The classic VibeMsg blue. Clean, sharp, reliable.",
    emoji: "💬",
    price: 0,
    category: "minimal",
    creator: "official",
    tags: ["classic", "blue", "default"],
    sentBubble: ["#0A84FF", "#0066CC"],
    receivedBubble: "#E5E5EA",
    chatBackground: ["#F2F2F7", "#E5E5EA"],
    accentColor: "#0A84FF",
    textOnSent: "#FFFFFF",
    textOnReceived: "#1C1C1E",
    bubbleShape: "rounded",
    glowColor: null,
    owned: true,
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "Deep indigo darkness. For those late-night conversations.",
    emoji: "🌙",
    price: 0,
    category: "minimal",
    creator: "official",
    tags: ["dark", "purple", "night"],
    sentBubble: ["#5E5CE6", "#3A38A8"],
    receivedBubble: "#2C2C3E",
    chatBackground: ["#0D0D1A", "#1A1A2E"],
    accentColor: "#BF5AF2",
    textOnSent: "#FFFFFF",
    textOnReceived: "#E0E0FF",
    bubbleShape: "rounded",
    glowColor: "#5E5CE644",
    owned: true,
  },
  {
    id: "sunset",
    name: "Sunset Drive",
    description: "Warm orange-to-pink horizon. Golden hour energy all day.",
    emoji: "🌅",
    price: 199,
    category: "nature",
    creator: "official",
    tags: ["warm", "orange", "pink", "sunset"],
    sentBubble: ["#FF6B35", "#FF2D55"],
    receivedBubble: "#FFF0E8",
    chatBackground: ["#FF9500", "#FF2D55"],
    accentColor: "#FF6B35",
    textOnSent: "#FFFFFF",
    textOnReceived: "#3D1A0A",
    bubbleShape: "rounded",
    glowColor: "#FF6B3555",
    isNew: false,
  },
  {
    id: "forest",
    name: "Deep Forest",
    description: "Lush greens and earthy tones. Breathe in the nature.",
    emoji: "🌲",
    price: 199,
    category: "nature",
    creator: "official",
    tags: ["green", "nature", "earth"],
    sentBubble: ["#32D74B", "#1A8A2A"],
    receivedBubble: "#E8F5E9",
    chatBackground: ["#1B4332", "#2D6A4F"],
    accentColor: "#32D74B",
    textOnSent: "#FFFFFF",
    textOnReceived: "#1B4332",
    bubbleShape: "rounded",
    glowColor: "#32D74B33",
  },
  {
    id: "galaxy",
    name: "Galaxy Brain",
    description: "Deep space vibes. Nebula gradients and cosmic accents.",
    emoji: "🌌",
    price: 299,
    category: "space",
    creator: "official",
    tags: ["space", "dark", "purple", "cosmic"],
    sentBubble: ["#BF5AF2", "#9D4EDD"],
    receivedBubble: "#1A0A2E",
    chatBackground: ["#03001C", "#1A0A2E"],
    accentColor: "#64D2FF",
    textOnSent: "#FFFFFF",
    textOnReceived: "#E0CCFF",
    bubbleShape: "rounded",
    glowColor: "#BF5AF255",
    isNew: true,
  },
  {
    id: "gold-rush",
    name: "Gold Rush",
    description: "Premium gold and champagne. Because you deserve the best.",
    emoji: "🏆",
    price: 299,
    category: "luxury",
    creator: "official",
    tags: ["gold", "luxury", "premium"],
    sentBubble: ["#D4AF37", "#B8860B"],
    receivedBubble: "#FFF8E7",
    chatBackground: ["#1A1200", "#2D2000"],
    accentColor: "#FFD60A",
    textOnSent: "#1A1200",
    textOnReceived: "#2D2000",
    bubbleShape: "rounded",
    glowColor: "#D4AF3766",
  },
  {
    id: "retro-wave",
    name: "Retro Wave",
    description: "80s synth vibes. Hot pink, electric blue, grid lines.",
    emoji: "🕹️",
    price: 199,
    category: "retro",
    creator: "official",
    tags: ["retro", "80s", "neon", "pink"],
    sentBubble: ["#FF2D85", "#C9006B"],
    receivedBubble: "#1A0030",
    chatBackground: ["#0D0025", "#1A0035"],
    accentColor: "#00F5FF",
    textOnSent: "#FFFFFF",
    textOnReceived: "#FF9FE5",
    bubbleShape: "sharp",
    glowColor: "#FF2D8566",
    isNew: true,
  },
  {
    id: "barry-bonds",
    name: "Barry Bonds HR King",
    description:
      "SF Giants black & orange. 762 home runs of pure swagger. The GOAT speaks through your messages.",
    emoji: "⚾",
    price: 0,
    category: "sports",
    creator: "ai",
    tags: ["baseball", "giants", "sports", "sf", "bonds"],
    sentBubble: ["#FD5A1E", "#E8490C"],
    receivedBubble: "#1D1D1D",
    chatBackground: ["#0A0A0A", "#1D1D1D"],
    accentColor: "#FD5A1E",
    textOnSent: "#FFFFFF",
    textOnReceived: "#FD5A1E",
    bubbleShape: "rounded",
    glowColor: "#FD5A1E44",
    owned: true,
    isNew: true,
  },
];

const STORAGE_KEYS = {
  owned: "vibemsg_owned_skins",
  active: "vibemsg_active_skin",
  ai: "vibemsg_ai_skins",
  balance: "vibemsg_coin_balance",
};

const FREE_SKIN_IDS = new Set(
  OFFICIAL_SKINS.filter((s) => s.price === 0).map((s) => s.id)
);

type SkinContextValue = {
  activeSkin: SkinTheme;
  ownedIds: Set<string>;
  aiSkins: SkinTheme[];
  coinBalance: number;
  applySkin: (id: string) => void;
  purchaseSkin: (skin: SkinTheme) => Promise<{ success: boolean; message: string }>;
  generateSkin: (prompt: string) => Promise<SkinTheme | null>;
  isGenerating: boolean;
  generationError: string | null;
  allSkins: SkinTheme[];
};

const SkinContext = createContext<SkinContextValue | null>(null);

export function useSkin() {
  const ctx = useContext(SkinContext);
  if (!ctx) throw new Error("useSkin must be used within SkinProvider");
  return ctx;
}

export function SkinProvider({ children }: { children: React.ReactNode }) {
  const [activeId, setActiveId] = useState("default");
  const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set(FREE_SKIN_IDS));
  const [aiSkins, setAiSkins] = useState<SkinTheme[]>([]);
  const [coinBalance, setCoinBalance] = useState(500);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [ownedRaw, activeRaw, aiRaw, balanceRaw] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.owned),
          AsyncStorage.getItem(STORAGE_KEYS.active),
          AsyncStorage.getItem(STORAGE_KEYS.ai),
          AsyncStorage.getItem(STORAGE_KEYS.balance),
        ]);
        if (ownedRaw) setOwnedIds(new Set([...FREE_SKIN_IDS, ...JSON.parse(ownedRaw)]));
        if (activeRaw) setActiveId(activeRaw);
        if (aiRaw) setAiSkins(JSON.parse(aiRaw));
        if (balanceRaw) setCoinBalance(Number(balanceRaw));
      } catch {}
    };
    load();
  }, []);

  const allSkins = useMemo(
    () => [...OFFICIAL_SKINS, ...aiSkins],
    [aiSkins]
  );

  const activeSkin = useMemo(
    () => allSkins.find((s) => s.id === activeId) ?? OFFICIAL_SKINS[0],
    [allSkins, activeId]
  );

  const applySkin = useCallback(
    async (id: string) => {
      setActiveId(id);
      await AsyncStorage.setItem(STORAGE_KEYS.active, id);
    },
    []
  );

  const purchaseSkin = useCallback(
    async (skin: SkinTheme): Promise<{ success: boolean; message: string }> => {
      if (ownedIds.has(skin.id)) return { success: true, message: "Already owned" };

      const priceCents = skin.price;
      const priceCoins = Math.ceil(priceCents / 10);

      if (coinBalance < priceCoins) {
        return { success: false, message: "Not enough VibeCoins" };
      }

      const newBalance = coinBalance - priceCoins;
      const newOwned = new Set([...ownedIds, skin.id]);
      setCoinBalance(newBalance);
      setOwnedIds(newOwned);

      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.balance, String(newBalance)),
        AsyncStorage.setItem(
          STORAGE_KEYS.owned,
          JSON.stringify([...newOwned].filter((id) => !FREE_SKIN_IDS.has(id)))
        ),
      ]);

      return { success: true, message: `${skin.name} unlocked!` };
    },
    [ownedIds, coinBalance]
  );

  const generateSkin = useCallback(async (prompt: string): Promise<SkinTheme | null> => {
    setIsGenerating(true);
    setGenerationError(null);
    try {
      const domain = process.env["EXPO_PUBLIC_DOMAIN"];
      const baseUrl = domain
        ? `https://${domain}/api-server`
        : "http://localhost:3001";

      const res = await fetch(`${baseUrl}/api/skins/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = (await res.json()) as { skin: SkinTheme };
      const newSkin: SkinTheme = {
        ...data.skin,
        creator: "ai",
        price: 0,
        owned: true,
      };

      const updated = [...aiSkins, newSkin];
      setAiSkins(updated);
      await AsyncStorage.setItem(STORAGE_KEYS.ai, JSON.stringify(updated));
      return newSkin;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setGenerationError(msg);
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [aiSkins]);

  const value = useMemo(
    () => ({
      activeSkin,
      ownedIds,
      aiSkins,
      coinBalance,
      applySkin,
      purchaseSkin,
      generateSkin,
      isGenerating,
      generationError,
      allSkins,
    }),
    [activeSkin, ownedIds, aiSkins, coinBalance, applySkin, purchaseSkin, generateSkin, isGenerating, generationError, allSkins]
  );

  return <SkinContext.Provider value={value}>{children}</SkinContext.Provider>;
}
