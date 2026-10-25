import { StyleSheet, View } from "react-native";
import { colors } from "@/theme";

/**
 * The Seam mark, the same drawing as the web's `SeamMark` (apps/web/lib/brand-mark.tsx): the
 * before/after slider as a logo. Built from views because the app has no SVG library; every
 * measurement is the web's 32-unit viewBox scaled to `size`.
 */
export function SeamMark({ size }: { size: number }) {
  const unit = size / 32;
  const stroke = 2.4 * unit;
  const handle = 9.2 * unit;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, padding: 1.8 * unit }}
    >
      <View style={[styles.square, { borderWidth: stroke, borderRadius: 5 * unit }]}>
        <View style={styles.after} />
        <View style={[styles.seam, { width: stroke, marginLeft: -stroke / 2 }]} />
      </View>
      <View
        style={[
          styles.handle,
          { width: handle, height: handle, borderRadius: handle / 2, marginLeft: -handle / 2, marginTop: -handle / 2 },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  square: { flex: 1, overflow: "hidden", borderColor: colors.fg },
  after: { position: "absolute", top: 0, bottom: 0, left: "50%", right: 0, backgroundColor: colors.accent },
  seam: { position: "absolute", top: 0, bottom: 0, left: "50%", backgroundColor: colors.fg },
  handle: { position: "absolute", left: "50%", top: "50%", backgroundColor: colors.fg },
});
