import type { Pack, PackId } from "@retrofit/core";
import { Image } from "expo-image";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { PhotoCamera, type PhotoSource } from "@/components/photo-camera";
import { PressableScale } from "@/components/pressable-scale";
import { PACK_COVERS } from "@/lib/packs";
import { packsFor } from "@/lib/snap-packs";
import type { Photo } from "@/lib/photo";
import { useScan } from "@/lib/use-scan";
import { colors, display, fonts, radius, space } from "@/theme";

type Step =
  | { kind: "camera" }
  | { kind: "pick"; photo: Photo; source: PhotoSource; scanning?: PackId; error?: string };

/**
 * Camera first, category second: the big button on Home opens this. Clothing never takes a
 * photo from here: it needs the 18+ check and the selfie camera, so it opens its own flow.
 */
export default function Snap() {
  const [step, setStep] = useState<Step>({ kind: "camera" });
  const runScan = useScan();

  const choose = async (pack: PackId) => {
    if (step.kind !== "pick" || step.scanning) return;
    setStep({ ...step, scanning: pack, error: undefined });
    const error = await runScan(pack, step.photo, false);
    if (error) setStep({ ...step, scanning: undefined, error });
  };

  const isScanning = step.kind === "pick" && Boolean(step.scanning);
  return (
    <View style={styles.screen}>
      {/* No swiping away mid-scan: the answer would have nowhere to land. */}
      <Stack.Screen options={{ gestureEnabled: !isScanning }} />
      {step.kind === "camera" ? (
        <PhotoCamera
          facing="back"
          allowLibrary
          onPhoto={(photo, source) => setStep({ kind: "pick", photo, source })}
          onClose={() => router.back()}
        />
      ) : (
        <Pick
          photo={step.photo}
          packs={packsFor(step.source)}
          scanning={step.scanning}
          error={step.error}
          onChoose={(pack) => void choose(pack)}
          onRetake={() => setStep({ kind: "camera" })}
        />
      )}
    </View>
  );
}

type PickProps = {
  photo: Photo;
  packs: Pack[];
  scanning?: PackId;
  error?: string;
  onChoose: (pack: PackId) => void;
  onRetake: () => void;
};

function Pick({ photo, packs, scanning, error, onChoose, onRetake }: PickProps) {
  return (
    <SafeAreaView style={styles.pick}>
      <Animated.View entering={FadeIn.duration(220)} style={styles.photoBox}>
        <Image source={{ uri: photo.uri }} style={styles.photo} contentFit="contain" />
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(260).delay(60)} style={styles.sheet}>
        <Text style={styles.title}>{scanning ? "Reading your photo…" : "What's in your photo?"}</Text>
        {error ? (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}

        <View style={styles.choices}>
          {packs.map((pack) => (
            <Choice key={pack.id} pack={pack} isBusy={scanning === pack.id} isOff={Boolean(scanning)} onPress={() => onChoose(pack.id)} />
          ))}
        </View>

        {scanning ? null : (
          <>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Trying on clothes? Use the selfie camera"
              onPress={() => router.replace({ pathname: "/capture/[pack]", params: { pack: "clothing" } })}
              style={styles.clothing}
            >
              <Text style={styles.clothingText}>Trying on clothes?</Text>
              <Text style={styles.clothingLink}>Use the selfie camera</Text>
            </PressableScale>
            <Button label="Retake" variant="quiet" onPress={onRetake} />
          </>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

type ChoiceProps = { pack: Pack; isBusy: boolean; isOff: boolean; onPress: () => void };

function Choice({ pack, isBusy, isOff, onPress }: ChoiceProps) {
  const cover = PACK_COVERS[pack.id];
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${pack.label}. ${pack.tagline}`}
      accessibilityState={{ disabled: isOff, busy: isBusy }}
      disabled={isOff}
      onPress={onPress}
      style={[styles.choice, isOff && !isBusy && styles.off]}
    >
      <Image source={cover.after ?? cover.before} style={styles.choiceImage} contentFit="cover" />
      <View style={styles.choiceText}>
        <Text style={styles.choiceTitle}>{pack.label}</Text>
        <Text style={styles.choiceBody} numberOfLines={1}>
          {cover.examples}
        </Text>
      </View>
      {isBusy ? <ActivityIndicator color={colors.fg} /> : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.device },
  pick: { flex: 1, backgroundColor: colors.bg },
  photoBox: { flex: 1, padding: space.md, paddingBottom: 0 },
  photo: { flex: 1, borderRadius: radius.lg, backgroundColor: colors.device },
  sheet: { padding: space.md, gap: space.md },
  title: { ...display, fontSize: 26, lineHeight: 30 },
  error: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21, color: colors.fg },
  choices: { gap: space.sm },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 68,
    padding: space.sm,
    paddingRight: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  choiceImage: { width: 52, height: 52, borderRadius: radius.sm, backgroundColor: colors.surface2 },
  choiceText: { flex: 1, gap: 2 },
  choiceTitle: { fontFamily: fonts.semibold, fontSize: 17, color: colors.fg },
  choiceBody: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  off: { opacity: 0.45 },
  clothing: { flexDirection: "row", justifyContent: "center", flexWrap: "wrap", gap: 6, paddingVertical: space.xs },
  clothingText: { fontFamily: fonts.regular, fontSize: 15, color: colors.muted },
  clothingLink: { fontFamily: fonts.semibold, fontSize: 15, color: colors.accentInk },
});
