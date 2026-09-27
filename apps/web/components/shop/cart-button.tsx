"use client";

import { ShoppingBag } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/lib/shop/use-cart";
import { CartSheet } from "./cart-sheet";

/** The cart in the header. Hidden until something is in it. */
export function CartButton() {
  const summary = useCart();
  const [open, setOpen] = useState(false);
  if (summary.count === 0 && !open) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Cart, ${summary.count} item${summary.count === 1 ? "" : "s"}`}
        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-[14px] font-semibold tabular-nums transition-colors hover:bg-line"
      >
        <ShoppingBag aria-hidden className="size-4" strokeWidth={2} />
        {summary.count}
      </button>
      <CartSheet open={open} onClose={() => setOpen(false)} summary={summary} />
    </>
  );
}
