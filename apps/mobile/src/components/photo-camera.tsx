import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { preparePhoto, type Photo } from "@/lib/photo";
import { colors, display, fonts, radius, space } from "@/theme";

export type PhotoSource = "camera" | "library";

type Props = {
  facing: "front" | "back";
  /** What to shoot, shown over the camera. */
  cue?: { label: string; cue: string };
  /** Seconds between the tap and the photo, so there's time to step back. */
  countdownSec?: number;
  /** Clothing is live camera only: never pass true for it (the server can't tell). */
  allowLibrary: boolean;
  onPhoto: (photo: Photo, source: PhotoSource) => void;
  /** Shows a Close button (for a full-screen camera). */
  onClose?: () => void;
};

/** The live camera with a shutter, an optional countdown and an optional photo library button. */
export function PhotoCamera({ facing, cue, countdownSec = 0, allowLibrary, onPhoto, onClose }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [isReady, setIsReady] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const take = async () => {
    if (!camera.current || isBusy) return;
    setIsBusy(true);
    setError(null);
    try {
      const shot = await camera.current.takePictureAsync({ quality: 1, shutterSound: false });
      onPhoto(await preparePhoto(shot.uri, shot.width, shot.height, true), "camera");
    } catch {
      setError("Couldn't take the photo. Please try again.");
      setIsBusy(false);
    }
  };

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
    if (!allowLibrary) return;
    setError(null);
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset) return;
    try {
      onPhoto(await preparePhoto(asset.uri, asset.width, asset.height), "library");
    } catch {
      setError("That photo couldn't be opened. Please pick another one.");
    }
  };

  if (!permission) return <View style={styles.camera} />;
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.gate}>
        <View style={styles.fill}>
          <Text style={styles.title}>Camera access</Text>
          <Text style={styles.body}>Scryle needs the camera to take the photo you want to restyle.</Text>
        </View>
        {permission.canAskAgain ? (
          <Button label="Allow camera" onPress={() => void requestPermission()} />
        ) : (
          <Button label="Open Settings" onPress={() => void Linking.openSettings()} />
        )}
        {allowLibrary ? <Button label="Choose a photo instead" variant="quiet" onPress={() => void pickFromLibrary()} /> : null}
        {onClose ? <Button label="Close" variant="quiet" onPress={onClose} /> : null}
      </SafeAreaView>
    );
  }

  const onShutter = () => (countdownSec > 0 ? setCountdown(countdownSec) : void take());

  return (
    <View style={styles.camera}>
      <CameraView ref={camera} style={StyleSheet.absoluteFill} facing={facing} onCameraReady={() => setIsReady(true)} />
      <SafeAreaView edges={["top"]} style={styles.top}>
        {onClose ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Close camera" onPress={onClose} hitSlop={8} style={styles.close}>
            <Text style={styles.sideText}>Close</Text>
          </Pressable>
        ) : null}
        {cue ? (
          <View style={styles.cue}>
            <Text style={styles.cueTitle}>{cue.label}</Text>
            <Text style={styles.cueBody}>{cue.cue}</Text>
          </View>
        ) : null}
      </SafeAreaView>
      {countdown !== null ? <Text style={styles.countdown}>{countdown}</Text> : null}
      <SafeAreaView edges={["bottom"]} style={styles.controls}>
        {error ? <Text style={styles.cameraError}>{error}</Text> : null}
        <View style={styles.controlRow}>
          <View style={styles.side}>
            {allowLibrary ? (
              <Pressable accessibilityRole="button" onPress={() => void pickFromLibrary()} style={styles.sideButton}>
                <Text style={styles.sideText}>Library</Text>
              </Pressable>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={countdownSec ? `Take photo in ${countdownSec} seconds` : "Take photo"}
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

const styles = StyleSheet.create({
  fill: { flex: 1 },
  gate: { flex: 1, padding: space.lg, gap: space.md, backgroundColor: colors.bg },
  title: { ...display, fontSize: 32, lineHeight: 35, marginTop: space.lg },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23, color: colors.muted, marginTop: space.sm },
  camera: { flex: 1, backgroundColor: colors.device },
  top: { position: "absolute", top: 0, left: 0, right: 0, padding: space.md, gap: space.sm },
  close: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: space.md,
    borderRadius: 22,
    backgroundColor: "rgba(12,12,11,0.55)",
  },
  cue: { backgroundColor: "rgba(12,12,11,0.7)", borderRadius: radius.md, padding: space.md, gap: 2 },
  cueTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.fg },
  cueBody: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 19, color: colors.fg },
  countdown: { position: "absolute", alignSelf: "center", top: "40%", fontFamily: fonts.bold, fontSize: 96, color: "#ffffff" },
  controls: { position: "absolute", left: 0, right: 0, bottom: 0, paddingBottom: space.md },
  controlRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.lg },
  side: { width: 88, alignItems: "center" },
  sideButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: space.sm },
  sideText: { fontFamily: fonts.semibold, fontSize: 15, color: "#ffffff" },
  shutter: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: "#ffffff", alignItems: "center", justifyContent: "center" },
  shutterPressed: { transform: [{ scale: 0.95 }] },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#ffffff" },
  off: { opacity: 0.5 },
  cameraError: { fontFamily: fonts.medium, fontSize: 14, color: "#ffffff", textAlign: "center", marginBottom: space.sm },
});
