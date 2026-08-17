import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, AppStateStatus, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { MessagingProvider } from "@/context/MessagingContext";
import { CallProvider } from "@/context/CallContext";
import { ProfileProvider, useProfile } from "@/context/ProfileContext";
import { ServerProvider, useServer } from "@/context/ServerContext";
import { SkinProvider } from "@/context/SkinContext";
import { ParentalProvider, useParental } from "@/context/ParentalContext";
import { FavoritesProvider } from "@/context/FavoritesContext";
import { IncomingCallModal } from "@/components/IncomingCallModal";
import { ScreenCaptureGuard } from "@/components/ScreenCaptureGuard";
import { TimeLockScreen } from "@/components/TimeLockScreen";
import { registerForPushNotificationsAsync } from "@/utils/notifications";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function OnboardingGate() {
  const { profile, profileLoaded } = useProfile();
  useEffect(() => {
    if (!profileLoaded) return;
    if (!profile.onboardingComplete) {
      router.replace("/onboarding");
    }
  }, [profileLoaded, profile.onboardingComplete]);
  return null;
}

function PushRegistrar() {
  const { serverUserId, updateServerProfile } = useServer();
  useEffect(() => {
    if (!serverUserId) return;
    registerForPushNotificationsAsync().then((token) => {
      if (token) updateServerProfile(serverUserId, { pushToken: token });
    });
  }, [serverUserId]);
  return null;
}

function LanguageSyncer() {
  const { serverUserId, fetchServerUser } = useServer();
  const { profile, profileLoaded, updateProfile } = useProfile();
  useEffect(() => {
    if (!serverUserId || !profileLoaded) return;
    fetchServerUser(serverUserId).then((serverUser) => {
      if (serverUser?.preferredLanguage && !profile.primaryLanguage) {
        updateProfile({ primaryLanguage: serverUser.preferredLanguage });
      }
    });
  }, [serverUserId, profileLoaded]);
  return null;
}

/** AsyncStorage key for the cached account type of a specific user. */
function accountTypeKey(userId: string) {
  return `@zivr_account_type:${userId}`;
}

/**
 * AsyncStorage key for the last *denied* access result for a child user.
 * Only denied results are cached for offline fallback — allowed results are
 * never used to bypass the live check.
 */
function deniedCacheKey(userId: string) {
  return `@zivr_lock_denied:${userId}`;
}

type DeniedCache = { startHour: number; endHour: number };
type LockStatus = "pending" | "allowed" | "denied";

/**
 * Blocks the entire app on launch and foreground-resume for child accounts
 * outside their allowed hours.
 *
 * Child account detection:
 *   - Reads `accountType` from AsyncStorage; if absent, fetches the user profile.
 *   - Non-child accounts (parent, regular, unknown-but-allowed) pass through immediately.
 *   - Account type is persisted per user so offline non-children are never locked.
 *
 * Child gate behaviour:
 *   - Always performs a live access check; a cached `allowed` result NEVER bypasses
 *     this check (prevents schedule-boundary bypass at e.g. the 20:59→21:00 edge).
 *   - On network failure with a cached `denied` result: shows the lock screen with
 *     the saved hours.
 *   - On network failure with no cache: fails closed (lock screen).
 *
 * In-flight guard: async results are tagged with the user ID they were issued for;
 * any response that arrives after a user or identity change is silently discarded.
 */
function TimeLockGate({ children }: { children: React.ReactNode }) {
  const { serverUserId, identityReady, fetchServerUser } = useServer();
  const { checkAccessStrict } = useParental();

  const [status, setStatus] = useState<LockStatus>("pending");
  const [lockInfo, setLockInfo] = useState<DeniedCache>({ startHour: 8, endHour: 21 });

  /**
   * Tracks the user ID that owns the current gate state.
   * Any async result for a different user is discarded.
   */
  const activeUserRef = useRef<string | null>(null);

  /**
   * Determine whether `userId` is a child account.
   * Checks the AsyncStorage cache first; falls back to a live profile fetch.
   * Returns `null` when the type cannot be confirmed (offline + no cache).
   * Callers must treat `null` as "unknown → gate applies (fail closed)".
   * Never caches a null/unknown result so a future successful fetch can populate it.
   */
  const resolveIsChild = useCallback(async (userId: string): Promise<boolean | null> => {
    // Try fast cache path first (only trust a non-empty stored value).
    try {
      const cached = await AsyncStorage.getItem(accountTypeKey(userId));
      if (cached === "child") return true;
      if (cached && cached !== "") return false; // e.g. "parent", "regular"
      // cached === null (absent) or "" (previously failed) → fall through
    } catch {/* ignore */}

    // Fetch the profile for a definitive answer.
    try {
      const user = await fetchServerUser(userId);
      const type = user?.accountType ?? null;
      if (type) {
        // Only cache a real, non-empty account type.
        AsyncStorage.setItem(accountTypeKey(userId), type).catch(() => {});
        return type === "child";
      }
      // fetchServerUser returned null or a user with no accountType field:
      // treat as unknown (the server call succeeded but type is absent / user
      // not yet typed — do not cache, and treat as "might be child").
      return null;
    } catch {
      // Network failure and no usable cache — unknown.
      return null;
    }
  }, [fetchServerUser]);

  /**
   * Run a live access check for a confirmed child user.
   * - On success: apply result; cache only denied outcomes for offline fallback.
   * - On failure: use cached denied result; if none, fail closed.
   */
  const runChildCheck = useCallback(async (userId: string) => {
    try {
      const result = await checkAccessStrict(userId);

      // Persist denied results so an offline reopen can show the correct hours.
      // Allowed results are deliberately NOT cached to prevent schedule-boundary bypass.
      if (!result.allowed) {
        AsyncStorage.setItem(
          deniedCacheKey(userId),
          JSON.stringify({ startHour: result.startHour ?? 8, endHour: result.endHour ?? 21 })
        ).catch(() => {});
      }

      if (activeUserRef.current !== userId) return; // stale — discard
      if (result.allowed) {
        setStatus("allowed");
      } else {
        setLockInfo({ startHour: result.startHour ?? 8, endHour: result.endHour ?? 21 });
        setStatus("denied");
      }
    } catch {
      // Network / auth error — use cached denied result if available.
      if (activeUserRef.current !== userId) return;
      try {
        const raw = await AsyncStorage.getItem(deniedCacheKey(userId));
        // Re-check after the await: user may have changed while we read storage.
        if (activeUserRef.current !== userId) return;
        if (raw) {
          const dc = JSON.parse(raw) as DeniedCache;
          setLockInfo(dc);
          setStatus("denied");
          return;
        }
      } catch {/* ignore */}
      // Re-check after any potential async gap before mutating state.
      if (activeUserRef.current !== userId) return;
      // No usable cache — fail closed.
      setStatus("denied");
    }
  }, [checkAccessStrict]);

  /**
   * Full gate evaluation for `userId`.  Determines account type then gates
   * if (and only if) the account is a child.
   */
  const evaluate = useCallback(async (userId: string) => {
    const isChild = await resolveIsChild(userId);

    if (activeUserRef.current !== userId) return; // user changed while resolving

    if (isChild === false) {
      // Confirmed non-child: pass through, no access check needed.
      setStatus("allowed");
      return;
    }

    // isChild === true OR null (unknown/offline): apply child gate.
    await runChildCheck(userId);
  }, [resolveIsChild, runChildCheck]);

  // Respond to identity hydration and user changes.
  useEffect(() => {
    if (!identityReady) return; // Still loading from AsyncStorage — keep pending.

    if (!serverUserId) {
      // Confirmed signed out.
      activeUserRef.current = null;
      setStatus("allowed");
      return;
    }

    // New (or restored) authenticated user — gate until confirmed.
    activeUserRef.current = serverUserId;
    setStatus("pending");
    evaluate(serverUserId);
  // evaluate is a stable callback; omitting it avoids spurious re-runs on
  // its internal dep changes while still firing on the meaningful signals.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identityReady, serverUserId]);

  // Re-evaluate every time the app comes back to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener("change", async (state: AppStateStatus) => {
      if (state !== "active") return;
      const userId = activeUserRef.current;
      if (!userId) return;

      // Non-child (cached): no lock check needed on foreground.
      try {
        const cached = await AsyncStorage.getItem(accountTypeKey(userId));
        if (cached !== null && cached !== "child") return;
      } catch {/* ignore */}

      // Child (or unknown): always run a live check on foreground.
      if (activeUserRef.current !== userId) return;
      setStatus("pending");
      runChildCheck(userId);
    });
    return () => sub.remove();
  }, [runChildCheck]);

  if (status === "pending") {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (status === "denied") {
    return <TimeLockScreen startHour={lockInfo.startHour} endHour={lockInfo.endHour} />;
  }

  return <>{children}</>;
}

function RootLayoutNav() {
  return (
    <TimeLockGate>
      <OnboardingGate />
      <PushRegistrar />
      <LanguageSyncer />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, presentation: "fullScreenModal", animation: "fade" }} />
        <Stack.Screen
          name="chat/[id]"
          options={{
            headerShown: false,
            presentation: "card",
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="call/[id]"
          options={{
            headerShown: false,
            presentation: "fullScreenModal",
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen
          name="call-history"
          options={{
            headerShown: false,
            presentation: "card",
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="checkin/[id]"
          options={{
            headerShown: false,
            presentation: "card",
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="checkin/broadcast/[broadcastId]"
          options={{
            headerShown: false,
            presentation: "card",
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="new-chat"
          options={{
            headerShown: false,
            presentation: "modal",
          }}
        />
        <Stack.Screen
          name="new-group"
          options={{
            headerShown: false,
            presentation: "modal",
          }}
        />
        <Stack.Screen
          name="new-checkin"
          options={{
            headerShown: false,
            presentation: "modal",
          }}
        />
        <Stack.Screen
          name="profile"
          options={{
            headerShown: false,
            presentation: "modal",
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen
          name="skin-store"
          options={{
            headerShown: false,
            presentation: "modal",
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen
          name="checkin/received/[broadcastId]"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="parental-dashboard"
          options={{
            headerShown: false,
            presentation: "modal",
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen
          name="parental/[childId]"
          options={{
            headerShown: false,
            presentation: "card",
            animation: "slide_from_right",
          }}
        />
      </Stack>
      <IncomingCallModal />
    </TimeLockGate>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <ProfileProvider>
            <ServerProvider>
            <ParentalProvider>
            <FavoritesProvider>
            <SkinProvider>
              <MessagingProvider>
                <CallProvider>
                  <GestureHandlerRootView style={{ flex: 1 }}>
                    <KeyboardProvider>
                      <ScreenCaptureGuard>
                        <RootLayoutNav />
                      </ScreenCaptureGuard>
                    </KeyboardProvider>
                  </GestureHandlerRootView>
                </CallProvider>
              </MessagingProvider>
            </SkinProvider>
            </FavoritesProvider>
            </ParentalProvider>
            </ServerProvider>
          </ProfileProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
