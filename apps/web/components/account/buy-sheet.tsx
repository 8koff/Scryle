"use client";

import { MAX_SWAPS_PER_PICTURE } from "@retrofit/core";
import { useAccount } from "@/lib/account/use-account";
import { Sheet } from "@/components/ui/sheet";
import { PlanPicker } from "./plan-picker";

interface BuySheetProps {
  open: boolean;
  onClose: () => void;
  /** Kept for the callers; subscribing happens on the page now, so nothing is sent back here. */
  returnTo: string;
}

/** The plans, in a sheet: subscribe, or switch plan. Payment happens on the page (RevenueCat Web Billing). */
export function BuySheet({ open, onClose }: BuySheetProps) {
  const current = useAccount();
  const plan = current.status === "signed-in" ? current.plan : null;
  const credits = current.status === "signed-in" ? current.credits : null;

  return (
    <Sheet open={open} onClose={onClose} label="Plans">
      <h2 className="display text-[2rem] font-semibold">
        {plan ? (credits === 0 ? "You've used this month's pictures" : "Change your plan") : "Pick a plan to start"}
      </h2>
      <p className="mt-2 text-[15px] text-muted">
        Each plan gives pictures every month. One picture can hold up to {MAX_SWAPS_PER_PICTURE} swaps, and if a picture fails, you get
        it back.
      </p>
      {open && <PlanPicker variant="sheet" onSubscribed={onClose} />}
    </Sheet>
  );
}
