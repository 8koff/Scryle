import { getPack, isPackId, PACKS, type Pack } from "@retrofit/core";
import { Image } from "expo-image";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { CompareSlider } from "@/components/compare-slider";
import { PACK_COVERS } from "@/lib/packs";
import { colors, fonts, headline, radius, space } from "@/theme";

/** Clothing's rules (the server enforces them too), one short line each so they can be scanned. */
const ADULT_RULES = ["Live camera only, no uploads", "You must be 18 or older", "No swimwear or underwear"] as const;

/** One category: what it changes and how to take the photo. Switch category at the top. */
export default function PackPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // A bad link falls back to the first category instead of crashing.
  const pack = getPack(typeof id === "string" && isPackId(id) ? id : "room");
  const cover = PACK_COVERS[pack.id];

  return (
    <SafeAreaView style={styles.screen} edges={["bottom"]}>
      {/* The chips below already say which category this is. */}
      <Stack.Screen options={{ title: "" }} />
      <ScrollView contentContainerStyle={styles.content}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.switcher}>
          {PACKS.map((p) => (
            <SwitchChip key={p.id} pack={p} isOn={p.id === pack.id} />
          ))}
        </ScrollView>

        <View style={styles.padded}>
          {cover.after ? (
            <CompareSlider
              key={pack.id}
              before={cover.before}
              after={cover.after}
              dragAnywhere
              hint
              style={styles.hero}
              accessibilityLabel={`${pack.label} example. Left: before. Right: AI edit.`}
            />
          ) : (
            <Image source={cover.before} style={styles.hero} contentFit="cover" />
          )}
          {/* push-out: iOS moves a word down rather than leave one alone on the last line. */}
          <Text style={styles.title} lineBreakStrategyIOS="push-out">
            {pack.tagline}
          </Text>
          {pack.capture.requireAdult ? (
            <View style={styles.rules} accessibilityRole="summary">
              {ADULT_RULES.map((rule) => (
                <View key={rule} style={styles.ruleRow}>
                  <View style={styles.ruleDot} />
                  <Text style={styles.ruleText}>{rule}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <Text style={styles.heading}>What you can change</Text>
          <View style={styles.chips}>
            {pack.parts.length ? (
              pack.parts.map((part) => (
                <Text key={part.id} style={styles.chip}>
                  {part.label}
                </Text>
              ))
            ) : (
              <Text style={styles.body}>Anything in the photo. Scryle finds the parts for you.</Text>
            )}
          </View>

          <Text style={styles.heading}>How to take the photo</Text>
          {pack.capture.steps.map((step, i) => (
            <View key={step.id} style={styles.step}>
              <Text style={styles.stepNumber}>{i + 1}</Text>
              <View style={styles.stepText}>
                <Text style={styles.stepLabel}>{step.label}</Text>
                <Text style={styles.body}>{step.cue}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button label="Take photo" onPress={() => router.push({ pathname: "/capture/[pack]", params: { pack: pack.id } })} />
      </View>
    </SafeAreaView>
  );
}

function SwitchChip({ pack, isOn }: { pack: Pack; isOn: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isOn }}
      accessibilityLabel={pack.label}
      onPress={() => router.setParams({ id: pack.id })}
      style={[styles.switchChip, isOn && styles.switchChipOn]}
    >
      <Text style={[styles.switchText, isOn && styles.switchTextOn]}>{pack.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingTop: space.sm, paddingBottom: space.xl, gap: space.md },
  padded: { paddingHorizontal: space.md },
  switcher: { paddingHorizontal: space.md, gap: space.sm },
  switchChip: {
    minHeight: 40,
    paddingHorizontal: space.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    justifyContent: "center",
  },
  // Selected, not an action: the light fill the studio's chips use, so denim stays for buttons.
  switchChipOn: { backgroundColor: colors.fg, borderColor: colors.fg },
  switchText: { fontFamily: fonts.medium, fontSize: 15, color: colors.muted },
  switchTextOn: { fontFamily: fonts.semibold, color: colors.bg },
  hero: {
    width: "100%",
    // A little shorter than 4:5, so the title and rules show above the button on a phone.
    aspectRatio: 9 / 10,
    borderRadius: radius.lg,
    backgroundColor: colors.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  title: { ...headline(32), marginTop: space.lg },
  rules: { gap: 10, marginTop: space.md, padding: space.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  ruleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  ruleDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.muted },
  ruleText: { flex: 1, fontFamily: fonts.medium, fontSize: 15, lineHeight: 20, color: colors.fg },
  heading: { fontFamily: fonts.semibold, fontSize: 18, color: colors.fg, marginTop: space.lg, marginBottom: space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.fg,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 7,
    overflow: "hidden",
  },
  step: { flexDirection: "row", gap: space.md, marginBottom: space.md },
  stepNumber: { fontFamily: fonts.semibold, fontSize: 18, color: colors.accentInk, width: 20 },
  stepText: { flex: 1, gap: 2 },
  stepLabel: { fontFamily: fonts.semibold, fontSize: 16, color: colors.fg },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.muted },
  footer: { paddingHorizontal: space.md, paddingTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
});
