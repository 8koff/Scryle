import { PACKS, type Pack } from "@retrofit/core";
import { Image } from "expo-image";
import { router } from "expo-router";
import { memo } from "react";
import { FlatList as NativeFlatList, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
// The gesture-aware list, so dragging a card's slider handle doesn't also swipe the list.
import { FlatList } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { CompareSlider } from "@/components/compare-slider";
import { InviteCard } from "@/components/invite-card";
import { PressableScale } from "@/components/pressable-scale";
import { SwapThumb } from "@/components/swap-thumb";
import { SwapsLeft } from "@/components/swaps-left";
import { PACK_COVERS } from "@/lib/packs";
import { account, useAccount } from "@/lib/use-account";
import { useRenders } from "@/lib/use-renders";
import { colors, display, fonts, radius, space } from "@/theme";

/** A card is most of the screen wide, so the next one peeks in and says "swipe". */
const CARD_SHARE = 0.78;
const RECENT_LIMIT = 8;

export default function Home() {
  const state = useAccount();
  const { renders, reload } = useRenders();
  const { width } = useWindowDimensions();
  const cardWidth = Math.round(width * CARD_SHARE);
  const firstName = state.status === "signed-in" ? state.name?.split(" ")[0] : undefined;
  const recent = renders.status === "ready" ? renders.data.slice(0, RECENT_LIMIT) : [];

  const refresh = () => Promise.all([reload(), account.refreshCredits()]);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => void refresh()} tintColor={colors.muted} />}
      >
        <View style={styles.padded}>
          <Text style={styles.hello}>{firstName ? `Hi, ${firstName}` : "Scryle"}</Text>
          <Text style={styles.title}>What do you want to change?</Text>
        </View>

        <View style={styles.padded}>
          <CameraButton />
        </View>

        <Text style={[styles.padded, styles.sectionLabel]}>Or start with a category</Text>

        <FlatList
          horizontal
          data={PACKS}
          keyExtractor={(p) => p.id}
          renderItem={({ item, index }) => <CategoryCard pack={item} width={cardWidth} isFirst={index === 0} />}
          showsHorizontalScrollIndicator={false}
          snapToInterval={cardWidth + space.md}
          decelerationRate="fast"
          contentContainerStyle={styles.carousel}
          ItemSeparatorComponent={CardGap}
        />

        <View style={styles.padded}>
          <SwapsLeft />
        </View>

        <View style={styles.section}>
          <View style={[styles.padded, styles.sectionHead]}>
            <Text style={styles.sectionTitle}>Your swaps</Text>
            {recent.length ? (
              <Text style={styles.link} onPress={() => router.navigate("/swaps")} accessibilityRole="link">
                See all
              </Text>
            ) : null}
          </View>
          {recent.length ? (
            <NativeFlatList
              horizontal
              data={recent}
              keyExtractor={(r) => r.jobId}
              renderItem={({ item }) => <SwapThumb render={item} width={140} />}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carousel}
              ItemSeparatorComponent={ThumbGap}
            />
          ) : (
            <Text style={[styles.padded, styles.empty]}>
              {renders.status === "loading"
                ? "Loading your swaps…"
                : renders.status === "error"
                  ? renders.message
                  : "Your swaps show up here. Pick a category above to make your first one."}
            </Text>
          )}
        </View>

        <View style={styles.padded}>
          <InviteCard />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** The main action: camera first, category after (app/snap.tsx). */
function CameraButton() {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel="Take a photo. Then pick what to change."
      onPress={() => router.push("/snap")}
      pressedScale={0.98}
      style={styles.camera}
    >
      <View style={styles.shutter}>
        <View style={styles.shutterDot} />
      </View>
      <View style={styles.cameraText}>
        <Text style={styles.cameraTitle}>Take a photo</Text>
        <Text style={styles.cameraBody}>Then pick what to change</Text>
      </View>
    </PressableScale>
  );
}

const CategoryCard = memo(function CategoryCard({ pack, width, isFirst }: { pack: Pack; width: number; isFirst: boolean }) {
  const cover = PACK_COVERS[pack.id];
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${pack.label}. ${pack.tagline}`}
      onPress={() => router.push({ pathname: "/pack/[id]", params: { id: pack.id } })}
      pressedScale={0.985}
      style={[styles.card, { width }]}
    >
      {cover.after ? (
        <CompareSlider
          before={cover.before}
          after={cover.after}
          hint={isFirst}
          style={[styles.cardImage, { height: width * 1.1 }]}
          accessibilityLabel={`${pack.label} example. Left: before. Right: AI edit.`}
        />
      ) : (
        <Image source={cover.before} style={[styles.cardImage, { height: width * 1.1 }]} contentFit="cover" />
      )}
      <View style={styles.cardText}>
        <Text style={styles.cardTitle}>{pack.label}</Text>
        <Text style={styles.cardBody}>{pack.tagline}</Text>
        <Text style={styles.cardExamples}>{cover.examples}</Text>
      </View>
    </PressableScale>
  );
});

const CardGap = () => <View style={styles.cardGap} />;
const ThumbGap = () => <View style={styles.thumbGap} />;

const styles = StyleSheet.create({
  cardGap: { width: space.md },
  thumbGap: { width: space.sm + 4 },
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingTop: space.md, paddingBottom: space.xl, gap: space.lg },
  padded: { paddingHorizontal: space.md },
  hello: { fontFamily: fonts.medium, fontSize: 16, color: colors.muted },
  title: { ...display, fontSize: 32, lineHeight: 35, marginTop: space.xs },
  carousel: { paddingHorizontal: space.md },
  card: { borderRadius: radius.lg, backgroundColor: colors.surface, overflow: "hidden" },
  cardImage: { width: "100%", backgroundColor: colors.surface2 },
  cardText: { padding: space.md, gap: space.xs },
  cardTitle: { fontFamily: fonts.semibold, fontSize: 24, color: colors.fg },
  cardBody: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 22, color: colors.fg },
  cardExamples: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 19, color: colors.muted },
  camera: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 76,
    paddingHorizontal: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
  },
  shutter: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: colors.onAccent,
    alignItems: "center",
    justifyContent: "center",
  },
  shutterDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.onAccent },
  cameraText: { flex: 1, gap: 2 },
  cameraTitle: { fontFamily: fonts.semibold, fontSize: 19, color: colors.onAccent },
  cameraBody: { fontFamily: fonts.regular, fontSize: 15, color: "rgba(255,255,255,0.82)" },
  sectionLabel: { fontFamily: fonts.medium, fontSize: 15, color: colors.muted, marginBottom: -space.sm },
  section: { gap: space.sm },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  sectionTitle: { fontFamily: fonts.semibold, fontSize: 20, color: colors.fg },
  link: { fontFamily: fonts.medium, fontSize: 15, color: colors.accentInk, padding: space.xs },
  empty: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.muted },
});
