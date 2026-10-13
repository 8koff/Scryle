import { getPack } from "@retrofit/core";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/button";
import { CompareSlider } from "@/components/compare-slider";
import { ShopLook } from "@/components/shop-look";
import { reopenSaved } from "@/lib/builds";
import { loadLiveProducts, type LiveProduct } from "@/lib/store-search";
import { productIdsOf, swapItems } from "@/lib/swap-items";
import { findRender, pictureSource } from "@/lib/use-renders";
import { colors, fonts, radius, space } from "@/theme";

/**
 * One saved swap: drag between the photo and the AI edit (the AI side is always labelled), then
 * the real products in it, each linking to its store.
 */
export default function SwapViewer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const render = typeof id === "string" ? findRender(id) : undefined;
  const [isOpening, setIsOpening] = useState(false);
  const loaded = useSwapProducts(render?.jobId, render?.selections ?? []);

  if (!render) {
    return (
      <View style={styles.missing}>
        <Stack.Screen options={{ title: "Swap" }} />
        <Text style={styles.body}>This swap isn&apos;t loaded. Go back to My swaps and pull down to refresh.</Text>
      </View>
    );
  }

  const items = swapItems(render.selections, render.labels, loaded ?? []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: getPack(render.pack).label }} />
      <CompareSlider
        before={pictureSource(render.beforeUrl, render.jobId, "before")}
        after={pictureSource(render.afterUrl, render.jobId, "after")}
        dragAnywhere
        hint
        style={[styles.frame, { aspectRatio: render.width / render.height }]}
      />
      <Text style={styles.help}>Drag the picture to compare.</Text>
      {loaded === null ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.muted} />
          <Text style={styles.body}>Loading the products…</Text>
        </View>
      ) : (
        <ShopLook products={items.products} />
      )}
      {render.canReopen ? (
        <Button
          label="Swap more"
          isBusy={isOpening}
          onPress={async () => {
            setIsOpening(true);
            const opened = await reopenSaved(render.jobId);
            setIsOpening(false);
            if ("error" in opened) return Alert.alert("Couldn't open this photo", opened.error);
            router.push({ pathname: "/studio/[id]", params: { id: opened.id } });
          }}
        />
      ) : null}

      {loaded !== null && items.others.length ? (
        <View style={styles.changes}>
          <Text style={styles.heading}>{items.products.length ? "Also changed" : "What changed"}</Text>
          {items.others.map((label) => (
            <Text key={label} style={styles.body}>
              {label}
            </Text>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

/**
 * The swap's store products, looked up by id (a database read, not a new store search).
 * null while loading; [] when there are none or the lookup failed (the labels still show).
 */
function useSwapProducts(jobId: string | undefined, selections: Parameters<typeof productIdsOf>[0]) {
  const ids = productIdsOf(selections).join(",");
  const [loaded, setLoaded] = useState<{ key: string; products: LiveProduct[] } | null>(null);
  useEffect(() => {
    if (!jobId || !ids) return;
    let isLive = true;
    void loadLiveProducts(ids.split(",")).then((products) => {
      if (isLive) setLoaded({ key: ids, products });
    });
    return () => {
      isLive = false;
    };
  }, [jobId, ids]);
  if (!ids) return [];
  return loaded?.key === ids ? loaded.products : null;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.md, gap: space.md },
  missing: { flex: 1, backgroundColor: colors.bg, padding: space.lg },
  frame: { width: "100%", borderRadius: radius.lg },
  help: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, textAlign: "center" },
  loading: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.sm },
  changes: { gap: space.xs },
  heading: { fontFamily: fonts.semibold, fontSize: 18, color: colors.fg, marginBottom: space.xs },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.muted },
});
