import { getPlanTier } from "@retrofit/core";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { manageSubscription } from "@/lib/purchases";
import { useAccount } from "@/lib/use-account";
import { colors, fonts, radius, space } from "@/theme";
import { Button } from "./button";

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/** The plan on the Account page: what it gives, what's left this month, and where to manage it. */
export function PlanCard() {
  const me = useAccount();
  if (me.status !== "signed-in") return null;
  const plan = me.plan;

  if (!plan) {
    // Only behind the paywall (app/manage-account.tsx): the plans are one step back.
    return (
      <View style={styles.card}>
        <Text style={styles.title}>No plan yet</Text>
        <Text style={styles.body}>Pick a plan to start swapping.</Text>
        <Button label="See plans" onPress={() => router.back()} />
      </View>
    );
  }

  const tier = getPlanTier(plan.tier);
  const left = me.credits ?? 0;
  const status = plan.hasBillingIssue
    ? "There's a problem with your payment. Update it to keep your plan."
    : plan.willRenew
      ? `Renews ${day(plan.expiresAt)}`
      : `Ends ${day(plan.expiresAt)}. It won't renew.`;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>
          {tier?.label ?? plan.tier} plan<Text style={styles.period}>{`  ·  ${plan.period === "monthly" ? "Monthly" : "Yearly"}`}</Text>
        </Text>
        <Text style={styles.manage} accessibilityRole="button" onPress={() => void manageSubscription(plan)}>
          Manage
        </Text>
      </View>
      <View style={styles.meter} accessibilityLabel={`${left} of ${plan.swapsPerMonth} swaps left this month`}>
        <View style={[styles.meterFill, { width: `${Math.min(100, (left / Math.max(1, plan.swapsPerMonth)) * 100)}%` }]} />
      </View>
      <Text style={styles.body}>
        <Text style={styles.strong}>{left}</Text> of {plan.swapsPerMonth} swaps left this month
      </Text>
      <Text style={[styles.small, plan.hasBillingIssue && styles.warn]}>{status}</Text>
      <Button label="Change plan" variant="quiet" onPress={() => router.push("/buy")} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, gap: space.sm },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  title: { fontFamily: fonts.semibold, fontSize: 18, color: colors.fg },
  period: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted },
  manage: { fontFamily: fonts.medium, fontSize: 15, color: colors.accentInk, padding: space.xs },
  meter: { height: 6, borderRadius: 3, backgroundColor: colors.surface2, overflow: "hidden", marginTop: space.xs },
  meterFill: { height: "100%", borderRadius: 3, backgroundColor: colors.accent },
  body: { fontFamily: fonts.regular, fontSize: 15, color: colors.muted },
  strong: { fontFamily: fonts.semibold, color: colors.fg },
  small: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  warn: { color: colors.fg, fontFamily: fonts.medium },
});
