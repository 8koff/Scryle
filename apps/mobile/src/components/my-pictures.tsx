import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { SwapThumb } from "@/components/swap-thumb";
import { useRenders } from "@/lib/use-renders";
import { trackedRenders } from "@/lib/render";
import { useTrackedRenders } from "@/lib/tracked-renders";
import { useAccount } from "@/lib/use-account";
import { colors, fonts, headline, radius, space } from "@/theme";

const COLUMNS = 2;

/**
 * Every saved picture, newest first. Shown as a tab with a plan, and as a page behind the paywall
 * (app/my-pictures.tsx): people keep their pictures when a plan ends; making new ones needs a plan.
 */
export function MyPictures({ edges }: { edges: Edge[] }) {
  const me = useAccount();
  const hasPlan = me.status === "signed-in" && Boolean(me.plan);
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
    <SafeAreaView style={styles.screen} edges={edges}>
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
            <Text style={styles.title}>My pictures</Text>
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
              <Text style={styles.body}>Loading your pictures…</Text>
            ) : renders.status === "error" ? (
              <>
                <Text style={styles.body}>{renders.message}</Text>
                <Button label="Try again" variant="quiet" onPress={() => void refresh()} />
              </>
            ) : visibleRequests.length ? null : (
              <>
                <Text style={styles.body}>No pictures yet. They stay here after you make them.</Text>
                {hasPlan ? (
                  <Button label="Make your first picture" onPress={() => router.navigate("/")} />
                ) : (
                  <Button label="See plans" onPress={() => router.back()} />
                )}
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
  title: { ...headline(40), marginTop: space.sm },
  header: { gap: space.md },
  request: { backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md, gap: space.xs },
  requestTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.fg },
  empty: { gap: space.md, paddingTop: space.lg },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23, color: colors.muted },
});
