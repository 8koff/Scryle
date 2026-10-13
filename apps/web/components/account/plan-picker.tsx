"use client";

import Link from "next/link";
import { getPlanTier, previewOffers, yearlySavingPercent, type PlanOffer, type PlanPeriod, type PlanTierId } from "@retrofit/core";
import { useEffect, useState } from "react";
import { SignInSheet } from "@/components/account/sign-in-sheet";
import { loadWebOffers, subscribeWeb, type SubscribeResult, type WebOffers } from "@/lib/account/subscribe";
import { account, useAccount } from "@/lib/account/use-account";

const PER: Record<PlanPeriod, string> = { monthly: "month", yearly: "year" };

/** What each plan is good for, in plain words. */
const FOR: Record<PlanTierId, string> = {
  starter: "A few looks a month for one room or one outfit.",
  plus: "Compare looks for a couple of rooms, or your car.",
  pro: "Redo your home, car and wardrobe, and compare lots of looks.",
};

/** Re-reads the account; true once the server reports a plan. */
async function hasPlanNow(): Promise<boolean> {
  await account.refreshCredits();
  const me = account.getSnapshot();
  return me.status === "signed-in" && Boolean(me.plan);
}

/**
 * The plans, monthly or yearly, and one Subscribe button (same plans and prices as the iPhone app).
 * Signed out, Subscribe asks for sign-in first, then carries on. "page" is the home pricing section;
 * "sheet" sits inside the buy sheet.
 */
export function PlanPicker({ variant, onSubscribed }: { variant: "page" | "sheet"; onSubscribed?: () => void }) {
  const me = useAccount();
  const userId = me.status === "signed-in" ? me.userId : null;
  const current = me.status === "signed-in" ? me.plan : null;
  const [period, setPeriod] = useState<PlanPeriod>(current?.period ?? "monthly");
  const [tier, setTier] = useState<PlanTierId>(current?.tier ?? "pro");
  const [offers, setOffers] = useState<WebOffers | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [waitingForSignIn, setWaitingForSignIn] = useState(false);

  // Signed in: the real plans from RevenueCat. Signed out: the prices only, to read before signing in.
  useEffect(() => {
    if (!userId) return;
    let isLive = true;
    void loadWebOffers(userId).then((result) => isLive && setOffers(result));
    return () => {
      isLive = false;
    };
  }, [userId]);

  const list: PlanOffer[] = !userId ? previewOffers() : offers && offers.status !== "unavailable" ? offers.offers : [];
  const shown = list.filter((o) => o.period === period);
  const chosen = shown.find((o) => o.tier.id === tier) ?? null;
  const isCurrent = (o: PlanOffer) => current?.tier === o.tier.id && current.period === o.period;
  const saving = yearlySavingPercent(getPlanTier("pro")!);

  const subscribe = async () => {
    if (!chosen || busy) return;
    const fresh = account.getSnapshot();
    if (fresh.status !== "signed-in") return setWaitingForSignIn(true);
    setBusy(true);
    setNotice(null);
    // Chosen while signed out, the card was display-only: find the same plan among RevenueCat's.
    let pool = offers && offers.status !== "unavailable" ? offers.offers : null;
    if (!pool) {
      const loaded = await loadWebOffers(fresh.userId);
      setOffers(loaded);
      pool = loaded.status !== "unavailable" ? loaded.offers : [];
    }
    const target = pool.find((o) => o.productId === chosen.productId);
    if (!target) {
      setBusy(false);
      return setNotice("That plan isn't available right now. Please try again.");
    }
    const result: SubscribeResult = await subscribeWeb(target, fresh.userId, hasPlanNow, fresh.email);
    setBusy(false);
    if (result.kind === "active") onSubscribed?.();
    else if (result.kind === "pending") setNotice("Payment received. Your plan is being set up and will appear in a moment.");
    else if (result.kind === "error") setNotice(result.message);
  };

  return (
    <div className={variant === "page" ? "mt-6" : "mt-4"}>
      <div role="tablist" aria-label="Billing period" className="inline-flex rounded-full bg-surface-2 p-1">
        {(["monthly", "yearly"] as const).map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={period === p}
            onClick={() => setPeriod(p)}
            className={`flex h-9 items-center gap-1.5 rounded-full px-4 text-[14px] font-semibold transition-colors ${
              period === p ? "bg-fg text-bg" : "text-muted hover:text-fg"
            }`}
          >
            {p === "monthly" ? "Monthly" : "Yearly"}
            {p === "yearly" && <span className={period === p ? "text-bg" : "text-accent-ink"}>Save {saving}%</span>}
          </button>
        ))}
      </div>

      {userId && offers === null && <p className="mt-4 text-[14px] text-muted">Loading plans…</p>}
      {offers?.status === "unavailable" && <p className="mt-4 text-[15px] font-medium">{offers.message}</p>}
      {offers?.status === "preview" && <p className="mt-4 text-[13px] text-muted">Preview: {offers.message} Showing the plans&apos; prices.</p>}

      <div role="radiogroup" aria-label="Plans" className={`mt-4 grid gap-3 ${variant === "page" ? "md:grid-cols-3" : ""}`}>
        {shown.map((o) => {
          const isOn = o.tier.id === tier;
          return (
            <button
              key={o.productId}
              type="button"
              role="radio"
              aria-checked={isOn}
              onClick={() => setTier(o.tier.id)}
              className={`flex w-full flex-col rounded-[24px] p-5 text-left transition-[border-color,transform] active:scale-[0.99] sm:p-6 ${
                isOn ? "border-2 border-accent bg-surface-2" : "border border-line bg-surface hover:border-fg/40"
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-[17px] font-semibold">
                  {o.tier.label}
                  {isCurrent(o) && <span className="text-accent-ink"> · Current plan</span>}
                </span>
                {o.tier.isBestValue && <span className="rounded-full bg-accent/20 px-2.5 py-0.5 text-[12px] font-semibold text-accent-ink">Best value</span>}
              </span>
              <span className="mt-3 flex items-baseline gap-1.5">
                <span className="display text-[2.6rem] font-semibold leading-none tabular-nums">{o.tier.swapsPerMonth}</span>
                <span className="text-[15px] text-muted">pictures a month</span>
              </span>
              {variant === "page" && <span className="mt-2 text-[15px] text-muted">{FOR[o.tier.id]}</span>}
              <span className="mt-4 text-[20px] font-semibold tabular-nums">
                {o.priceString}
                <span className="text-[14px] font-normal text-muted"> / {PER[o.period]}</span>
              </span>
            </button>
          );
        })}
      </div>

      {notice && (
        <p role="alert" className="mt-3 text-[14px] font-medium text-accent-ink">
          {notice}
        </p>
      )}

      <button
        type="button"
        onClick={() => void subscribe()}
        disabled={!chosen || busy || (chosen ? isCurrent(chosen) : false) || me.status === "unavailable"}
        className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-full bg-accent text-[16px] font-semibold text-on-accent transition-[transform,background-color,opacity] hover:bg-accent-2 active:scale-[0.98] disabled:opacity-50"
      >
        {busy
          ? "Opening…"
          : !chosen
            ? "Subscribe"
            : isCurrent(chosen)
              ? "This is your plan"
              : `${current ? "Switch to" : "Subscribe to"} ${chosen.tier.label} · ${chosen.priceString}/${chosen.period === "monthly" ? "mo" : "yr"}`}
      </button>
      <p className="mt-3 text-[12px] leading-relaxed text-muted">
        Renews automatically every {PER[period]} until you cancel. Cancel anytime from your account. Pictures you don&apos;t use
        don&apos;t carry over to the next month. Secure payment by Stripe.{" "}
        <Link href="/terms#payments" target="_blank" className="underline underline-offset-2 hover:text-fg">
          Terms
        </Link>
      </p>

      <SignInSheet
        open={waitingForSignIn}
        onClose={() => setWaitingForSignIn(false)}
        onSignedIn={() => {
          setWaitingForSignIn(false);
          void subscribe();
        }}
      />
    </div>
  );
}
