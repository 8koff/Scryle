import { getPack, isPackId, type Pack } from "@retrofit/core";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { createBuild } from "@/lib/builds";
import { preparePhoto, type Photo } from "@/lib/photo";
import { scanPhoto } from "@/lib/scan";
import { colors, display, fonts, radius, space } from "@/theme";

type Step =
  | { kind: "adult" }
  | { kind: "camera" }
  | { kind: "review"; photo: Photo; error?: string }
  | { kind: "scanning"; photo: Photo };

/**
 * Take (or pick) the photo, check it, and send it to be read. Clothing is live camera only and
 * asks for 18+ first; the server checks both again.
 */
export default function Capture() {
  const params = useLocalSearchParams<{ pack: string }>();
  const pack = getPack(typeof params.pack === "string" && isPackId(params.pack) ? params.pack : "room");
  const [step, setStep] = useState<Step>(pack.capture.requireAdult ? { kind: "adult" } : { kind: "camera" });
  const [isAdultConfirmed, setIsAdultConfirmed] = useState(false);
  const isScanning = useRef(false);
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const scan = async (photo: Photo) => {
    // A ref, not state: two taps in the same frame must not send two paid scans.
    if (isScanning.current) return;
    isScanning.current = true;
    setStep({ kind: "scanning", photo });
    const result = await scanPhoto(pack.id, photo, isAdultConfirmed);
    isScanning.current = false;
    // Gone from this screen: don't jump to the studio from wherever the person is now.
    if (!isMounted.current) return;
    if (result.status === "error") return setStep({ kind: "review", photo, error: result.message });
    const build = createBuild(pack.id, photo.uri, result.data);
    router.replace({ pathname: "/studio/[id]", params: { id: build.id } });
  };

  return (
    <View style={styles.screen}>
      {/* No going back mid-scan: the answer would have nowhere to land. */}
      <Stack.Screen options={{ title: pack.label, gestureEnabled: step.kind !== "scanning", headerBackVisible: step.kind !== "scanning" }} />
      {step.kind === "adult" ? (
        <AdultGate
          onConfirm={() => {
            setIsAdultConfirmed(true);
            setStep({ kind: "camera" });
          }}
        />
      ) : step.kind === "camera" ? (
        <Camera pack={pack} onPhoto={(photo) => setStep({ kind: "review", photo })} />
      ) : (
        <Review
          photo={step.photo}
          isScanning={step.kind === "scanning"}
          error={step.kind === "review" ? step.error : undefined}
          onRetake={() => setStep({ kind: "camera" })}
          onUse={() => void scan(step.photo)}
        />
      )}
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

function Camera({ pack, onPhoto }: { pack: Pack; onPhoto: (photo: Photo) => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [isReady, setIsReady] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const step = pack.capture.steps[0];
  const delay = pack.capture.countdownSec ?? 0;

  const take = async () => {
    if (!camera.current || isBusy) return;
    setIsBusy(true);
    setError(null);
    try {
      const shot = await camera.current.takePictureAsync({ quality: 1, shutterSound: false });
      onPhoto(await preparePhoto(shot.uri, shot.width, shot.height));
    } catch {
      setError("Couldn't take the photo. Please try again.");
      setIsBusy(false);
    }
  };

  // Clothing counts down, so there's time to step back from the phone.
  useEffect(() => {
    if (countdown === null) return;
    const timer = setTimeout(() => {
      if (countdown > 1) return setCountdown(countdown - 1);
      setCountdown(null);
      void take();
    }, 1000);
    return () => clearTimeout(timer);
    // `take` reads the latest camera ref; re-running only on the tick is intended.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown]);

  const pickFromLibrary = async () => {
    // Clothing is live camera only (the button isn't shown either; the server can't tell).
    if (!pack.capture.allowUpload) return;
    setError(null);
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset) return;
    try {
      onPhoto(await preparePhoto(asset.uri, asset.width, asset.height));
    } catch {
      setError("That photo couldn't be opened. Please pick another one.");
    }
  };

  if (!permission) return <View style={styles.camera} />;
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.gate} edges={["bottom"]}>
        <View style={styles.fill}>
          <Text style={styles.title}>Camera access</Text>
          <Text style={styles.body}>Scryle needs the camera to take the photo you want to restyle.</Text>
        </View>
        {permission.canAskAgain ? (
          <Button label="Allow camera" onPress={() => void requestPermission()} />
        ) : (
          <Button label="Open Settings" onPress={() => void Linking.openSettings()} />
        )}
        {pack.capture.allowUpload ? <Button label="Choose a photo instead" variant="quiet" onPress={() => void pickFromLibrary()} /> : null}
      </SafeAreaView>
    );
  }

  const onShutter = () => (delay > 0 ? setCountdown(delay) : void take());

  return (
    <View style={styles.camera}>
      <CameraView
        ref={camera}
        style={StyleSheet.absoluteFill}
        facing={pack.capture.camera === "user" ? "front" : "back"}
        onCameraReady={() => setIsReady(true)}
      />
      {step ? (
        <View style={styles.cue}>
          <Text style={styles.cueTitle}>{step.label}</Text>
          <Text style={styles.cueBody}>{step.cue}</Text>
        </View>
      ) : null}
      {countdown !== null ? <Text style={styles.countdown}>{countdown}</Text> : null}
      <SafeAreaView edges={["bottom"]} style={styles.controls}>
        {error ? <Text style={styles.cameraError}>{error}</Text> : null}
        <View style={styles.controlRow}>
          <View style={styles.side}>
            {pack.capture.allowUpload ? (
              <Pressable accessibilityRole="button" onPress={() => void pickFromLibrary()} style={styles.sideButton}>
                <Text style={styles.sideText}>Library</Text>
              </Pressable>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={delay ? `Take photo in ${delay} seconds` : "Take photo"}
            disabled={!isReady || isBusy || countdown !== null}
            onPress={onShutter}
            style={({ pressed }) => [styles.shutter, pressed && styles.shutterPressed, (!isReady || isBusy) && styles.off]}
          >
            {isBusy ? <ActivityIndicator color={colors.bg} /> : <View style={styles.shutterInner} />}
          </Pressable>
          <View style={styles.side}>
            {countdown !== null ? (
              <Pressable accessibilityRole="button" onPress={() => setCountdown(null)} style={styles.sideButton}>
                <Text style={styles.sideText}>Cancel</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

type ReviewProps = { photo: Photo; isScanning: boolean; error?: string; onRetake: () => void; onUse: () => void };

function Review({ photo, isScanning, error, onRetake, onUse }: ReviewProps) {
  return (
    <SafeAreaView style={styles.review} edges={["bottom"]}>
      <View style={styles.fill}>
        <Image source={{ uri: photo.uri }} style={[styles.preview, { aspectRatio: photo.width / photo.height }]} contentFit="contain" />
      </View>
      {isScanning ? (
        <View style={styles.scanning}>
          <ActivityIndicator color={colors.fg} />
          <Text style={styles.body}>Reading your photo…</Text>
        </View>
      ) : (
        <>
          {error ? (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}
          <Button label="Use this photo" onPress={onUse} />
          <Button label="Retake" variant="quiet" onPress={onRetake} />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  fill: { flex: 1 },
  gate: { flex: 1, padding: space.lg, gap: space.md },
  title: { ...display, fontSize: 32, lineHeight: 35, marginTop: space.lg },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23, color: colors.muted, marginTop: space.sm },
  camera: { flex: 1, backgroundColor: colors.device },
  cue: {
    position: "absolute",
    top: space.md,
    left: space.md,
    right: space.md,
    backgroundColor: "rgba(12,12,11,0.7)",
    borderRadius: radius.md,
    padding: space.md,
    gap: 2,
  },
  cueTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.fg },
  cueBody: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 19, color: colors.fg },
  countdown: {
    position: "absolute",
    alignSelf: "center",
    top: "40%",
    fontFamily: fonts.bold,
    fontSize: 96,
    color: "#ffffff",
  },
  controls: { position: "absolute", left: 0, right: 0, bottom: 0, paddingBottom: space.md },
  controlRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.lg },
  side: { width: 88, alignItems: "center" },
  sideButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: space.sm },
  sideText: { fontFamily: fonts.semibold, fontSize: 15, color: "#ffffff" },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterPressed: { transform: [{ scale: 0.95 }] },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#ffffff" },
  off: { opacity: 0.5 },
  cameraError: { fontFamily: fonts.medium, fontSize: 14, color: "#ffffff", textAlign: "center", marginBottom: space.sm },
  review: { flex: 1, padding: space.md, gap: space.md },
  preview: { width: "100%", maxHeight: "100%", borderRadius: radius.lg, backgroundColor: colors.surface2 },
  scanning: { alignItems: "center", gap: space.sm, paddingVertical: space.lg },
  error: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21, color: colors.fg, textAlign: "center" },
});
