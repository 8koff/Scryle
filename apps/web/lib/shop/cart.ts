import { isBuyable, type BuyableProduct, type Product } from "@/lib/catalog/catalog";

export type CartItem = { productId: string; qty: number };
export type CartLine = { product: BuyableProduct; qty: number; lineCents: number };
export type CartGroup = { store: string; lines: CartLine[]; subtotalCents: number };
export type CartSummary = { groups: CartGroup[]; totalCents: number; count: number };

export const MAX_QTY = 20;
const MAX_ITEMS = 50;

const clampQty = (qty: number) => Math.min(MAX_QTY, Math.max(1, Math.round(qty)));

/** Adds a product (or one more of it). Only real, buyable products go in the cart. */
export function addItem(items: readonly CartItem[], product: Product | undefined): CartItem[] {
  if (!isBuyable(product)) return [...items];
  const existing = items.find((i) => i.productId === product.id);
  if (existing) return items.map((i) => (i === existing ? { ...i, qty: clampQty(i.qty + 1) } : i));
  if (items.length >= MAX_ITEMS) return [...items];
  return [...items, { productId: product.id, qty: 1 }];
}

/** Sets how many; 0 or less takes the product out. */
export function setQty(items: readonly CartItem[], productId: string, qty: number): CartItem[] {
  if (qty < 1) return items.filter((i) => i.productId !== productId);
  return items.map((i) => (i.productId === productId ? { ...i, qty: clampQty(qty) } : i));
}

/**
 * The cart grouped by store, with totals. Products that are gone from the catalog (or were
 * never for sale) are left out, so a stale cart can't show a wrong price.
 */
export function summarize(items: readonly CartItem[], find: (id: string) => Product | undefined): CartSummary {
  const groups = new Map<string, CartLine[]>();
  for (const item of items) {
    const product = find(item.productId);
    if (!isBuyable(product)) continue;
    const qty = clampQty(item.qty);
    const line = { product, qty, lineCents: product.priceCents * qty };
    groups.set(product.store, [...(groups.get(product.store) ?? []), line]);
  }
  const list = [...groups.entries()].map(([store, lines]) => ({
    store,
    lines,
    subtotalCents: lines.reduce((sum, l) => sum + l.lineCents, 0),
  }));
  return {
    groups: list,
    totalCents: list.reduce((sum, g) => sum + g.subtotalCents, 0),
    count: list.reduce((sum, g) => sum + g.lines.reduce((n, l) => n + l.qty, 0), 0),
  };
}

/** Reads a saved cart, dropping anything that doesn't look right. */
export function parseCart(raw: string | null): CartItem[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .filter((i): i is CartItem => typeof i?.productId === "string" && i.productId.length <= 120 && Number.isFinite(i?.qty))
      .slice(0, MAX_ITEMS)
      .map((i) => ({ productId: i.productId, qty: clampQty(i.qty) }));
  } catch {
    return [];
  }
}

/** Where a shopper goes to buy: our redirect adds the referral tag (see app/go/[id]). */
export const shopLink = (productId: string) => `/go/${encodeURIComponent(productId)}`;
