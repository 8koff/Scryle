import { getPack } from "@retrofit/core";
import { Stack, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { CompareSlider } from "@/components/compare-slider";
import { findRender } from "@/lib/use-renders";
import { colors, fonts, radius, space } from "@/theme";

/** One saved swap: drag between the photo and the AI edit. The AI side is always labelled. */
export default function SwapViewer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const render = typeof id === "string" ? findRender(id) : undefined;

  if (!render) {
    return (
      <View style={styles.missing}>
        <Stack.Screen options={{ title: "Swap" }} />
        <Text style={styles.body}>This swap isn&apos;t loaded. Go back to My swaps and pull down to refresh.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: getPack(render.pack).label }} />
      <CompareSlider
        before={{ uri: render.beforeUrl }}
        after={{ uri: render.afterUrl }}
        dragAnywhere
        hint
        style={[styles.frame, { aspectRatio: render.width / render.height }]}
      />
      <Text style={styles.help}>Drag the picture to compare.</Text>

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
  frame: { width: "100%", borderRadius: radius.lg },
  help: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, textAlign: "center" },
  changes: { gap: space.xs },
  heading: { fontFamily: fonts.semibold, fontSize: 18, color: colors.fg, marginBottom: space.xs },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.muted },
});
