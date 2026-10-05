import { getPack, type RenderCard } from "@retrofit/core";
import { Image } from "expo-image";
import { router } from "expo-router";
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { PressableScale } from "@/components/pressable-scale";
import { thumbSource } from "@/lib/use-renders";
import { colors, fonts, radius, space } from "@/theme";

type Props = { render: RenderCard; width: number };

/** One saved swap: the AI picture (labelled as such), what changed, and the category. */
export const SwapThumb = memo(function SwapThumb({ render, width }: Props) {
  const packLabel = getPack(render.pack).label;
  const label = render.labels[0] ?? packLabel;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`Open swap: ${label}`}
      onPress={() => router.push({ pathname: "/swap/[id]", params: { id: render.jobId } })}
      style={{ width }}
    >
      <View style={[styles.frame, { width, height: width * 1.25 }]}>
        {/* A small preview from the server; decoded straight to tile size either way. */}
        <Image
          source={thumbSource(render)}
          style={styles.image}
          contentFit="cover"
          transition={150}
          enforceEarlyResizing
        />
        <Text style={styles.tag}>After (AI edit)</Text>
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.meta}>{packLabel}</Text>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  frame: {
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  image: { flex: 1 },
  tag: {
    position: "absolute",
    left: space.sm,
    bottom: space.sm,
    backgroundColor: "rgba(12,12,11,0.75)",
    color: colors.fg,
    fontFamily: fonts.medium,
    fontSize: 11,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: "hidden",
  },
  label: { fontFamily: fonts.medium, fontSize: 14, color: colors.fg, marginTop: space.sm },
  meta: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
});
