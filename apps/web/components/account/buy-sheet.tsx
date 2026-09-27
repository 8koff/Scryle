"use client";

import Link from "next/link";
import { CREDIT_PACKS, formatUsd, type CreditPackId } from "@retrofit/core";
import { useState } from "react";
import { startCheckout } from "@/lib/account/checkout";
import { account, useAccount } from "@/lib/account/use-account";
import { Sheet } from "@/components/ui/sheet";
import { DeleteAccount } from "./delete-account";
import { InvitePanel } from "./invite-panel";

interface BuySheetProps {
  open: boolean;
  onClose: () => void;
  /** Stripe sends the buyer back here, e.g. "/build/abc123". */
  returnTo: string;
}

/** The credit packs. Tapping one goes to Stripe's payment page. */
export function BuySheet({ open, onClose, returnTo }: BuySheetProps) {
  const current = useAccount();
  const [busy, setBusy] = useState<CreditPackId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const credits = current.status === "signed-in" ? current.credits : null;

  const buy = async (pack: CreditPackId) => {
    setBusy(pack);
    setError(null);
    const problem = await startCheckout(pack, returnTo, account.authFetch);
    if (!problem) return;
    setBusy(null);
    setError(problem);
  };

  return (
    <Sheet open={open} onClose={onClose} label="Get more swaps">
      <h2 className="display text-[2rem] font-semibold">{credits === 0 ? "You're out of swaps" : "Get more swaps"}</h2>
      <p className="mt-2 text-[15px] text-muted">One swap puts your picks on your photo. If a swap fails, you get it back.</p>

      <ul className="mt-5 flex flex-col gap-2.5">
        {CREDIT_PACKS.map((pack) => (
          <li key={pack.id}>
            <button
              type="button"
              onClick={() => buy(pack.id)}
              disabled={busy !== null}
              className="flex w-full items-center justify-between rounded-2xl border border-line bg-bg px-5 py-4 text-left transition-[border-color,transform] hover:border-accent active:scale-[0.99] disabled:opacity-60"
            >
              <span>
                <span className="block text-[17px] font-semibold">{pack.credits} swaps</span>
                <span className="block text-[14px] text-muted">
                  {Math.round(pack.priceCents / pack.credits)}¢ each{pack.isBestValue ? ", best value" : ""}
                </span>
              </span>
              <span className="text-[17px] font-semibold text-accent-ink">{busy === pack.id ? "Opening…" : formatUsd(pack.priceCents)}</span>
            </button>
          </li>
        ))}
      </ul>

      {error && (
        <p role="alert" className="mt-3 text-[14px] font-medium text-accent-ink">
          {error}
        </p>
      )}

      {open && current.status === "signed-in" && <InvitePanel />}

      <div className="mt-5 flex items-center justify-between gap-3 text-[13px] text-muted">
        <span className="truncate">{current.status === "signed-in" ? current.email : null}</span>
        <span className="flex shrink-0 gap-4">
          <Link href="/renders" onClick={onClose} className="font-medium hover:text-fg">
            My swaps
          </Link>
          <button type="button" onClick={() => account.signOut().then(onClose)} className="font-medium hover:text-fg">
            Sign out
          </button>
        </span>
      </div>
      <p className="mt-2 text-[12px] text-muted">
        Secure payment by Stripe. Swaps don&apos;t expire.{" "}
        <Link href="/terms#payments" target="_blank" className="underline underline-offset-2 hover:text-fg">
          All sales are final.
        </Link>
      </p>
      {current.status === "signed-in" && <DeleteAccount key={String(open)} />}
    </Sheet>
  );
}
