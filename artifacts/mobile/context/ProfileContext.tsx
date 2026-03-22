import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type CaptureGuardType =
  | "ai_gradient"
  | "custom_image"
  | "custom_text"
  | "custom_sound";

export type AiGradientPreset = {
  id: number;
  name: string;
  colors: string[];
  angle?: number;
};

export const AI_GRADIENTS: AiGradientPreset[] = [
  { id: 1,  name: "Aurora",       colors: ["#0F0C29", "#302B63", "#24243E"] },
  { id: 2,  name: "Sunset Blaze", colors: ["#f953c6", "#b91d73", "#F7971E"] },
  { id: 3,  name: "Ocean Depth",  colors: ["#003973", "#1a6b9a", "#4CA1AF"] },
  { id: 4,  name: "Cosmic Dust",  colors: ["#1a0533", "#6b21a8", "#2563eb"] },
  { id: 5,  name: "Forest Mist",  colors: ["#134E5E", "#71B280", "#29c76f"] },
  { id: 6,  name: "Rose Gold",    colors: ["#b5651d", "#e8b4b8", "#c9a0dc"] },
  { id: 7,  name: "Midnight",     colors: ["#000428", "#004e92", "#141e30"] },
  { id: 8,  name: "Citrus Pop",   colors: ["#f7b733", "#fc4a1a", "#FFD200"] },
  { id: 9,  name: "Ice Cave",     colors: ["#a8edea", "#fed6e3", "#a0c4ff"] },
  { id: 10, name: "Lava Flow",    colors: ["#200122", "#6f0000", "#d63031"] },
  { id: 11, name: "Neon Night",   colors: ["#0f0c29", "#302b63", "#00f2fe"] },
  { id: 12, name: "Mint Fresh",   colors: ["#00b09b", "#96c93d", "#5ee7df"] },
  { id: 13, name: "Berry Swirl",  colors: ["#8e44ad", "#c0392b", "#6c3483"] },
  { id: 14, name: "Solar Flare",  colors: ["#fc466b", "#3f5efb", "#fc466b"] },
  { id: 15, name: "Deep Sea",     colors: ["#0f0c29", "#00b4d8", "#023e8a"] },
  { id: 16, name: "Sakura",       colors: ["#ffd3e8", "#f093fb", "#c471ed"] },
  { id: 17, name: "Thunder",      colors: ["#16213e", "#0f3460", "#533483"] },
  { id: 18, name: "Golden Hour",  colors: ["#f6d365", "#fda085", "#ffeaa7"] },
  { id: 19, name: "Nebula",       colors: ["#43008c", "#7900d4", "#a17fe0"] },
  { id: 20, name: "Arctic",       colors: ["#cfd9df", "#e2ebf0", "#a8c0ff"] },
  { id: 21, name: "Emerald City", colors: ["#11998e", "#38ef7d", "#00b09b"] },
  { id: 22, name: "Crimson Tide", colors: ["#642b73", "#c6426e", "#93291e"] },
  { id: 23, name: "Prism",        colors: ["#f72585", "#7209b7", "#3a0ca3", "#4361ee"] },
  { id: 24, name: "Dusk",         colors: ["#2d3561", "#c05c7e", "#f3826f"] },
  { id: 25, name: "Obsidian",     colors: ["#0d0d0d", "#434343", "#0d0d0d"] },
];

export type ProfileSettings = {
  displayName: string;
  phone?: string;
  username?: string;
  statusMessage: string;
  avatar?: string;
  captureGuardEnabled: boolean;
  captureGuardType: CaptureGuardType;
  captureGuardGradientId: number;
  captureGuardImageUri?: string;
  captureGuardText: string;
  captureGuardSoundUri?: string;
  onboardingComplete: boolean;
};

const DEFAULT_SETTINGS: ProfileSettings = {
  displayName: "",
  phone: "",
  username: "",
  statusMessage: "Hey there! I'm on VibeMsg",
  captureGuardEnabled: true,
  captureGuardType: "ai_gradient",
  captureGuardGradientId: 1,
  captureGuardText: "🔒 Screen capture blocked",
  captureGuardSoundUri: undefined,
  onboardingComplete: false,
};

interface ProfileContextValue {
  profile: ProfileSettings;
  profileLoaded: boolean;
  updateProfile: (updates: Partial<ProfileSettings>) => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

const STORAGE_KEY = "@vibemsg_profile";

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<ProfileSettings>(DEFAULT_SETTINGS);
  const [profileLoaded, setProfileLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((s) => {
      if (s) {
        const saved = JSON.parse(s) as Partial<ProfileSettings>;
        const merged = { ...DEFAULT_SETTINGS, ...saved };
        if (!merged.onboardingComplete && saved.displayName && saved.displayName.trim() !== "") {
          merged.onboardingComplete = true;
        }
        setProfile(merged);
      }
      setProfileLoaded(true);
    });
  }, []);

  const updateProfile = useCallback(
    async (updates: Partial<ProfileSettings>) => {
      const next = { ...profile, ...updates };
      setProfile(next);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    },
    [profile]
  );

  return (
    <ProfileContext.Provider value={{ profile, profileLoaded, updateProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within ProfileProvider");
  return ctx;
}
