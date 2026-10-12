import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { type ReactNode, useSyncExternalStore } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { type Edge, SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { useAiConsent } from "@/lib/ai-consent";
import { API_URL } from "@/lib/config";
import { account } from "@/lib/use-account";
import { colors, display, fonts, space } from "@/theme";

const useUserId = () =>
  useSyncExternalStore(account.subscribe, () => {
    const me = account.getSnapshot();
    return me.status === "signed-in" ? me.userId : null;
  });

/**
 * Apple guideline 5.1.2(i): before the first photo goes to a third-party AI, say so and ask. Shows
 * `children` (the camera) only once the server says this account allowed it. The server checks
 * again on every scan. `edges`: add "top" on a screen with no header bar.
 *
 * The owner chose (2026-10-11) not to name the AI companies in the app: "Who we work with" opens the
 * Privacy page's "Your photos and AI" section, which names them, what they keep and for how long.
 * If this wording changes in a way that matters, raise AI_CONSENT_VERSION (packages/core) and update
 * that section to match, so everyone is asked again.
 */
export function AiConsentGate({ children, edges = ["bottom"] }: { children: ReactNode; edges?: Edge[] }) {
  const { state, isAllowing, allow, retry } = useAiConsent(useUserId());

  if (state.status === "allowed") return <>{children}</>;

  if (state.status === "checking") {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.fg} accessibilityLabel="Checking your settings" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title} accessibilityRole="header">
          Before your first scan
        </Text>
        <Text style={styles.body}>
          Scryle uses trusted AI partners to read your photo and make your swap. Your photo is only used for that. We never
          sell it or use it to train AI.
        </Text>
        <Text
          accessibilityRole="link"
          style={styles.link}
          onPress={() => void WebBrowser.openBrowserAsync(`${API_URL}/privacy#ai`)}
        >
          Who we work with ›
        </Text>
      </ScrollView>

      <View style={styles.actions}>
        {state.status === "error" ? (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {state.message}
          </Text>
        ) : null}
        {state.status === "error" && !isAllowing ? (
          <Button label="Try again" onPress={() => void retry()} />
        ) : (
          <Button label="Allow" isBusy={isAllowing} onPress={() => void allow()} />
        )}
        <Button label="Not now" variant="quiet" disabled={isAllowing} onPress={() => router.back()} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.md },
  title: { ...display, fontSize: 32, lineHeight: 35, marginTop: space.md },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23, color: colors.muted },
  link: { fontFamily: fonts.medium, fontSize: 15, color: colors.accentInk, paddingVertical: space.xs, alignSelf: "flex-start" },
  actions: { paddingHorizontal: space.lg, paddingBottom: space.sm, gap: space.sm },
  error: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21, color: colors.fg, textAlign: "center" },
});
