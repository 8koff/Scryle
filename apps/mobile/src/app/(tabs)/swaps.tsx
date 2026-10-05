import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { SwapThumb } from "@/components/swap-thumb";
import { useRenders } from "@/lib/use-renders";
import { trackedRenders } from "@/lib/render";
import { useTrackedRenders } from "@/lib/tracked-renders";
import { colors, display, fonts, radius, space } from "@/theme";

const COLUMNS = 2;

/** Every saved swap, newest first. */
export default function MySwaps() {
  const { renders, reload } = useRenders();
  const requests = useTrackedRenders();
  const waiting = requests.filter((r) => r.state !== "ready" || !(renders.status === "ready" && renders.data.some((saved) => saved.jobId === r.start?.jobId)));
  const visibleRequests = waiting.filter((r) => r.state !== "failed" || waiting.indexOf(r) >= waiting.length - 3);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { width } = useWindowDimensions();
  const itemWidth = (width - space.md * 2 - space.md * (COLUMNS - 1)) / COLUMNS;

  useFocusEffect(useCallback(() => { void trackedRenders.recover(); }, []));

  const refresh = async () => {
    setIsRefreshing(true);
    try {
      await trackedRenders.recover();
      await reload();
    } finally { setIsRefreshing(false); }
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <FlatList
        data={renders.status === "ready" ? renders.data : []}
        keyExtractor={(r) => r.jobId}
        numColumns={COLUMNS}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.content}
        renderItem={({ item }) => <SwapThumb render={item} width={itemWidth} />}
        // A few rows at a time: each picture is a full-size render.
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={5}
        removeClippedSubviews
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void refresh()} tintColor={colors.muted} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>My swaps</Text>
            {visibleRequests.map((r) => (
              <View key={r.id} style={styles.request}>
                <Text style={styles.requestTitle}>{r.label}</Text>
                <Text style={styles.body}>
                  {r.state === "running" ? "Swapping. You can leave and check back here."
                    : r.state === "ready" ? "Your swap is ready. Refresh to load its saved picture."
                      : r.state === "failed" ? r.message ?? "This swap couldn't start."
                        : r.message ?? "Checking whether this swap started. Checking again won't start another."}
                </Text>
              </View>
            ))}
            {visibleRequests.length ? <Button label="Check status" variant="quiet" isBusy={isRefreshing} onPress={() => void refresh()} /> : null}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            {renders.status === "loading" ? (
              <Text style={styles.body}>Loading your swaps…</Text>
            ) : renders.status === "error" ? (
              <>
                <Text style={styles.body}>{renders.message}</Text>
                <Button label="Try again" variant="quiet" onPress={() => void refresh()} />
              </>
            ) : visibleRequests.length ? null : (
              <>
                <Text style={styles.body}>No swaps yet. Your pictures stay here after you make them.</Text>
                <Button label="Make your first swap" onPress={() => router.navigate("/")} />
              </>
            )}
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.md, gap: space.lg, flexGrow: 1 },
  row: { gap: space.md },
  title: { ...display, fontSize: 32, lineHeight: 35 },
  header: { gap: space.md },
  request: { backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md, gap: space.xs },
  requestTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.fg },
  empty: { gap: space.md, paddingTop: space.lg },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23, color: colors.muted },
});
