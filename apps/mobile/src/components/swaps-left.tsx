import { Alert, StyleSheet, Text, View } from "react-native";
import { BUY_SOON } from "@/lib/packs";
import { useAccount } from "@/lib/use-account";
import { colors, fonts, radius, space } from "@/theme";
import { Button } from "./button";

/** How many swaps are left, with Buy next to it. */
export function SwapsLeft() {
  const state = useAccount();
  const credits = state.status === "signed-in" ? state.credits : null;
  const label = credits === null ? "Loading your swaps…" : `${credits} ${credits === 1 ? "swap" : "swaps"} left`;

  return (
    <View style={styles.bar}>
      <Text style={styles.count} accessibilityLiveRegion="polite">
        {label}
      </Text>
      <Button label="Buy" onPress={() => Alert.alert(BUY_SOON.title, BUY_SOON.body)} style={styles.buy} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingLeft: space.md,
    padding: space.sm,
  },
  count: { fontFamily: fonts.medium, fontSize: 16, color: colors.fg },
  buy: { minHeight: 40, paddingHorizontal: space.lg },
});
