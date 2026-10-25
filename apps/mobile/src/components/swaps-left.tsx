import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useAccount } from "@/lib/use-account";
import { colors, fonts } from "@/theme";
import { PressableScale } from "./pressable-scale";

/**
 * Swaps left this month as a small pill for a screen's top row, so it's seen before starting a
 * swap. The whole pill opens the plans (to upgrade when it runs low).
 */
export function SwapsLeftPill() {
  const state = useAccount();
  const credits = state.status === "signed-in" ? state.credits : null;
  if (credits === null) return null;
  const count = `${credits} ${credits === 1 ? "picture" : "pictures"} left`;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${count} this month. See plans.`}
      hitSlop={8}
      onPress={() => router.push("/buy")}
      style={[styles.pill, credits === 0 && styles.pillEmpty]}
    >
      <Text style={styles.pillCount}>{count}</Text>
      <View style={styles.pillRule} />
      <Text style={styles.pillBuy}>{credits === 0 ? "Upgrade" : "Plans"}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 34,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  // Out of swaps: the pill picks up the accent so the next step is obvious.
  pillEmpty: { borderColor: colors.accent },
  pillCount: { fontFamily: fonts.semibold, fontSize: 14, color: colors.fg, fontVariant: ["tabular-nums"] },
  pillRule: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", marginVertical: 9, backgroundColor: colors.line },
  pillBuy: { fontFamily: fonts.semibold, fontSize: 14, color: colors.accentInk },
});
