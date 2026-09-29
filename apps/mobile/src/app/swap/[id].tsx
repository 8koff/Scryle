import { getPack } from "@retrofit/core";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { findRender } from "@/lib/use-renders";
import { colors, fonts, radius, space } from "@/theme";

type Side = "before" | "after";

/** One saved swap: flip between the photo and the AI edit. The AI side is always labelled. */
export default function SwapViewer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const render = typeof id === "string" ? findRender(id) : undefined;
  const [side, setSide] = useState<Side>("after");

  if (!render) {
    return (
      <View style={styles.missing}>
        <Stack.Screen options={{ title: "Swap" }} />
        <Text style={styles.body}>This swap isn&apos;t loaded. Go back to My swaps and pull down to refresh.</Text>
      </View>
    );
  }

  const uri = side === "after" ? render.afterUrl : render.beforeUrl;
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: getPack(render.pack).label }} />
      <View style={[styles.frame, { aspectRatio: render.width / render.height }]}>
        <Image source={{ uri }} style={styles.image} contentFit="contain" transition={120} />
        {side === "after" ? <Text style={styles.tag}>After (AI edit)</Text> : <Text style={styles.tag}>Before</Text>}
      </View>

      <View style={styles.toggle} accessibilityRole="tablist">
        {(["before", "after"] as const).map((s) => (
          <Pressable
            key={s}
            accessibilityRole="tab"
            accessibilityState={{ selected: side === s }}
            onPress={() => setSide(s)}
            style={[styles.toggleItem, side === s && styles.toggleOn]}
          >
            <Text style={[styles.toggleText, side === s && styles.toggleTextOn]}>{s === "before" ? "Before" : "After (AI edit)"}</Text>
          </Pressable>
        ))}
      </View>

      {render.labels.length ? (
        <View style={styles.changes}>
          <Text style={styles.heading}>What changed</Text>
          {render.labels.map((label) => (
            <Text key={label} style={styles.body}>
              {label}
            </Text>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.md, gap: space.md },
  missing: { flex: 1, backgroundColor: colors.bg, padding: space.lg },
  frame: { width: "100%", borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.surface2 },
  image: { flex: 1 },
  tag: {
    position: "absolute",
    left: space.sm,
    bottom: space.sm,
    backgroundColor: "rgba(12,12,11,0.75)",
    color: colors.fg,
    fontFamily: fonts.medium,
    fontSize: 13,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: "hidden",
  },
  toggle: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: radius.md, padding: 4 },
  toggleItem: { flex: 1, minHeight: 44, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  toggleOn: { backgroundColor: colors.surface2 },
  toggleText: { fontFamily: fonts.medium, fontSize: 15, color: colors.muted },
  toggleTextOn: { color: colors.fg },
  changes: { gap: space.xs },
  heading: { fontFamily: fonts.semibold, fontSize: 18, color: colors.fg, marginBottom: space.xs },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.muted },
});
