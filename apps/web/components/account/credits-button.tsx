"use client";

import type { Account } from "@/lib/account/account-store";

interface CreditsButtonProps {
  current: Account;
  onSignIn: () => void;
  onBuy: () => void;
}

const BASE = "h-9 min-w-20 rounded-full bg-surface-2 px-3.5 text-[14px] font-semibold transition-colors hover:bg-line";

/** Top-right of the studio: "Sign in", or how many renders are left. */
export function CreditsButton({ current, onSignIn, onBuy }: CreditsButtonProps) {
  if (current.status === "signed-out") {
    return (
      <button type="button" onClick={onSignIn} className={BASE}>
        Sign in
      </button>
    );
  }
  if (current.status !== "signed-in") return <span className="w-20" />;
  const n = current.credits;
  return (
    <button
      type="button"
      onClick={onBuy}
      className={`${BASE} tabular-nums`}
      aria-label={n === null ? "Your swaps" : `${n} swaps left. Get more`}
    >
      {n === null ? "…" : `${n} swap${n === 1 ? "" : "s"}`}
    </button>
  );
}
