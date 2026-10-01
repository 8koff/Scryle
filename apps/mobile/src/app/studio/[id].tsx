import { fitsPart, getPack, MAX_SWAPS_PER_PICTURE, STUDIO_OPTIONS, studioParts } from "@retrofit/core";
import { Image } from "expo-image";
import { router, Stack, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { CompareSlider } from "@/components/compare-slider";
import { OptionCard, OptionCardSkeleton } from "@/components/option-card";
import { getBuild, type Build } from "@/lib/builds";
import { API_URL } from "@/lib/config";
import { BUY_SOON } from "@/lib/packs";
import { forgetPending, reloadSoon, rememberPending, startRender, waitForRender } from "@/lib/render";
import { preselectChoices, type Chosen } from "@/lib/preselect";
import { makeShareLink, SHARE_TEXT, sharePicture, type ShareJob } from "@/lib/share";
import { cachedSearch, FITS, loadLiveProducts, searchStore, type Fit, type LiveProduct, type SearchResult } from "@/lib/store-search";
import { account, useAccount } from "@/lib/use-account";
import { colors, fonts, radius, space } from "@/theme";

type RenderState =
  | { kind: "idle" }
  | { kind: "rendering"; labels: string[] }
  | { kind: "done"; imageUrl: string; picks: Chosen[]; job: ShareJob }
  | { kind: "failed"; message: string };

const FIT_LABELS: Record<Fit, string> = { women: "Women", men: "Men", any: "Any" };

export default function StudioScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const build = typeof id === "string" ? getBuild(id) : undefined;
  if (!build) {
    return (
      <SafeAreaView style={styles.missing}>
        <Text style={styles.heading}>This photo is closed</Text>
        <Text style={styles.body}>Photos stay open while the app is open. Your finished swaps are in My swaps.</Text>
        <Button label="Go home" onPress={() => router.replace("/")} />
      </SafeAreaView>
    );
  }
  return <Studio build={build} />;
}

function Studio({ build }: { build: Build }) {
  const pack = getPack(build.pack);
  const parts = useMemo(() => studioParts(pack, build.scene), [pack, build.scene]);
  const me = useAccount();
  const [activeId, setActiveId] = useState(parts[0]?.id ?? "");
  const [chosen, setChosen] = useState<Record<string, Chosen>>({});
  // "Swap more": put the saved swap's picks back once, after its store products load.
  useEffect(() => {
    const selections = build.preselect;
    if (!selections?.length) return;
    let isLive = true;
    const ids = selections.flatMap((s) => ("productId" in s ? [s.productId] : []));
    void loadLiveProducts(ids).then((live) => {
      if (isLive) setChosen((now) => (Object.keys(now).length ? now : preselectChoices(build.pack, parts, selections, live)));
    });
    return () => {
      isLive = false;
    };
  }, [build, parts]);
  const [fit, setFit] = useState<Fit | undefined>(() => {
    const seen = build.scene.details?.fit;
    return seen === "men" || seen === "women" ? seen : undefined;
  });
  const [render, setRender] = useState<RenderState>({ kind: "idle" });
  const isRendering = useRef(false);
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const active = parts.find((p) => p.id === activeId);
  const isColourOnly = Boolean(pack.parts.find((p) => p.id === activeId)?.textOnly);
  const options = STUDIO_OPTIONS.filter((o) => fitsPart(o, build.pack, activeId));
  const picks = Object.values(chosen);
  const selectedId = (partId: string) => {
    const input = chosen[partId]?.input;
    return input && "productId" in input ? input.productId : undefined;
  };

  const choose = (partId: string, c: Chosen) => {
    if (!chosen[partId] && picks.length >= MAX_SWAPS_PER_PICTURE) {
      Alert.alert("Too many swaps", `You can swap up to ${MAX_SWAPS_PER_PICTURE} parts at once. Take one out first.`);
      return;
    }
    setChosen((prev) => ({ ...prev, [partId]: c }));
    // A new pick means a new picture: the last result no longer matches.
    if (render.kind === "done" || render.kind === "failed") setRender({ kind: "idle" });
  };
  const clear = (partId: string) => {
    setChosen((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => k !== partId)));
    if (render.kind === "done" || render.kind === "failed") setRender({ kind: "idle" });
  };

  /** Only touches the screen while it is open. Leaving doesn't stop the swap or its saving. */
  const show = (next: RenderState) => {
    if (isMounted.current) setRender(next);
  };

  const runRender = async () => {
    // A ref, not state: two taps in the same frame must not start two paid swaps.
    if (!picks.length || isRendering.current || me.status !== "signed-in") return;
    if (me.credits === 0) return Alert.alert(BUY_SOON.title, "You're out of swaps. " + BUY_SOON.body);
    isRendering.current = true;
    const used = picks;
    setRender({ kind: "rendering", labels: used.map((p) => p.label) });
    try {
      const started = await startRender(build, used.map((p) => p.input));
      void account.refreshCredits();
      if (started.status === "error") {
        show({ kind: "idle" });
        if (started.code === "no_credits") return Alert.alert(BUY_SOON.title, "You're out of swaps. " + BUY_SOON.body);
        if (started.code === "sign_in") return Alert.alert("Please sign in again", "Your sign-in ran out. Sign out and in again from Account.");
        return Alert.alert("Couldn't start the swap", started.message);
      }
      const { jobId, jobToken } = started.data;
      await rememberPending(jobId, jobToken);
      // Keeps asking even after the screen closes (bounded), so the swap is saved without waiting for a restart.
      const end = await waitForRender(jobId, jobToken, new AbortController().signal);
      if (end.status === "done") {
        await forgetPending(jobId);
        reloadSoon();
        show({ kind: "done", imageUrl: end.imageUrl, picks: used, job: { jobId, jobToken } });
      } else if (end.status === "failed") {
        await forgetPending(jobId);
        void account.refreshCredits(); // the swap came back
        show({ kind: "failed", message: end.message });
      } else {
        show({ kind: "failed", message: "This is taking longer than usual. It will show up in My swaps when it's ready." });
      }
    } finally {
      isRendering.current = false;
    }
  };

  const credits = me.status === "signed-in" ? me.credits : null;
  const costLine = credits === null ? " " : credits === 0 ? "You're out of swaps." : `Uses 1 of your ${credits} ${credits === 1 ? "swap" : "swaps"}.`;
  const buttonLabel =
    render.kind === "rendering"
      ? "Swapping…"
      : picks.length > 1
        ? `See all ${picks.length} on my photo`
        : picks.length
          ? "See it on my photo"
          : "Pick something to swap";
  const aspect = build.width / build.height;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: pack.label }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.padded}>
          {render.kind === "done" ? (
            <CompareSlider
              before={{ uri: build.localUri }}
              after={{ uri: render.imageUrl }}
              dragAnywhere
              hint
              style={[styles.photo, { aspectRatio: aspect }]}
            />
          ) : (
            <View style={[styles.photo, { aspectRatio: aspect }]}>
              <Image source={{ uri: build.localUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
              {render.kind === "rendering" ? (
                <View style={styles.working}>
                  <ActivityIndicator color="#ffffff" />
                  <Text style={styles.workingTitle}>Swapping…</Text>
                  <Text style={styles.workingBody}>{render.labels.join(", ")}</Text>
                  <Text style={styles.workingBody}>This takes about a minute.</Text>
                </View>
              ) : null}
            </View>
          )}
        </View>

        {render.kind === "done" ? <DonePanel build={build} job={render.job} picks={render.picks} /> : null}
        {render.kind === "failed" ? <Text style={[styles.padded, styles.notice]}>{render.message}</Text> : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {parts.map((part) => {
            const isOn = part.id === activeId;
            return (
              <Pressable
                key={part.id}
                accessibilityRole="button"
                accessibilityState={{ selected: isOn }}
                onPress={() => setActiveId(part.id)}
                style={[styles.chip, isOn && styles.chipOn, !isOn && chosen[part.id] && styles.chipPicked]}
              >
                <Text style={[styles.chipText, isOn && styles.chipTextOn]}>
                  {part.label}
                  {chosen[part.id] ? " •" : ""}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {active ? (
          <View style={styles.panel}>
            <View style={[styles.padded, styles.panelHead]}>
              <Text style={styles.heading}>{active.label}</Text>
              {chosen[active.id] ? (
                <Text style={styles.link} onPress={() => clear(active.id)} accessibilityRole="button">
                  Keep original
                </Text>
              ) : null}
            </View>

            {build.pack === "clothing" && !isColourOnly ? (
              <View style={[styles.padded, styles.fits]}>
                {FITS.map((f) => (
                  <Pressable
                    key={f}
                    accessibilityRole="button"
                    accessibilityState={{ selected: (fit ?? "any") === f }}
                    onPress={() => setFit(f)}
                    style={[styles.fit, (fit ?? "any") === f && styles.fitOn]}
                  >
                    <Text style={[styles.fitText, (fit ?? "any") === f && styles.fitTextOn]}>{FIT_LABELS[f]}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {options.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
                {options.map((o) => (
                  <OptionCard
                    key={o.id}
                    title={o.title}
                    image={o.image ? `${API_URL}${o.image}` : undefined}
                    swatch={o.swatch}
                    isSample={o.kind === "sample"}
                    isSelected={selectedId(active.id) === o.id}
                    onPick={() => choose(active.id, { input: { partId: active.id, productId: o.id }, label: o.title })}
                  />
                ))}
              </ScrollView>
            ) : null}

            {!isColourOnly ? (
              <StoreRow
                key={`${active.id}|${fit ?? ""}`}
                build={build}
                partId={active.id}
                fit={fit}
                selectedId={selectedId(active.id)}
                onPick={(p) => choose(active.id, { input: { partId: active.id, productId: p.id }, label: p.title, product: p })}
              />
            ) : null}
            <Text style={[styles.padded, styles.small]}>Prices as the stores listed them. We may earn a commission.</Text>
          </View>
        ) : (
          <Text style={[styles.padded, styles.body]}>We couldn&apos;t find parts to change in this photo. Try another photo.</Text>
        )}
      </ScrollView>

      <SafeAreaView edges={["bottom"]} style={styles.footer}>
        <Button label={buttonLabel} disabled={!picks.length} isBusy={render.kind === "rendering"} onPress={() => void runRender()} />
        <Text style={styles.cost}>{costLine}</Text>
      </SafeAreaView>
    </View>
  );
}

/** Real store products for the part. Searches only when this part is open. */
function StoreRow({
  build,
  partId,
  fit,
  selectedId,
  onPick,
}: {
  build: Build;
  partId: string;
  fit: Fit | undefined;
  selectedId: string | undefined;
  onPick: (product: LiveProduct) => void;
}) {
  const kept = cachedSearch(build, partId, fit);
  const [result, setResult] = useState<SearchResult | null>(kept ? { status: "ready", products: kept } : null);

  useEffect(() => {
    if (kept) return;
    let isLive = true;
    void searchStore(build, partId, fit).then((r) => {
      if (isLive) setResult(r);
    });
    return () => {
      isLive = false;
    };
  }, [build, partId, fit, kept]);

  if (!result) {
    return (
      <ScrollView horizontal scrollEnabled={false} contentContainerStyle={styles.row}>
        {[0, 1, 2].map((i) => (
          <OptionCardSkeleton key={i} />
        ))}
      </ScrollView>
    );
  }
  if (result.status === "error") return <Text style={[styles.padded, styles.body]}>{result.message}</Text>;
  if (!result.products.length) return <Text style={[styles.padded, styles.body]}>No store results for this part.</Text>;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {result.products.map((p) => (
        <OptionCard
          key={p.id}
          title={p.title}
          image={p.image}
          priceCents={p.priceCents}
          store={p.store}
          isSelected={selectedId === p.id}
          onPick={() => onPick(p)}
        />
      ))}
    </ScrollView>
  );
}

/** After a swap: where it's saved, and the real products in it, each with its store link. */
function DonePanel({ build, job, picks }: { build: Build; job: ShareJob; picks: Chosen[] }) {
  const products = picks.flatMap((p) => (p.product ? [p.product] : []));
  const [busy, setBusy] = useState<"picture" | "link" | null>(null);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);

  const onPicture = async () => {
    setBusy("picture");
    const error = await sharePicture(build, job);
    setBusy(null);
    if (error) Alert.alert("Couldn't share", error);
  };
  const onLink = async () => {
    if (linkUrl) return void Share.share({ url: linkUrl, message: SHARE_TEXT }).catch(() => {});
    setBusy("link");
    const result = await makeShareLink(build, job, picks.map((p) => p.input));
    setBusy(null);
    if ("error" in result) Alert.alert("Couldn't make the link", result.error);
    else setLinkUrl(result.url);
  };

  return (
    <View style={[styles.padded, styles.done]}>
      <Text style={styles.small}>Saved to My swaps.</Text>
      <Button label="Share the picture" isBusy={busy === "picture"} disabled={busy !== null} onPress={() => void onPicture()} />
      <Text style={styles.small}>One image with both photos. Only people you send it to see it.</Text>
      <Button label={linkUrl ? "Share the link again" : "Make a link"} variant="quiet" isBusy={busy === "link"} disabled={busy !== null} onPress={() => void onLink()} />
      <Text style={styles.small}>A page anyone with the link can see, with a &ldquo;Try this on me&rdquo; button. It stays up until you delete it on the website.</Text>
      {products.length ? (
        <>
          <Text style={styles.heading}>Shop this look</Text>
          {products.map((p) => (
            <Pressable
              key={p.id}
              accessibilityRole="link"
              accessibilityLabel={`View ${p.title} at ${p.store}`}
              onPress={() => void WebBrowser.openBrowserAsync(`${API_URL}/go/${p.id}`)}
              style={({ pressed }) => [styles.shopRow, pressed && styles.pressed]}
            >
              <Image source={{ uri: p.image }} style={styles.shopImage} contentFit="contain" />
              <View style={styles.fill}>
                <Text style={styles.shopTitle} numberOfLines={2}>
                  {p.title}
                </Text>
                <Text style={styles.small}>{p.store}</Text>
              </View>
              <Text style={styles.link}>View</Text>
            </Pressable>
          ))}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  missing: { flex: 1, backgroundColor: colors.bg, padding: space.lg, gap: space.md },
  content: { paddingTop: space.sm, paddingBottom: space.xl, gap: space.md },
  padded: { paddingHorizontal: space.md },
  fill: { flex: 1 },
  photo: { width: "100%", maxHeight: 520, alignSelf: "center", borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.surface2 },
  working: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(12,12,11,0.55)", alignItems: "center", justifyContent: "center", gap: 6, padding: space.lg },
  workingTitle: { fontFamily: fonts.semibold, fontSize: 18, color: "#ffffff" },
  workingBody: { fontFamily: fonts.regular, fontSize: 14, color: "#ffffff", textAlign: "center" },
  notice: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21, color: colors.fg },
  chips: { paddingHorizontal: space.md, gap: space.sm },
  chip: { minHeight: 40, paddingHorizontal: space.md, borderRadius: 999, backgroundColor: colors.surface2, justifyContent: "center" },
  chipOn: { backgroundColor: colors.fg },
  chipPicked: { backgroundColor: "rgba(74,112,181,0.2)" },
  chipText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.fg },
  chipTextOn: { color: colors.bg },
  panel: { gap: space.sm },
  panelHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  heading: { fontFamily: fonts.semibold, fontSize: 18, color: colors.fg },
  link: { fontFamily: fonts.medium, fontSize: 15, color: colors.accentInk, padding: space.xs },
  fits: { flexDirection: "row", gap: space.xs },
  fit: { minHeight: 34, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.surface2, justifyContent: "center" },
  fitOn: { backgroundColor: colors.fg },
  fitText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.fg },
  fitTextOn: { color: colors.bg },
  row: { paddingHorizontal: space.md - 6, gap: 2 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.muted },
  small: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.muted },
  footer: { paddingHorizontal: space.md, paddingTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, backgroundColor: colors.bg },
  cost: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, textAlign: "center", marginTop: space.xs },
  done: { gap: space.sm },
  shopRow: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.sm, borderRadius: radius.md, backgroundColor: colors.surface },
  pressed: { opacity: 0.75 },
  shopImage: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: "#ffffff" },
  shopTitle: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 19, color: colors.fg },
});
