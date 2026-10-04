import {
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
  InstrumentSans_700Bold,
  useFonts,
} from "@expo-google-fonts/instrument-sans";
import { Stack, type ErrorBoundaryProps } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ActivityIndicator, AppState, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Button } from "@/components/button";
import { forgetInvite } from "@/components/invite-card";
import { startPurchases } from "@/lib/purchases";
import { resumePendingRenders } from "@/lib/render";
import { account, useSessionRefresh } from "@/lib/use-account";
import { resetRenders } from "@/lib/use-renders";
import { colors, fonts, space } from "@/theme";

void SplashScreen.preventAutoHideAsync();

/** Pages above the tabs get the iPhone's back button and title bar. */
const pageHeader = {
  headerShown: true,
  headerBackTitle: "Back",
  headerTintColor: colors.fg,
  headerStyle: { backgroundColor: colors.bg },
  headerTitleStyle: { fontFamily: fonts.semibold },
  headerShadowVisible: false,
} as const;

/** On a slow connection, the session check can take a while: show a spinner instead of a frozen splash. */
const SPLASH_MAX_MS = 2500;

/** The root only needs to know signed in or not; screens read credits and names themselves. */
const useAccountStatus = () => useSyncExternalStore(account.subscribe, () => account.getSnapshot().status);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    InstrumentSans_700Bold,
  });
  const status = useAccountStatus();
  const [isSplashTooLong, setIsSplashTooLong] = useState(false);
  useSessionRefresh();

  // A font that fails to load falls back to the system font; the app still opens.
  const areFontsReady = fontsLoaded || Boolean(fontError);
  const isReady = areFontsReady && status !== "loading";
  useEffect(() => {
    if (isReady || isSplashTooLong) void SplashScreen.hideAsync();
  }, [isReady, isSplashTooLong]);
  useEffect(() => {
    const timer = setTimeout(() => setIsSplashTooLong(true), SPLASH_MAX_MS);
    return () => clearTimeout(timer);
  }, []);

  const isSignedIn = status === "signed-in";
  useEffect(() => {
    if (!isSignedIn) {
      resetRenders();
      forgetInvite();
      return;
    }
    // Swaps that finished while the app was closed land in My swaps; unfinished Apple purchases are sent again.
    void resumePendingRenders();
    void startPurchases();
    // And each time the app comes back to the front (the balance may have changed on the website too).
    const sub = AppState.addEventListener("change", (next) => {
      if (next !== "active") return;
      void resumePendingRenders();
      void account.refreshCredits();
    });
    return () => sub.remove();
  }, [isSignedIn]);

  if (!isReady) {
    // Still deciding signed in or not: a neutral screen, never a flash of the sign-in page.
    return isSplashTooLong ? (
      <View style={styles.waiting}>
        <ActivityIndicator color={colors.fg} />
      </View>
    ) : null;
  }

  return (
    // Gesture root: the before/after sliders use react-native-gesture-handler.
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Protected guard={isSignedIn}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="pack/[id]" options={pageHeader} />
          <Stack.Screen name="swap/[id]" options={pageHeader} />
          <Stack.Screen name="capture/[pack]" options={pageHeader} />
          <Stack.Screen name="studio/[id]" options={pageHeader} />
          <Stack.Screen name="buy" options={{ ...pageHeader, presentation: "modal" }} />
        </Stack.Protected>
        <Stack.Protected guard={!isSignedIn}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
        <Stack.Screen name="+not-found" options={{ ...pageHeader, title: "Not found" }} />
      </Stack>
    </GestureHandlerRootView>
  );
}

/**
 * If a screen crashes, show this instead of a blank or raw error screen. "Try again" re-renders
 * the screen; nothing on the phone is lost.
 */
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <View style={styles.error}>
      <Text style={styles.errorTitle}>Something went wrong</Text>
      <Text style={styles.errorBody}>This screen hit a problem. Your swaps and purchases are safe.</Text>
      <Button label="Try again" onPress={() => void retry()} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  waiting: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  error: { flex: 1, backgroundColor: colors.bg, justifyContent: "center", padding: space.lg, gap: space.md },
  errorTitle: { fontFamily: fonts.semibold, fontSize: 24, color: colors.fg },
  errorBody: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23, color: colors.muted },
});
