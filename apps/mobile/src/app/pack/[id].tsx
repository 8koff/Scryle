import { getPack, isPackId, PACKS, type Pack } from "@retrofit/core";
import { Image } from "expo-image";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { CompareSlider } from "@/components/compare-slider";
import { CAMERA_SOON, PACK_COVERS } from "@/lib/packs";
import { colors, display, fonts, radius, space } from "@/theme";

/** One category: what it changes and how to take the photo. Switch category at the top. */
export default function PackPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // A bad link falls back to the first category instead of crashing.
  const pack = getPack(typeof id === "string" && isPackId(id) ? id : "room");
  const cover = PACK_COVERS[pack.id];

  return (
    <SafeAreaView style={styles.screen} edges={["bottom"]}>
      <Stack.Screen options={{ title: pack.label }} />
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
          <Text style={styles.title}>{pack.tagline}</Text>
          {pack.capture.requireAdult ? (
            <Text style={styles.rule}>Live camera only. You must be 18 or older. Swimwear and underwear aren&apos;t allowed.</Text>
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
        <Button label="Take photo" onPress={() => Alert.alert(CAMERA_SOON.title, CAMERA_SOON.body)} />
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
  switchChipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  switchText: { fontFamily: fonts.medium, fontSize: 15, color: colors.muted },
  switchTextOn: { color: colors.onAccent },
  hero: {
    width: "100%",
    aspectRatio: 4 / 5,
    borderRadius: radius.lg,
    backgroundColor: colors.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  title: { ...display, fontSize: 28, lineHeight: 31, marginTop: space.md },
  rule: {
    fontFamily: fonts.medium,
    fontSize: 15,
    lineHeight: 21,
    color: colors.fg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.md,
    marginTop: space.md,
  },
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
