import { getPack, isPackId } from "@retrofit/core";
import { Image } from "expo-image";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AiConsentGate } from "@/components/ai-consent-gate";
import { Button } from "@/components/button";
import { PhotoCamera, type PhotoSource } from "@/components/photo-camera";
import type { Photo } from "@/lib/photo";
import { useScan } from "@/lib/use-scan";
import { colors, fonts, headline, radius, space } from "@/theme";

type Step =
  | { kind: "adult" }
  | { kind: "camera" }
  | { kind: "review"; photo: Photo; source: PhotoSource; error?: string }
  | { kind: "scanning"; photo: Photo; source: PhotoSource };

/**
 * Take (or pick) the photo, check it, and send it to be read. The first time, the person allows
 * photos to go to our AI partners. Clothing is live camera only and asks for 18+ first; the server
 * checks all three again.
 */
export default function Capture() {
  const params = useLocalSearchParams<{ pack: string }>();
  const pack = getPack(typeof params.pack === "string" && isPackId(params.pack) ? params.pack : "room");
  const [step, setStep] = useState<Step>(pack.capture.requireAdult ? { kind: "adult" } : { kind: "camera" });
  const [isAdultConfirmed, setIsAdultConfirmed] = useState(false);
  const runScan = useScan();

  const scan = async (photo: Photo, source: PhotoSource) => {
    if (step.kind === "scanning") return;
    setStep({ kind: "scanning", photo, source });
    const error = await runScan(pack.id, photo, isAdultConfirmed);
    if (error) setStep({ kind: "review", photo, source, error });
  };

  return (
    <View style={styles.screen}>
      {/* No going back mid-scan: the answer would have nowhere to land. */}
      <Stack.Screen options={{ title: pack.label, gestureEnabled: step.kind !== "scanning", headerBackVisible: step.kind !== "scanning" }} />
      <AiConsentGate>
        {step.kind === "adult" ? (
          <AdultGate
            onConfirm={() => {
              setIsAdultConfirmed(true);
              setStep({ kind: "camera" });
            }}
          />
        ) : step.kind === "camera" ? (
          <PhotoCamera
            facing={pack.capture.camera === "user" ? "front" : "back"}
            cue={pack.capture.steps[0]}
            countdownSec={pack.capture.countdownSec}
            allowLibrary={pack.capture.allowUpload}
            onPhoto={(photo, source) => setStep({ kind: "review", photo, source })}
          />
        ) : (
          <Review
            photo={step.photo}
            source={step.source}
            category={pack.label}
            isScanning={step.kind === "scanning"}
            error={step.kind === "review" ? step.error : undefined}
            onRetake={() => setStep({ kind: "camera" })}
            onUse={() => void scan(step.photo, step.source)}
          />
        )}
      </AiConsentGate>
    </View>
  );
}

function AdultGate({ onConfirm }: { onConfirm: () => void }) {
  return (
    <SafeAreaView style={styles.gate} edges={["bottom"]}>
      <View style={styles.fill}>
        <Text style={styles.title}>Before you start</Text>
        <Text style={styles.body}>
          Clothing uses your live camera, so you only ever dress yourself. The AI changes your clothes, never your face or body.
        </Text>
        <Text style={styles.body}>Swimwear and underwear aren&apos;t allowed.</Text>
      </View>
      <Button label="I'm 18 or older" onPress={onConfirm} />
      <Button label="Go back" variant="quiet" onPress={() => router.back()} />
    </SafeAreaView>
  );
}

type ReviewProps = { photo: Photo; source: PhotoSource; category: string; isScanning: boolean; error?: string; onRetake: () => void; onUse: () => void };

function Review({ photo, source, category, isScanning, error, onRetake, onUse }: ReviewProps) {
  return (
    <SafeAreaView style={styles.review} edges={["bottom"]}>
      <View style={styles.reviewHead}>
        <Text style={styles.eyebrow}>{category} · {source === "camera" ? "Camera" : "Library"}</Text>
        <Text style={styles.reviewTitle}>Use this photo?</Text>
      </View>
      <View style={styles.previewFrame}>
        <Image source={{ uri: photo.uri }} style={styles.preview} contentFit="contain" accessibilityLabel="Photo to scan" />
      </View>
      {isScanning ? (
        <View style={styles.scanning}>
          <ActivityIndicator color={colors.fg} />
          <Text style={styles.scanningText}>Finding what you can swap…</Text>
        </View>
      ) : (
        <View style={styles.reviewActions}>
          {error ? (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}
          <Button label="Use this photo" onPress={onUse} />
          <Button label="Retake" variant="quiet" onPress={onRetake} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  fill: { flex: 1 },
  gate: { flex: 1, padding: space.lg, gap: space.md },
  title: { ...headline(32), marginTop: space.lg },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23, color: colors.muted, marginTop: space.sm },
  review: { flex: 1, paddingHorizontal: space.md, paddingTop: space.lg, paddingBottom: space.md, gap: space.md },
  reviewHead: { gap: space.sm },
  eyebrow: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted },
  reviewTitle: { ...headline(32) },
  previewFrame: { flex: 1, minHeight: 0, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.surface2 },
  preview: { width: "100%", height: "100%" },
  reviewActions: { gap: space.sm },
  scanning: { alignItems: "center", flexDirection: "row", justifyContent: "center", gap: space.sm, minHeight: 112 },
  scanningText: { fontFamily: fonts.medium, fontSize: 15, color: colors.fg },
  error: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21, color: colors.fg, textAlign: "center" },
});
