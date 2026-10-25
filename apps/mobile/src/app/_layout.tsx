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
import { identify } from "@/lib/purchases";
import { resumePendingRenders, trackedRenders } from "@/lib/render";
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

/** "plan" or "none" once the server has answered; "loading" or "error" before that. Decides the hard paywall. */
const usePlanGate = () =>
  useSyncExternalStore(account.subscribe, () => {
    const me = account.getSnapshot();
    if (me.status !== "signed-in") return "none";
    if (me.plan) return "plan";
    return me.planCheck === "ready" ? "none" : me.planCheck;
  });

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    InstrumentSans_700Bold,
  });
  const status = useAccountStatus();
  const userId = useSyncExternalStore(account.subscribe, () => { const me = account.getSnapshot(); return me.status === "signed-in" ? me.userId : null; });
  const gate = usePlanGate();
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
    // Swaps that finished while the app was closed land in My swaps.
    void resumePendingRenders();
    void trackedRenders.recover();
    // And each time the app comes back to the front (the balance may have changed on the website too).
    const sub = AppState.addEventListener("change", (next) => {
      if (next !== "active") return;
      void resumePendingRenders();
      void trackedRenders.recover();
      void account.refreshCredits();
    });
    return () => sub.remove();
  }, [isSignedIn, userId]);

  // RevenueCat follows whoever is signed in, so a purchase belongs to this account.
  useEffect(() => {
    void identify(userId);
  }, [userId]);

  if (!isReady) {
    // Still deciding signed in or not: a neutral screen, never a flash of the sign-in page.
    return isSplashTooLong ? (
      <View style={styles.waiting}>
        <ActivityIndicator color={colors.fg} />
      </View>
    ) : null;
  }

  if (isSignedIn && (gate === "loading" || gate === "error")) {
    // Never flash the paywall at someone who has a plan: wait for the server's answer first.
    return (
      <View style={styles.waiting}>
        {gate === "loading" ? (
          <ActivityIndicator color={colors.fg} />
        ) : (
          <>
            <Text style={styles.waitTitle}>Couldn&apos;t check your plan</Text>
            <Text style={styles.waitBody}>Check your connection and try again.</Text>
            <Button label="Try again" onPress={() => void account.refreshCredits()} style={styles.waitButton} />
            <Button label="Sign out" variant="quiet" onPress={() => void account.signOut()} style={styles.waitButton} />
          </>
        )}
      </View>
    );
  }
  const hasPlan = gate === "plan";

  return (
    // Gesture root: the before/after sliders use react-native-gesture-handler.
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="light" />
      <Stack key={userId ?? "signed-out"} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Protected guard={isSignedIn && hasPlan}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="pack/[id]" options={pageHeader} />
          <Stack.Screen name="capture/[pack]" options={pageHeader} />
          <Stack.Screen name="snap" options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }} />
          <Stack.Screen name="studio/[id]" options={pageHeader} />
          {/* No header bar: the sheet has its own headline and Close (app/buy.tsx). */}
          <Stack.Screen name="buy" options={{ presentation: "modal", headerShown: false }} />
        </Stack.Protected>
        {/* Hard paywall (owner's choice, 2026-10-10): without a plan, the plans, account settings and saved pictures. */}
        <Stack.Protected guard={isSignedIn && !hasPlan}>
          <Stack.Screen name="paywall" />
          <Stack.Screen name="manage-account" options={{ ...pageHeader, title: "Account" }} />
          {/* People keep their pictures when a plan ends (owner's choice, 2026-10-24); new ones need a plan. */}
          <Stack.Screen name="my-pictures" options={{ ...pageHeader, title: "" }} />
        </Stack.Protected>
        {/* A saved picture opens with or without a plan; "Swap more" only shows with one (app/swap/[id].tsx). */}
        <Stack.Protected guard={isSignedIn}>
          <Stack.Screen name="swap/[id]" options={pageHeader} />
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
      <Text style={styles.errorBody}>This screen hit a problem. Your pictures and your plan are safe.</Text>
      <Button label="Try again" onPress={() => void retry()} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  waiting: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  waitTitle: { fontFamily: fonts.semibold, fontSize: 22, color: colors.fg, textAlign: "center" },
  waitBody: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23, color: colors.muted, textAlign: "center", marginBottom: space.sm },
  waitButton: { alignSelf: "stretch", marginHorizontal: space.lg, marginTop: space.sm },
  error: { flex: 1, backgroundColor: colors.bg, justifyContent: "center", padding: space.lg, gap: space.md },
  errorTitle: { fontFamily: fonts.semibold, fontSize: 24, color: colors.fg },
  errorBody: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23, color: colors.muted },
});
