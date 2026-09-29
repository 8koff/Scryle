import { Image, type ImageSource } from "expo-image";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { colors, fonts } from "@/theme";

type Props = {
  before: ImageSource | number;
  after: ImageSource | number;
  style?: StyleProp<ViewStyle>;
  /**
   * true: drag anywhere on the picture. false: only the handle moves it, so a swipe on the
   * picture still scrolls the list it sits in (the home carousel).
   */
  dragAnywhere?: boolean;
  /** One short sweep after it appears, so people see it can be dragged. */
  hint?: boolean;
  accessibilityLabel?: string;
};

/** The web's compare slider: before on the left, the AI edit on the right, always labelled. */
const HANDLE_HIT = 56;
const START = 0.5;

export function CompareSlider({ before, after, style, dragAnywhere = false, hint = false, accessibilityLabel }: Props) {
  const [width, setWidth] = useState(0);
  const split = useSharedValue(START);
  const dragStart = useSharedValue(START);
  const isReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!hint || isReducedMotion || !width) return;
    split.set(withDelay(
      600,
      withSequence(
        withTiming(0.78, { duration: 700, easing: Easing.inOut(Easing.cubic) }),
        withTiming(START, { duration: 800, easing: Easing.inOut(Easing.cubic) }),
      ),
    ));
  }, [hint, isReducedMotion, width, split]);

  const pan = Gesture.Pan()
    .activeOffsetX([-6, 6])
    // A mostly-up-or-down swipe is a page scroll, not a slider drag.
    .failOffsetY([-12, 12])
    .onBegin((e) => {
      cancelAnimation(split);
      // Anywhere: jump to the finger. Handle only: keep the grab point, so it doesn't jump.
      if (dragAnywhere && width) split.set(Math.min(1, Math.max(0, e.x / width)));
      dragStart.set(split.get());
    })
    .onUpdate((e) => {
      if (!width) return;
      split.set(Math.min(1, Math.max(0, dragStart.get() + e.translationX / width)));
    });

  const afterClip = useAnimatedStyle(() => ({ left: split.get() * width }));
  const afterImage = useAnimatedStyle(() => ({ left: -split.get() * width }));
  const line = useAnimatedStyle(() => ({ transform: [{ translateX: split.get() * width - HANDLE_HIT / 2 }] }));

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const handle = (
    <Animated.View style={[styles.handleHit, line]}>
      <View style={styles.line} />
      <View style={styles.knob}>
        <Text style={styles.knobArrows}>‹ ›</Text>
      </View>
    </Animated.View>
  );

  const picture = (
    <View
      style={[styles.frame, style]}
      onLayout={onLayout}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel ?? "Before and after. The right side is an AI edit."}
    >
      <Image source={before} style={StyleSheet.absoluteFill} contentFit="cover" />
      <Animated.View style={[styles.afterClip, afterClip]}>
        <Animated.View style={[styles.afterInner, { width }, afterImage]}>
          <Image source={after} style={StyleSheet.absoluteFill} contentFit="cover" />
        </Animated.View>
      </Animated.View>
      <Text style={[styles.tag, styles.tagBefore]}>Before</Text>
      {/* Every "after" in the app is made by AI, and the label says so. */}
      <Text style={[styles.tag, styles.tagAfter]}>After (AI edit)</Text>
      {dragAnywhere ? handle : <GestureDetector gesture={pan}>{handle}</GestureDetector>}
    </View>
  );

  return dragAnywhere ? <GestureDetector gesture={pan}>{picture}</GestureDetector> : picture;
}

const styles = StyleSheet.create({
  frame: { overflow: "hidden", backgroundColor: colors.surface2 },
  afterClip: { position: "absolute", top: 0, bottom: 0, right: 0, overflow: "hidden" },
  afterInner: { position: "absolute", top: 0, bottom: 0 },
  handleHit: { position: "absolute", top: 0, bottom: 0, left: 0, width: HANDLE_HIT, alignItems: "center", justifyContent: "center" },
  line: { position: "absolute", top: 0, bottom: 0, width: 2, backgroundColor: "#ffffff" },
  knob: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  knobArrows: { color: colors.onAccent, fontFamily: fonts.bold, fontSize: 15, marginTop: -2 },
  tag: {
    position: "absolute",
    bottom: 12,
    fontFamily: fonts.semibold,
    fontSize: 11,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  tagBefore: { left: 12, color: "#ffffff", backgroundColor: "rgba(0,0,0,0.55)" },
  tagAfter: { right: 12, color: "#000000", backgroundColor: "#ffffff" },
});
