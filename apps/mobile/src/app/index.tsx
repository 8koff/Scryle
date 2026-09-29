import { PACKS, type PackId } from "@retrofit/core";
import { Image } from "expo-image";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { account, useAccount } from "@/lib/use-account";
import { colors, display, fonts, radius, space } from "@/theme";

/** One picture and a few example parts per category (same as the web's PACK_COVERS). */
const COVERS: Record<PackId, { image: number; examples: string }> = {
  clothing: { image: require("../../assets/covers/clothing.jpg"), examples: "Dresses, shirts, jeans, sneakers, bags" },
  car: { image: require("../../assets/covers/car.jpg"), examples: "Wheels, paint, tint, lights, ride height" },
  room: { image: require("../../assets/covers/room.jpg"), examples: "Sofas, rugs, lamps, wall colour" },
  anything: { image: require("../../assets/covers/anything.jpg"), examples: "Bikes, desks, gardens, gear" },
};

/** First screen: pick what to change. The camera comes next. */
export default function Home() {
  const state = useAccount();
  const credits = state.status === "signed-in" ? state.credits : null;

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>What do you want to change?</Text>
          {credits !== null ? (
            <Text style={styles.credits}>
              {credits} {credits === 1 ? "swap" : "swaps"} left
            </Text>
          ) : null}
        </View>
        {PACKS.map((pack) => (
          // Not a button yet: the camera screen comes in the next pull request.
          <View key={pack.id} accessible accessibilityLabel={`${pack.label}. ${pack.tagline}`} style={styles.tile}>
            <Image source={COVERS[pack.id].image} style={styles.cover} contentFit="cover" />
            <View style={styles.tileText}>
              <Text style={styles.tileTitle}>{pack.label}</Text>
              <Text style={styles.tileBody}>{COVERS[pack.id].examples}</Text>
            </View>
          </View>
        ))}
        <Button label="Sign out" variant="quiet" onPress={() => void account.signOut()} style={styles.signOut} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.md, gap: space.md },
  header: { paddingVertical: space.md, gap: space.sm },
  title: { ...display, fontSize: 32, lineHeight: 34 },
  credits: { fontFamily: fonts.medium, fontSize: 15, color: colors.muted },
  tile: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  cover: {
    width: 88,
    height: 88,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  tileText: { flex: 1, gap: space.xs },
  tileTitle: { fontFamily: fonts.semibold, fontSize: 19, color: colors.fg },
  signOut: { marginTop: space.lg },
  tileBody: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 19, color: colors.muted },
});
