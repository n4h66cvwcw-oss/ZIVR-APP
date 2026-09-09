import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, router, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, AppState, AppStateStatus, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { MessagingProvider, useMessaging } from "@/context/MessagingContext";
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
import { getRecoveredLanguageUpdate } from "@/utils/language-sync";
import {
  createForegroundCheckHandler,
  createLatestAccessCheckGuard,
  DeniedCache,
  runChildCheck as runChildAccessCheck,
} from "@/utils/time-lock-gate";

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
    void Notifications.setNotificationCategoryAsync("scheduled-message-approval", [
      {
        identifier: "scheduled-send-as-planned",
        buttonTitle: "Send as planned",
        options: { opensAppToForeground: false },
      },
      {
        identifier: "scheduled-cancel",
        buttonTitle: "Cancel message",
        options: { isDestructive: true, opensAppToForeground: true },
      },
    ]);
  }, []);
  useEffect(() => {
    if (!serverUserId) return;
    registerForPushNotificationsAsync().then((token) => {
      if (token) updateServerProfile(serverUserId, { pushToken: token });
    });
  }, [serverUserId]);
  return null;
}

function ScheduledMessageNotifications() {
  const { cancelScheduledMessage } = useServer();

  useEffect(() => {
    const handleResponse = async (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data;
      if (data?.type !== "scheduled_message_approval" || typeof data.scheduledMessageId !== "string") return;
      if (response.actionIdentifier === "scheduled-cancel") {
        try {
          await cancelScheduledMessage(data.scheduledMessageId);
          Alert.alert("Scheduled message cancelled", "The message will not be sent.");
        } catch (error) {
          Alert.alert(
            "Couldn't cancel message",
            error instanceof Error ? error.message : "It may already have been sent.",
          );
        }
        router.push("/scheduled");
        return;
      }
      if (response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
        router.push("/scheduled");
      }
    };

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      void handleResponse(response);
    });
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) void handleResponse(response);
    }).catch(() => {});
    return () => subscription.remove();
  }, [cancelScheduledMessage]);

  return null;
}

type ContactApprovalNotificationData = {
  type?: unknown;
  childId?: unknown;
  contactId?: unknown;
  contactName?: unknown;
};

function getContactApprovalNotificationData(
  data: ContactApprovalNotificationData,
): { childId: string; contactId: string; contactName: string } | null {
  if (
    data.type !== "contact_approved" ||
    typeof data.childId !== "string" ||
    typeof data.contactId !== "string"
  ) {
    return null;
  }
  return {
    childId: data.childId,
    contactId: data.contactId,
    contactName: typeof data.contactName === "string" ? data.contactName : "this contact",
  };
}

/**
 * Contact approvals arrive live over Socket.IO and as push notifications.
 * Both paths lead straight to the newly approved direct chat.
 */
function ContactApprovalNotifications() {
  const { serverUserId, fetchServerUser, onContactApproved } = useServer();
  const { createServerDirectChat } = useMessaging();

  const openApprovedContact = useCallback(async (contactId: string) => {
    const contact = await fetchServerUser(contactId);
    if (!contact) {
      Alert.alert("Couldn't open chat", "We couldn't find this contact. Please try again.");
      return;
    }
    const result = await createServerDirectChat(contact);
    if (result.chatId) {
      router.push(`/chat/${result.chatId}`);
      return;
    }
    Alert.alert("Couldn't open chat", result.error ?? "Please try again.");
  }, [createServerDirectChat, fetchServerUser]);

  useEffect(() => {
    return onContactApproved((data) => {
      if (data.childId !== serverUserId) return;
      Alert.alert(
        "Contact approved",
        `You can now chat with ${data.contactName}`,
        [
          { text: "Not now", style: "cancel" },
          { text: "Chat now", onPress: () => { void openApprovedContact(data.contactId); } },
        ],
      );
    });
  }, [onContactApproved, openApprovedContact, serverUserId]);

  useEffect(() => {
    const handleResponse = (data: ContactApprovalNotificationData) => {
      const approval = getContactApprovalNotificationData(data);
      if (!approval || approval.childId !== serverUserId) return;
      void openApprovedContact(approval.contactId);
    };

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      handleResponse(response.notification.request.content.data);
    });
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) handleResponse(response.notification.request.content.data);
    }).catch(() => {});

    return () => subscription.remove();
  }, [openApprovedContact, serverUserId]);

  return null;
}

function LanguageSyncer() {
  const { serverUserId, fetchServerUser } = useServer();
  const { profile, profileLoaded, updateProfile } = useProfile();
  useEffect(() => {
    if (!serverUserId || !profileLoaded) return;
    let active = true;
    fetchServerUser(serverUserId).then((serverUser) => {
      if (!active) return;
      const update = getRecoveredLanguageUpdate(
        profile,
        serverUserId,
        serverUser?.preferredLanguage,
      );
      if (update) void updateProfile(update);
    });
    return () => {
      active = false;
    };
  }, [
    fetchServerUser,
    profile,
    profileLoaded,
    serverUserId,
    updateProfile,
  ]);
  return null;
}

/**
 * Existing signed-in accounts receive a recovery code once, before any local
 * storage can be lost. Child accounts use the same authenticated path after a
 * parent hands them their credential.
 */
function RecoveryCodePresenter() {
  const {
    recoveryCodeToSave,
    recoveryCodeNeedsReplacement,
    acknowledgeRecoveryCode,
    replaceRecoveryCode,
  } = useServer();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const visible = Boolean(recoveryCodeToSave || recoveryCodeNeedsReplacement);

  async function handleAcknowledge() {
    setBusy(true);
    setError(null);
    if (!(await acknowledgeRecoveryCode())) {
      setError("We couldn't confirm your code. Please try again while you're online.");
    }
    setBusy(false);
  }

  async function handleReplacement() {
    setBusy(true);
    setError(null);
    if (!(await replaceRecoveryCode())) {
      setError("We couldn't generate a replacement code. Please try again while you're online.");
    }
    setBusy(false);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={recoveryStyles.backdrop}>
        <View style={recoveryStyles.card}>
          {recoveryCodeToSave ? (
            <>
              <Text style={recoveryStyles.title}>Save your recovery code</Text>
              <Text style={recoveryStyles.body}>Keep this code somewhere safe. It restores this account after reinstalling ZIVR.</Text>
              <Text selectable style={recoveryStyles.code}>{recoveryCodeToSave}</Text>
              <Pressable disabled={busy} onPress={handleAcknowledge} style={[recoveryStyles.button, busy && recoveryStyles.disabled]}>
                <Text style={recoveryStyles.buttonText}>{busy ? "Confirming…" : "I've saved it"}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={recoveryStyles.title}>Create a new recovery code</Text>
              <Text style={recoveryStyles.body}>Your earlier code was not confirmed. Generate and save a replacement before continuing.</Text>
              <Pressable disabled={busy} onPress={handleReplacement} style={[recoveryStyles.button, busy && recoveryStyles.disabled]}>
                <Text style={recoveryStyles.buttonText}>{busy ? "Generating…" : "Generate a new code"}</Text>
              </Pressable>
            </>
          )}
          {error && <Text style={recoveryStyles.error}>{error}</Text>}
        </View>
      </View>
    </Modal>
  );
}

const recoveryStyles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "rgba(0,0,0,0.58)" },
  card: { width: "100%", maxWidth: 380, gap: 16, borderRadius: 20, padding: 24, backgroundColor: "#FFF" },
  title: { fontFamily: "Inter_700Bold", fontSize: 21, color: "#111827", textAlign: "center" },
  body: { fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 22, color: "#4B5563", textAlign: "center" },
  code: { borderRadius: 12, padding: 14, backgroundColor: "#EEF2FF", color: "#3730A3", fontFamily: "Inter_700Bold", fontSize: 16, textAlign: "center" },
  button: { borderRadius: 12, paddingVertical: 14, backgroundColor: "#0A84FF" },
  buttonText: { color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 16, textAlign: "center" },
  disabled: { opacity: 0.55 },
  error: { color: "#DC2626", fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center" },
});

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
  const {
    serverUserId,
    identityReady,
    fetchServerUser,
    isConnected,
    onTimeOverride,
  } = useServer();
  const { checkAccessStrict } = useParental();

  const [status, setStatus] = useState<LockStatus>("pending");
  const [lockInfo, setLockInfo] = useState<DeniedCache>({ startHour: 8, endHour: 21 });
  const [overrideRemainingMs, setOverrideRemainingMs] = useState<number | null>(null);

  /**
   * Tracks the user ID that owns the current gate state.
   * Any async result for a different user is discarded.
   */
  const activeUserRef = useRef<string | null>(null);
  const accessCheckGuardRef = useRef(createLatestAccessCheckGuard());

  /**
   * Timestamp (ms) of the last foreground-resume access check.
   * Used by createForegroundCheckHandler to suppress duplicate calls within
   * the 60-second cache window (e.g. rapid force-quit and reopen).
   */
  const lastForegroundCheckMsRef = useRef<number | null>(null);

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
    const generation = accessCheckGuardRef.current.begin();
    await runChildAccessCheck({
      userId,
      checkAccess: checkAccessStrict,
      getDeniedCache: (id) => AsyncStorage.getItem(deniedCacheKey(id)),
      setDeniedCache: (id, cache) => AsyncStorage.setItem(
        deniedCacheKey(id),
        JSON.stringify(cache),
      ),
      isCurrent: () => (
        activeUserRef.current === userId &&
        accessCheckGuardRef.current.isCurrent(generation)
      ),
      setOverrideRemainingMs,
      setLockInfo,
      setStatus,
    });
  }, [checkAccessStrict]);

  // Re-check after the server-calculated remaining duration even when the app
  // remains in the foreground. This deliberately does not use device time.
  useEffect(() => {
    if (!serverUserId || !overrideRemainingMs) return;

    const timer = setTimeout(() => {
      if (activeUserRef.current !== serverUserId) return;
      setStatus("pending");
      void runChildCheck(serverUserId);
    }, overrideRemainingMs + 50);

    return () => clearTimeout(timer);
  }, [overrideRemainingMs, runChildCheck, serverUserId]);

  // Override changes can arrive while the child app is open or on the lock
  // screen. Always re-check the API instead of trusting the socket payload.
  useEffect(() => {
    return onTimeOverride(({ childId }) => {
      if (activeUserRef.current !== childId) return;
      setStatus("pending");
      void runChildCheck(childId);
    });
  }, [onTimeOverride, runChildCheck]);

  // Socket events are transient. Revalidate any active child session when its
  // authenticated socket reconnects so a persisted override cannot be missed.
  useEffect(() => {
    if (!isConnected) return;
    const childId = activeUserRef.current;
    if (!childId) return;
    setStatus("pending");
    void runChildCheck(childId);
  }, [isConnected, runChildCheck]);

  /**
   * Full gate evaluation for `userId`.  Determines account type then gates
   * if (and only if) the account is a child.
   */
  const evaluate = useCallback(async (userId: string) => {
    accessCheckGuardRef.current.invalidate();
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

    // The foreground cache belongs to the signed-in identity. Never let a
    // previous user's recent check suppress the next user's first resume.
    lastForegroundCheckMsRef.current = null;

    if (!serverUserId) {
      // Confirmed signed out.
      activeUserRef.current = null;
      accessCheckGuardRef.current.invalidate();
      setOverrideRemainingMs(null);
      setStatus("allowed");
      return;
    }

    // New (or restored) authenticated user — gate until confirmed.
    activeUserRef.current = serverUserId;
    setOverrideRemainingMs(null);
    setStatus("pending");
    evaluate(serverUserId);
  // evaluate is a stable callback; omitting it avoids spurious re-runs on
  // its internal dep changes while still firing on the meaningful signals.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identityReady, serverUserId]);

  // Re-evaluate every time the app comes back to the foreground.
  // createForegroundCheckHandler adds a 60-second cache to suppress duplicate
  // API calls on rapid force-quit and reopen (e.g. double-press home + switch).
  useEffect(() => {
    const handleForeground = createForegroundCheckHandler({
      getUserId: () => activeUserRef.current,
      getCachedAccountType: async (userId) => {
        try {
          return await AsyncStorage.getItem(accountTypeKey(userId));
        } catch {
          return null;
        }
      },
      runCheck: async (userId) => {
        if (activeUserRef.current !== userId) return;
        setStatus("pending");
        await runChildCheck(userId);
      },
      getLastCheckMs: () => lastForegroundCheckMsRef.current,
      setLastCheckMs: (ms) => { lastForegroundCheckMsRef.current = ms; },
    });

    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      void handleForeground(state);
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
  const pathname = usePathname();
  const { setActiveChatId } = useMessaging();
  const activeChatId = pathname.match(/^\/chat\/([^/]+)$/)?.[1] ?? null;

  // This layout effect runs before the server provider's socket connection
  // effect. It establishes the unread guard from the actual launch route, so a
  // restored chat is active before missed messages can be replayed, while a
  // cold launch to the chat list leaves every chat eligible for unread badges.
  useLayoutEffect(() => {
    setActiveChatId(activeChatId);
  }, [activeChatId, setActiveChatId]);

  return (
    <TimeLockGate>
      <OnboardingGate />
      <PushRegistrar />
      <ContactApprovalNotifications />
      <ScheduledMessageNotifications />
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
        <Stack.Screen name="scheduled" options={{ headerShown: false, presentation: "card", animation: "slide_from_right" }} />
        <Stack.Screen name="schedule-message" options={{ headerShown: false, presentation: "formSheet" }} />
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
                        <RecoveryCodePresenter />
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
