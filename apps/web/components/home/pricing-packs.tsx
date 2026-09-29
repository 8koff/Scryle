"use client";

import { CREDIT_PACKS, formatUsd, packSavingPercent, type CreditPack, type CreditPackId } from "@retrofit/core";
import { useState } from "react";
import { SignInSheet } from "@/components/account/sign-in-sheet";
import { startCheckout } from "@/lib/account/checkout";
import { account, useAccount } from "@/lib/account/use-account";

/** What each pack is good for, in plain words. */
const FOR: Record<CreditPackId, string> = {
  starter: "Try a few ideas for one room or one outfit.",
  plus: "Compare looks for a couple of rooms, or your car.",
  pro: "Redo your whole home, car and wardrobe, and compare lots of looks.",
};

const buttonBase =
  "mt-8 inline-flex h-12 w-full items-center justify-center rounded-full text-[16px] font-semibold transition-[transform,opacity,background-color] active:scale-[0.98] disabled:opacity-50";

/**
 * The pack cards, each with its own Buy button. Pro is the one we point people to: filled,
 * lifted and labelled. Signed out, Buy asks for sign-in first, then carries on to that pack.
 */
export function PricingPacks() {
  const me = useAccount();
  const [busy, setBusy] = useState<CreditPackId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [waitingFor, setWaitingFor] = useState<CreditPackId | null>(null);

  const checkout = async (pack: CreditPackId) => {
    setBusy(pack);
    setError(null);
    const problem = await startCheckout(pack, window.location.pathname, account.authFetch);
    if (!problem) return;
    setBusy(null);
    setError(problem);
  };

  const choose = (pack: CreditPackId) => {
    if (me.status === "signed-in") return void checkout(pack);
    setError(null);
    setWaitingFor(pack);
  };

  const signedIn = () => {
    const pack = waitingFor;
    setWaitingFor(null);
    if (pack) void checkout(pack);
  };

  return (
    <>
      <div className="mt-6 grid gap-4 md:grid-cols-3 md:items-end">
        {CREDIT_PACKS.map((pack) => (
          <PackCard
            key={pack.id}
            pack={pack}
            isBusy={busy === pack.id}
            isDisabled={busy !== null || me.status === "unavailable"}
            onBuy={() => choose(pack.id)}
          />
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-[15px] font-medium text-accent-ink">
          {error}
        </p>
      )}
      <SignInSheet open={waitingFor !== null} onClose={() => setWaitingFor(null)} onSignedIn={signedIn} />
    </>
  );
}

type PackCardProps = {
  pack: CreditPack;
  isBusy: boolean;
  isDisabled: boolean;
  onBuy: () => void;
};

function PackCard({ pack, isBusy, isDisabled, onBuy }: PackCardProps) {
  const saving = packSavingPercent(pack);
  const isHero = pack.isBestValue;
  const muted = isHero ? "text-on-accent/80" : "text-muted";

  return (
    <div
      className={`flex flex-col rounded-[28px] p-7 sm:p-8 ${
        isHero ? "bg-accent text-on-accent md:pb-10 md:pt-12" : "border border-line bg-surface"
      }`}
    >
      <div className="flex min-h-7 items-center justify-between gap-2">
        <p className="text-[19px] font-semibold">{pack.label}</p>
        {isHero && (
          <span className="rounded-full bg-on-accent px-3 py-1 text-[13px] font-semibold text-accent">Best value</span>
        )}
      </div>
      <p className={`mt-2 text-[16px] ${muted}`}>{FOR[pack.id]}</p>

      <p className={`display mt-6 font-semibold ${isHero ? "text-[4.2rem]" : "text-[3.4rem]"} leading-none`}>
        {formatUsd(pack.priceCents)}
      </p>
      <p className="mt-3 text-[20px] font-semibold">{pack.credits} pictures</p>
      <p className={`mt-1 min-h-6 text-[16px] ${muted}`}>
        {saving > 0 ? `Save ${saving}% compared with Starter` : "A good way to start"}
      </p>

      <button
        type="button"
        onClick={onBuy}
        disabled={isDisabled}
        className={`${buttonBase} ${isHero ? "bg-on-accent text-accent" : "bg-surface-2 hover:bg-line"}`}
      >
        {isBusy ? "Opening…" : `Get ${pack.label}`}
      </button>
    </div>
  );
}
