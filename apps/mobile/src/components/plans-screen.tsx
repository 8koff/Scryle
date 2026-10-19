import { getPlanTier, yearlySavingPercent, type PlanOffer, type PlanPeriod, type PlanTierId } from "@retrofit/core";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { LegalLinks } from "@/components/legal-links";
import { SeamMark } from "@/components/seam-mark";
import { buyPlan, loadOffers, restorePlan, type BuyResult, type Offers } from "@/lib/purchases";
import { useAccount } from "@/lib/use-account";
import { colors, fonts, headline, radius, space } from "@/theme";

type Props = {
  /** "gate": the hard paywall, the only way in. "sheet": changing plan, opened from the app. */
  mode: "gate" | "sheet";
};

const PER: Record<PlanPeriod, string> = { monthly: "month", yearly: "year" };

/**
 * Our own paywall (owner's choice, 2026-10-10). Apple requires, on a subscription paywall: each
 * plan's price and period, what it includes, that it renews until cancelled, Restore, and links to
 * Terms and Privacy. All of them are on this screen.
 */
export function PlansScreen({ mode }: Props) {
  const me = useAccount();
  const current = me.status === "signed-in" ? me.plan : null;
  const [offers, setOffers] = useState<Offers | null>(null);
  const [period, setPeriod] = useState<PlanPeriod>(current?.period ?? "monthly");
  const [tier, setTier] = useState<PlanTierId>(current?.tier ?? "pro");
  const [busy, setBusy] = useState<"buy" | "restore" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Bumped by "Try again" to load the plans once more.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let isLive = true;
    void loadOffers().then((result) => isLive && setOffers(result));
    return () => {
      isLive = false;
    };
  }, [attempt]);

  const retry = () => {
    setOffers(null);
    setAttempt((n) => n + 1);
  };

  const list = offers && offers.status !== "unavailable" ? offers.offers : [];
  const shown = list.filter((o) => o.period === period);
  const chosen = shown.find((o) => o.tier.id === tier) ?? null;
  const isCurrent = (o: PlanOffer) => current?.tier === o.tier.id && current.period === o.period;
  const saving = yearlySavingPercent(getPlanTier("pro")!);

  const finish = (result: BuyResult) => {
    setBusy(null);
    if (result.kind === "active") {
      // The gate closes by itself once the account has a plan (app/_layout.tsx); a sheet closes here.
      if (mode === "sheet") router.back();
    } else if (result.kind === "pending") {
      setNotice("Apple confirmed it. Your plan is being set up and will appear in a moment.");
    } else if (result.kind === "error") {
      setNotice(result.message);
    }
  };

  const onBuy = async () => {
    if (!chosen || busy) return;
    setNotice(null);
    setBusy("buy");
    finish(await buyPlan(chosen));
  };
  const onRestore = async () => {
    if (busy) return;
    setNotice(null);
    setBusy("restore");
    finish(await restorePlan());
  };

  return (
    <SafeAreaView style={styles.screen} edges={mode === "gate" ? ["top", "bottom"] : ["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        {mode === "sheet" ? (
          <Pressable accessibilityRole="button" hitSlop={12} onPress={() => router.back()} style={styles.close}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        ) : (
          <View style={styles.brand} accessibilityRole="header" accessibilityLabel="Scryle">
            <SeamMark size={26} />
            <Text style={styles.wordmark}>Scryle</Text>
          </View>
        )}

        <Text style={styles.title}>{mode === "gate" ? "Pick a plan\nto start swapping" : "Change your plan"}</Text>
        <Text style={styles.body}>Each swap restyles one photo with real products you can buy. Your swaps reset every month.</Text>

        <View style={styles.toggle} accessibilityRole="tablist">
          {(["monthly", "yearly"] as const).map((p) => (
            <Pressable
              key={p}
              accessibilityRole="tab"
              accessibilityState={{ selected: period === p }}
              onPress={() => setPeriod(p)}
              style={[styles.toggleItem, period === p && styles.toggleOn]}
            >
              <Text style={[styles.toggleText, period === p && styles.toggleTextOn]}>{p === "monthly" ? "Monthly" : "Yearly"}</Text>
              {p === "yearly" ? <Text style={[styles.toggleSave, period === p && styles.toggleTextOn]}>Save {saving}%</Text> : null}
            </Pressable>
          ))}
        </View>

        {offers === null ? <ActivityIndicator color={colors.fg} style={styles.loading} /> : null}
        {offers?.status === "unavailable" ? (
          <View style={styles.unavailable}>
            <Text style={styles.notice}>{offers.message}</Text>
            <Pressable accessibilityRole="button" onPress={retry} style={styles.retry}>
              <Text style={styles.restoreText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}
        {offers?.status === "preview" ? <Text style={styles.small}>Preview: {offers.message} Showing the website&apos;s prices.</Text> : null}

        <View style={styles.plans}>
          {shown.map((o) => {
            const isOn = o.tier.id === tier;
            return (
              <Pressable
                key={o.productId}
                accessibilityRole="radio"
                accessibilityState={{ checked: isOn }}
                accessibilityLabel={`${o.tier.label}: ${o.tier.swapsPerMonth} swaps a month, ${o.priceString} a ${PER[o.period]}${isCurrent(o) ? ". Your current plan" : ""}`}
                onPress={() => setTier(o.tier.id)}
                style={[styles.plan, isOn && styles.planOn]}
              >
                <View style={[styles.radio, isOn && styles.radioOn]}>{isOn ? <View style={styles.radioDot} /> : null}</View>
                <View style={styles.fill}>
                  <View style={styles.countRow}>
                    <Text style={styles.count}>{o.tier.swapsPerMonth}</Text>
                    <Text style={styles.countUnit}>swaps a month</Text>
                  </View>
                  <Text style={styles.planName}>
                    {o.tier.label}
                    {isCurrent(o) ? <Text style={styles.currentTag}>{"  ·  Current plan"}</Text> : null}
                  </Text>
                </View>
                <View style={styles.priceCol}>
                  {o.tier.isBestValue ? <Text style={styles.badge}>Best value</Text> : null}
                  <Text style={styles.price}>{o.priceString}</Text>
                  <Text style={styles.per}>per {PER[o.period]}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {notice ? (
          <Text style={styles.notice} accessibilityLiveRegion="polite">
            {notice}
          </Text>
        ) : null}

        <Button
          label={
            !chosen
              ? "Subscribe"
              : isCurrent(chosen)
                ? "This is your plan"
                : `${current ? "Switch to" : "Subscribe to"} ${chosen.tier.label} · ${chosen.priceString}/${PER[chosen.period] === "month" ? "mo" : "yr"}`
          }
          isBusy={busy === "buy"}
          disabled={!chosen || isCurrent(chosen) || busy !== null}
          onPress={() => void onBuy()}
        />
        {/* Apple requires the renewal terms next to the button. */}
        <Text style={styles.small}>
          Renews automatically every {PER[period]} until you cancel. Cancel anytime in Settings › your name › Subscriptions. Swaps you
          don&apos;t use don&apos;t carry over to the next month.
        </Text>
        <Pressable accessibilityRole="button" disabled={busy !== null} onPress={() => void onRestore()} style={styles.restore}>
          {busy === "restore" ? <ActivityIndicator color={colors.fg} /> : <Text style={styles.restoreText}>Restore purchases</Text>}
        </Pressable>
        <LegalLinks />
        {mode === "gate" && me.status === "signed-in" ? (
          <Text style={styles.signedIn}>
            Signed in as {me.email ?? me.name ?? "you"}.{" "}
            <Text style={styles.link} accessibilityRole="link" onPress={() => router.push("/manage-account")}>
              Account
            </Text>
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.md, gap: space.md, paddingBottom: space.xl },
  fill: { flex: 1 },
  close: { alignSelf: "flex-end", paddingVertical: space.xs },
  closeText: { fontFamily: fonts.medium, fontSize: 16, color: colors.fg },
  brand: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: space.sm },
  wordmark: { fontFamily: fonts.semibold, fontSize: 22, letterSpacing: -0.5, color: colors.fg },
  title: { ...headline(38), marginTop: space.md },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23, color: colors.muted, marginTop: -space.xs },
  toggle: { flexDirection: "row", padding: 4, borderRadius: 999, backgroundColor: colors.surface, alignSelf: "flex-start" },
  toggleItem: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 36, paddingHorizontal: 16, borderRadius: 999 },
  toggleOn: { backgroundColor: colors.fg },
  toggleText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.muted },
  toggleTextOn: { color: colors.bg },
  toggleSave: { fontFamily: fonts.semibold, fontSize: 12, color: colors.accentInk },
  loading: { marginVertical: space.lg },
  plans: { gap: space.sm + 4 },
  plan: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  planOn: { borderColor: colors.accent, borderWidth: 2, paddingVertical: space.md - 1, paddingHorizontal: space.md - 1 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  radioOn: { borderColor: colors.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  countRow: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  count: { ...headline(32), fontVariant: ["tabular-nums"] },
  countUnit: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted },
  planName: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted, marginTop: 4 },
  currentTag: { color: colors.accentInk },
  priceCol: { alignItems: "flex-end", gap: 2 },
  badge: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.accentInk,
    backgroundColor: "rgba(74,112,181,0.18)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 4,
  },
  price: { fontFamily: fonts.semibold, fontSize: 19, color: colors.fg, fontVariant: ["tabular-nums"] },
  per: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  notice: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21, color: colors.fg },
  small: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.muted },
  restore: { alignSelf: "center", paddingVertical: space.xs },
  unavailable: { gap: space.xs },
  retry: { alignSelf: "flex-start", paddingVertical: space.xs },
  restoreText: { fontFamily: fonts.medium, fontSize: 15, color: colors.fg },
  signedIn: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, textAlign: "center" },
  link: { fontFamily: fonts.medium, color: colors.accentInk },
});
