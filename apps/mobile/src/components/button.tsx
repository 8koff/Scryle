import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps } from "react-native";
import { colors, fonts, radius } from "@/theme";

type Props = Omit<PressableProps, "children"> & {
  label: string;
  /** "primary" is the denim fill: the one main action on a screen. */
  variant?: "primary" | "quiet";
  isBusy?: boolean;
};

export function Button({ label, variant = "primary", isBusy = false, disabled, style, ...rest }: Props) {
  const isPrimary = variant === "primary";
  const isOff = Boolean(disabled) || isBusy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isOff, busy: isBusy }}
      disabled={isOff}
      style={(state) => [
        styles.base,
        isPrimary ? styles.primary : styles.quiet,
        state.pressed && (isPrimary ? styles.primaryPressed : styles.quietPressed),
        isOff && styles.off,
        typeof style === "function" ? style(state) : style,
      ]}
      {...rest}
    >
      {isBusy ? (
        <ActivityIndicator color={isPrimary ? colors.onAccent : colors.fg} />
      ) : (
        <Text style={[styles.label, { color: isPrimary ? colors.onAccent : colors.fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radius.md,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: { backgroundColor: colors.accent },
  primaryPressed: { backgroundColor: colors.accentPressed },
  quiet: { borderWidth: 1, borderColor: colors.line },
  quietPressed: { backgroundColor: colors.surface },
  off: { opacity: 0.5 },
  label: { fontFamily: fonts.semibold, fontSize: 16 },
});
