import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Quick and firm going in, a soft settle coming back: it feels pressed, not wobbly. */
const PRESS_IN = { duration: 90 };
const RELEASE = { damping: 18, stiffness: 320, mass: 0.6 };

type Props = Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>;
  /** How small it gets while held. Big cards move less than small buttons. */
  pressedScale?: number;
};

/**
 * A Pressable that shrinks a little while held. Runs on the UI thread (transform only), and
 * stays still when the person turned on Reduce Motion.
 */
export function PressableScale({ style, pressedScale = 0.97, onPressIn, onPressOut, ...rest }: Props) {
  const scale = useSharedValue(1);
  const isReducedMotion = useReducedMotion();
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(event) => {
        if (!isReducedMotion) scale.set(withTiming(pressedScale, PRESS_IN));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        if (!isReducedMotion) scale.set(withSpring(1, RELEASE));
        onPressOut?.(event);
      }}
      style={[style, animated]}
    />
  );
}
