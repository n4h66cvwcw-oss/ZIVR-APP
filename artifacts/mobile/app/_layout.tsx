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
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { MessagingProvider } from "@/context/MessagingContext";
import { CallProvider } from "@/context/CallContext";
import { ProfileProvider, useProfile } from "@/context/ProfileContext";
import { ServerProvider } from "@/context/ServerContext";
import { SkinProvider } from "@/context/SkinContext";
import { IncomingCallModal } from "@/components/IncomingCallModal";
import { ScreenCaptureGuard } from "@/components/ScreenCaptureGuard";

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

function RootLayoutNav() {
  return (
    <>
      <OnboardingGate />
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
      </Stack>
      <IncomingCallModal />
    </>
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
            </ServerProvider>
          </ProfileProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
