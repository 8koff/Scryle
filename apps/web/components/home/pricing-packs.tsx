"use client";

import { CREDIT_PACKS, formatUsd, type CreditPackId } from "@retrofit/core";
import { useState } from "react";
import { SignInSheet } from "@/components/account/sign-in-sheet";
import { startCheckout } from "@/lib/account/checkout";
import { account, useAccount } from "@/lib/account/use-account";

const button =
  "inline-flex h-11 w-max items-center rounded-full px-5 text-[15px] font-semibold transition-[transform,opacity] active:scale-[0.97] disabled:opacity-50";

/**
 * The pack cards, each with its own Buy button. Signed out, Buy asks for sign-in first and
 * then carries on to that pack's payment page.
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
      {CREDIT_PACKS.map((pack) => (
        <div key={pack.id} className="flex flex-col rounded-[24px] border border-line bg-surface p-7">
          <p className="flex items-center justify-between gap-2 text-[15px] font-semibold text-muted">
            {pack.label}
            {pack.isBestValue && (
              <span className="rounded-full border border-line px-2.5 py-0.5 text-[12px] font-semibold text-accent-ink">Best value</span>
            )}
          </p>
          <p className="display mt-3 text-[3.2rem] font-semibold">{formatUsd(pack.priceCents)}</p>
          <p className="mb-8 mt-1 text-[15px] text-muted">
            {pack.credits} swaps, {Math.round(pack.priceCents / pack.credits)}¢ each.
          </p>
          <button
            type="button"
            onClick={() => choose(pack.id)}
            disabled={busy !== null || me.status === "unavailable"}
            className={`${button} mt-auto ${pack.isBestValue ? "bg-accent text-on-accent" : "bg-surface-2 hover:bg-line"}`}
          >
            {busy === pack.id ? "Opening…" : `Buy ${pack.label}`}
          </button>
        </div>
      ))}
      {error && (
        <p role="alert" className="text-[14px] font-medium text-accent-ink sm:col-span-2 lg:col-span-4">
          {error}
        </p>
      )}
      <SignInSheet open={waitingFor !== null} onClose={() => setWaitingFor(null)} onSignedIn={signedIn} />
    </>
  );
}
