import { packSavingPercent } from "@retrofit/core";
import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { LegalLinks } from "@/components/legal-links";
import { buy, canBuyHere, loadOffers, onDelivered, type DeliverResult, type PackOffer } from "@/lib/purchases";
import { useAccount } from "@/lib/use-account";
import { colors, display, fonts, radius, space } from "@/theme";

/** How long to show the spinner before saying the purchase is still waiting. */
const WAIT_MS = 90_000;

type Offers = { status: "loading" } | { status: "ready"; offers: PackOffer[] } | { status: "unavailable"; message: string };

/** The credit packs, paid with Apple. Same packs and prices as the website. */
export default function Buy() {
  const me = useAccount();
  const [offers, setOffers] = useState<Offers>(() =>
    canBuyHere() ? { status: "loading" } : { status: "unavailable", message: "Buying works in the TestFlight or App Store version of Scryle, not in Expo Go." },
  );
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [delivered, setDelivered] = useState<DeliverResult | null>(null);

  useEffect(() => {
    if (!canBuyHere()) return;
    let isLive = true;
    loadOffers()
      .then((list) => {
        if (!isLive) return;
        setOffers(list.length ? { status: "ready", offers: list } : { status: "unavailable", message: "The packs aren't available right now. Please try again later." });
      })
      .catch(() => {
        if (isLive) setOffers({ status: "unavailable", message: "Couldn't reach the App Store. Check your connection and try again." });
      });
    const stop = onDelivered((result) => {
      setBuyingId(null);
      setDelivered(result);
    });
    return () => {
      isLive = false;
      stop();
    };
  }, []);

  const onBuy = async (offer: PackOffer) => {
    if (me.status !== "signed-in" || buyingId) return;
    setNotice(null);
    setDelivered(null);
    setBuyingId(offer.productId);
    const error = await buy(offer, me.userId);
    // Success arrives through onDelivered; only a refusal ends here.
    if (error) {
      setBuyingId(null);
      if (error.kind === "error") setNotice(error.message);
    }
  };

  // Ask to Buy (a parent approves later) sends no answer now: don't spin forever.
  useEffect(() => {
    if (!buyingId) return;
    const timer = setTimeout(() => {
      setBuyingId(null);
      setNotice("Still waiting for Apple. If the purchase needs approval, your swaps arrive when it's approved.");
    }, WAIT_MS);
    return () => clearTimeout(timer);
  }, [buyingId]);

  const credits = me.status === "signed-in" ? me.credits : null;

  return (
    <SafeAreaView style={styles.screen} edges={["bottom"]}>
      <Stack.Screen options={{ title: "Buy swaps" }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Get more swaps</Text>
        <Text style={styles.body}>
          One swap makes one picture. {credits !== null ? `You have ${credits} left. ` : ""}Swaps work on the website too.
        </Text>

        {delivered?.status === "added" ? (
          <View style={styles.done} accessibilityLiveRegion="polite">
            <Text style={styles.doneTitle}>
              {delivered.added
                ? `${delivered.added} swaps added${delivered.bonus ? `, plus ${delivered.bonus} from your invite` : ""}.`
                : "This purchase is already in your account."}
            </Text>
            <Button label="Back to swapping" onPress={() => router.back()} />
          </View>
        ) : null}
        {delivered?.status === "kept" ? (
          <Text style={styles.notice}>
            Apple took the payment, but we couldn&apos;t add the swaps yet ({delivered.message}). Scryle tries again each time it opens, so
            you won&apos;t lose them.
          </Text>
        ) : null}

        {offers.status === "loading" ? <ActivityIndicator color={colors.fg} style={styles.loading} /> : null}
        {offers.status === "unavailable" ? <Text style={styles.notice}>{offers.message}</Text> : null}
        {offers.status === "ready"
          ? offers.offers.map((offer) => {
              const saving = packSavingPercent(offer.pack);
              const isBuying = buyingId === offer.productId;
              return (
                <Pressable
                  key={offer.productId}
                  accessibilityRole="button"
                  accessibilityLabel={`${offer.pack.label}: ${offer.pack.credits} swaps for ${offer.displayPrice}`}
                  disabled={Boolean(buyingId)}
                  onPress={() => void onBuy(offer)}
                  style={({ pressed }) => [styles.pack, offer.pack.isBestValue && styles.best, pressed && styles.pressed, buyingId && !isBuying && styles.off]}
                >
                  <View style={styles.fill}>
                    <Text style={styles.packTitle}>
                      {offer.pack.credits} swaps
                      {offer.pack.isBestValue ? <Text style={styles.badge}>  Best value</Text> : null}
                    </Text>
                    <Text style={styles.packMeta}>
                      {offer.pack.label}
                      {saving ? ` · Save ${saving}%` : ""}
                    </Text>
                  </View>
                  {isBuying ? <ActivityIndicator color={colors.fg} /> : <Text style={styles.price}>{offer.displayPrice}</Text>}
                </Pressable>
              );
            })
          : null}

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        <Text style={styles.small}>
          Paid with your Apple ID. All sales are final, and swaps you buy don&apos;t expire. Refund requests go to Apple.
        </Text>
        <LegalLinks />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.md, gap: space.md },
  fill: { flex: 1 },
  title: { ...display, fontSize: 32, lineHeight: 35, marginTop: space.sm },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23, color: colors.muted },
  loading: { marginVertical: space.lg },
  pack: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    minHeight: 72,
  },
  best: { borderColor: colors.accent, borderWidth: 2 },
  pressed: { backgroundColor: colors.surface },
  off: { opacity: 0.5 },
  packTitle: { fontFamily: fonts.semibold, fontSize: 18, color: colors.fg },
  badge: { fontFamily: fonts.semibold, fontSize: 13, color: colors.accentInk },
  packMeta: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, marginTop: 2 },
  price: { fontFamily: fonts.semibold, fontSize: 18, color: colors.fg },
  done: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, gap: space.md },
  doneTitle: { fontFamily: fonts.semibold, fontSize: 17, color: colors.fg },
  notice: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21, color: colors.fg },
  small: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.muted },
});
