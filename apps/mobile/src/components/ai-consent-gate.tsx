import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { type ReactNode, useSyncExternalStore } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { type Edge, SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { CompareSlider } from "@/components/compare-slider";
import { useAiConsent } from "@/lib/ai-consent";
import { API_URL } from "@/lib/config";
import { PACK_COVERS } from "@/lib/packs";
import { account } from "@/lib/use-account";
import { colors, display, fonts, radius, space } from "@/theme";

/** What Allow means, one short line each. */
const POINTS = [
  { title: "Read by our AI partners", body: "They find what you can swap and make your new picture." },
  { title: "Only used for your swaps", body: "Never sold, and never used to train AI." },
  { title: "Your choice", body: "Say no and nothing is sent. Scryle just can't read photos without it." },
] as const;

const EXAMPLE = PACK_COVERS.room;

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
        {/* What Allow unlocks: a real example swap, labelled as an AI edit like every "after" in the app. */}
        <CompareSlider
          before={EXAMPLE.before}
          after={EXAMPLE.after ?? EXAMPLE.before}
          hint
          dragAnywhere
          style={styles.example}
          accessibilityLabel="An example swap of a living room. The right side is an AI edit."
        />
        <Text style={styles.title} accessibilityRole="header">
          Before your first scan
        </Text>
        <View style={styles.points}>
          {POINTS.map((point, i) => (
            <View key={point.title} style={[styles.point, i > 0 && styles.pointDivider]}>
              <Text style={styles.pointTitle}>{point.title}</Text>
              <Text style={styles.pointBody}>{point.body}</Text>
            </View>
          ))}
        </View>
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
  content: { padding: space.lg, paddingTop: space.md, gap: space.md },
  example: { height: 220, borderRadius: radius.lg },
  title: { ...display, fontSize: 30, lineHeight: 34, marginTop: space.sm },
  points: { borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: space.md },
  point: { paddingVertical: 14, gap: 2 },
  pointDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  pointTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.fg },
  pointBody: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.muted },
  link: { fontFamily: fonts.medium, fontSize: 15, color: colors.accentInk, paddingVertical: space.xs, alignSelf: "flex-start" },
  actions: { paddingHorizontal: space.lg, paddingBottom: space.sm, gap: space.sm },
  error: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21, color: colors.fg, textAlign: "center" },
});
