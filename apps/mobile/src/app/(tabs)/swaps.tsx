import { router } from "expo-router";
import { useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { SwapThumb } from "@/components/swap-thumb";
import { useRenders } from "@/lib/use-renders";
import { colors, display, fonts, space } from "@/theme";

const COLUMNS = 2;

/** Every saved swap, newest first. */
export default function MySwaps() {
  const { renders, reload } = useRenders();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { width } = useWindowDimensions();
  const itemWidth = (width - space.md * 2 - space.md * (COLUMNS - 1)) / COLUMNS;

  const refresh = async () => {
    setIsRefreshing(true);
    await reload();
    setIsRefreshing(false);
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
        ListHeaderComponent={<Text style={styles.title}>My swaps</Text>}
        ListEmptyComponent={
          <View style={styles.empty}>
            {renders.status === "loading" ? (
              <Text style={styles.body}>Loading your swaps…</Text>
            ) : renders.status === "error" ? (
              <>
                <Text style={styles.body}>{renders.message}</Text>
                <Button label="Try again" variant="quiet" onPress={() => void refresh()} />
              </>
            ) : (
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
  empty: { gap: space.md, paddingTop: space.lg },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23, color: colors.muted },
});
