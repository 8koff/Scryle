import { formatUsd } from "@retrofit/core";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, radius, space } from "@/theme";

type Props = {
  title: string;
  /** Product photo URL, or a colour swatch. */
  image?: string;
  swatch?: string;
  /** Store products only. */
  priceCents?: number;
  store?: string;
  /** Example products from our render tests: no store, no price. */
  isSample?: boolean;
  isSelected: boolean;
  onPick: () => void;
};

/** One thing that could go on the part: a store product, an example, or a colour. */
export function OptionCard({ title, image, swatch, priceCents, store, isSample, isSelected, onPick }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={[title, store, priceCents ? formatUsd(priceCents) : undefined].filter(Boolean).join(", ")}
      onPress={onPick}
      style={({ pressed }) => [styles.card, isSelected && styles.selected, pressed && styles.pressed]}
    >
      <View style={styles.picture}>
        {image ? (
          <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="contain" transition={120} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: swatch ?? colors.surface2 }]} />
        )}
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
      {priceCents ? <Text style={styles.price}>{formatUsd(priceCents)}</Text> : null}
      {store ? (
        <Text style={styles.meta} numberOfLines={1}>
          {store}
        </Text>
      ) : isSample ? (
        <Text style={styles.meta}>Example</Text>
      ) : null}
    </Pressable>
  );
}

export function OptionCardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.picture} />
      <View style={styles.skeletonLine} />
      <View style={[styles.skeletonLine, { width: "50%" }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: 132, gap: 4, padding: 6, borderRadius: radius.md, borderWidth: 2, borderColor: "transparent" },
  selected: { borderColor: colors.accent },
  pressed: { opacity: 0.75 },
  picture: { width: "100%", aspectRatio: 1, borderRadius: radius.sm, overflow: "hidden", backgroundColor: "#ffffff" },
  title: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 17, color: colors.fg, marginTop: space.xs },
  price: { fontFamily: fonts.semibold, fontSize: 14, color: colors.fg },
  meta: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  skeletonLine: { height: 12, borderRadius: 4, backgroundColor: colors.surface2, marginTop: space.xs },
});
