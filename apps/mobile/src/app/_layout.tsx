import {
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
  InstrumentSans_700Bold,
  useFonts,
} from "@expo-google-fonts/instrument-sans";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useAccount, useSessionRefresh } from "@/lib/use-account";
import { colors, fonts } from "@/theme";

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

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    InstrumentSans_700Bold,
  });
  const account = useAccount();
  useSessionRefresh();

  // A font that fails to load falls back to the system font; the app still opens.
  const isReady = (fontsLoaded || Boolean(fontError)) && account.status !== "loading";
  useEffect(() => {
    if (isReady) void SplashScreen.hideAsync();
  }, [isReady]);
  if (!isReady) return null;

  const isSignedIn = account.status === "signed-in";
  return (
    // Gesture root: the before/after sliders use react-native-gesture-handler.
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Protected guard={isSignedIn}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="pack/[id]" options={pageHeader} />
          <Stack.Screen name="swap/[id]" options={pageHeader} />
        </Stack.Protected>
        <Stack.Protected guard={!isSignedIn}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
      </Stack>
    </GestureHandlerRootView>
  );
}
