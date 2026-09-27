"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { Product } from "@/lib/catalog/catalog";
import { addItem, parseCart, setQty, summarize, type CartItem, type CartSummary } from "./cart";
import { lookupProduct } from "./seen";

const KEY = "retrofit:cart";
const EVENT = "retrofit:cart-change";

/** The cart lives in this browser. Every tab sees the same one. */
function read(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function write(items: CartItem[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // Storage blocked (private mode): the cart just won't be kept.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export const cart = {
  add(products: (Product | undefined)[]) {
    write(products.reduce<CartItem[]>((items, p) => addItem(items, p), parseCart(read())));
  },
  setQty(productId: string, qty: number) {
    write(setQty(parseCart(read()), productId, qty));
  },
};

/** The cart, grouped by store, live across tabs. Empty while rendering on the server. */
export function useCart(): CartSummary {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  return useMemo(() => summarize(parseCart(raw), lookupProduct), [raw]);
}
