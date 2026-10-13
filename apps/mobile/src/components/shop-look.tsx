import { formatUsd } from "@retrofit/core";
import { Image } from "expo-image";
import * as WebBrowser from "expo-web-browser";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { API_URL } from "@/lib/config";
import type { LiveProduct } from "@/lib/store-search";
import { colors, fonts, radius, space } from "@/theme";

/**
 * The real products in a swap, each opening its store through the site's /go/<id> link (which
 * adds the referral tag and never sends people anywhere but the store). Prices are as the store
 * listed them when we found the product, so the total says "listed".
 */
export function ShopLook({ products }: { products: readonly LiveProduct[] }) {
  if (!products.length) return null;
  const total = products.reduce((sum, p) => sum + p.priceCents, 0);
  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Text style={styles.heading} accessibilityRole="header">
          Shop this look
        </Text>
        {products.length > 1 ? <Text style={styles.total}>{formatUsd(total)} listed</Text> : null}
      </View>
      {products.map((p) => (
        <ShopRow key={p.id} product={p} />
      ))}
    </View>
  );
}

function ShopRow({ product: p }: { product: LiveProduct }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${p.title}, ${formatUsd(p.priceCents)} at ${p.store}. Opens the store.`}
      onPress={() => void WebBrowser.openBrowserAsync(`${API_URL}/go/${p.id}`)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Image source={{ uri: p.image }} style={styles.image} contentFit="contain" />
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={2}>
          {p.title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          <Text style={styles.price}>{formatUsd(p.priceCents)}</Text>
          {`  ·  ${p.store}`}
        </Text>
      </View>
      <Text style={styles.view}>View</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  heading: { fontFamily: fonts.semibold, fontSize: 18, color: colors.fg },
  total: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted, fontVariant: ["tabular-nums"] },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.sm, paddingRight: space.md, borderRadius: radius.md, backgroundColor: colors.surface },
  pressed: { opacity: 0.75 },
  image: { width: 64, height: 64, borderRadius: radius.sm, backgroundColor: "#ffffff" },
  text: { flex: 1, gap: 3 },
  title: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 20, color: colors.fg },
  meta: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  price: { fontFamily: fonts.semibold, color: colors.fg, fontVariant: ["tabular-nums"] },
  view: { fontFamily: fonts.semibold, fontSize: 15, color: colors.accentInk },
});
