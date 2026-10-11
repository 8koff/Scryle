import { router } from "expo-router";
import { type ReactNode, useSyncExternalStore } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { type Edge, SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { LegalLinks } from "@/components/legal-links";
import { useAiConsent } from "@/lib/ai-consent";
import { account } from "@/lib/use-account";
import { colors, display, fonts, radius, space } from "@/theme";

const useUserId = () =>
  useSyncExternalStore(account.subscribe, () => {
    const me = account.getSnapshot();
    return me.status === "signed-in" ? me.userId : null;
  });

/**
 * Apple guideline 5.1.2(i): before the first photo goes to a third-party AI, say what is sent, to
 * whom, why and for how long, and ask. Shows `children` (the camera) only once the server says this
 * account allowed it. The server checks again on every scan. `edges`: add "top" on a screen with no
 * header bar.
 *
 * If this wording changes in a way that matters, raise AI_CONSENT_VERSION (packages/core) and update
 * the Privacy page to match, so everyone is asked again.
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
          Your photo and our AI
        </Text>
        <Text style={styles.body}>
          To find what you can swap, Scryle sends your photo to two AI companies. Nothing is sent until you tap Allow.
        </Text>

        <View style={styles.partners}>
          <Partner name="Anthropic (Claude)">
            Reads your photo to find the parts you can swap. It deletes the photo within 30 days and doesn&apos;t train its AI
            on it.
          </Partner>
          <Partner name="Higgsfield">
            Holds your photo and makes your swap. It keeps its copies at unlisted links for a limited time. We can&apos;t delete
            those.
          </Partner>
        </View>

        <Text style={styles.body}>
          If you make a swap, we keep the photo and the swap in your account until you close it. We never sell your photos or
          use them to train AI.
        </Text>
        <Text style={styles.body}>You can say no. Scryle can&apos;t read your photos without this.</Text>
        <LegalLinks />
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

function Partner({ name, children }: { name: string; children: ReactNode }) {
  return (
    <View style={styles.partner}>
      <Text style={styles.partnerName}>{name}</Text>
      <Text style={styles.partnerBody}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.md },
  title: { ...display, fontSize: 32, lineHeight: 35, marginTop: space.md },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23, color: colors.muted },
  partners: { gap: space.sm },
  partner: { padding: space.md, borderRadius: radius.md, backgroundColor: colors.surface, gap: space.xs },
  partnerName: { fontFamily: fonts.semibold, fontSize: 17, color: colors.fg },
  partnerBody: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.muted },
  actions: { paddingHorizontal: space.lg, paddingBottom: space.sm, gap: space.sm },
  error: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21, color: colors.fg, textAlign: "center" },
});
