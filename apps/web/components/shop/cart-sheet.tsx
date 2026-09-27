"use client";

import { formatUsd } from "@retrofit/core";
import { Sheet } from "@/components/ui/sheet";
import { MAX_QTY, shopLink, type CartLine, type CartSummary } from "@/lib/shop/cart";
import { cart } from "@/lib/shop/use-cart";

interface CartSheetProps {
  open: boolean;
  onClose: () => void;
  summary: CartSummary;
}

const stepper = "grid size-8 place-items-center rounded-full bg-surface-2 text-[16px] font-semibold transition-colors hover:bg-line disabled:opacity-40";

function Line({ line }: { line: CartLine }) {
  const { product, qty } = line;
  return (
    <li className="flex gap-3 py-3">
      <span className="size-16 shrink-0 overflow-hidden rounded-xl bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element -- a store's product photo */}
        <img src={product.image} alt="" className="size-full object-contain p-1" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="line-clamp-2 text-[14px] font-medium leading-snug">
          {product.sponsored && <span className="mr-1.5 text-[11px] font-semibold uppercase text-muted">Sponsored</span>}
          {product.title}
        </p>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2" role="group" aria-label={`How many of ${product.title}`}>
            <button type="button" className={stepper} onClick={() => cart.setQty(product.id, qty - 1)} aria-label={qty === 1 ? "Remove" : "One fewer"}>
              −
            </button>
            <span className="w-5 text-center text-[14px] tabular-nums">{qty}</span>
            <button type="button" className={stepper} onClick={() => cart.setQty(product.id, qty + 1)} disabled={qty >= MAX_QTY} aria-label="One more">
              +
            </button>
          </div>
          <span className="text-[14px] font-semibold tabular-nums">{formatUsd(line.lineCents)}</span>
        </div>
        <a
          href={shopLink(product.id)}
          target="_blank"
          rel="sponsored noopener"
          className="text-[13px] font-semibold text-accent-ink underline-offset-4 hover:underline"
        >
          Buy at {product.store} ↗
        </a>
      </div>
    </li>
  );
}

/** One cart across every build, grouped by store. You pay on each store's own site. */
export function CartSheet({ open, onClose, summary }: CartSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} label="Your cart">
      <div className="flex items-baseline justify-between">
        <h2 className="display text-[1.9rem] font-semibold">Your cart</h2>
        <button type="button" onClick={onClose} className="text-[15px] font-medium text-muted hover:text-fg">
          Close
        </button>
      </div>

      {summary.groups.length === 0 ? (
        <p className="py-8 text-[15px] text-muted">Your cart is empty. Add items from a swap with &ldquo;Shop this look&rdquo;.</p>
      ) : (
        <>
          <div className="-mx-6 mt-3 max-h-[55svh] overflow-y-auto px-6">
            {summary.groups.map((group) => (
              <section key={group.store} aria-label={group.store} className="border-t border-line pt-3 first:border-0">
                <div className="flex items-baseline justify-between text-[13px] font-semibold text-muted">
                  <h3>{group.store}</h3>
                  <span className="tabular-nums">{formatUsd(group.subtotalCents)}</span>
                </div>
                <ul className="divide-y divide-line">
                  {group.lines.map((line) => (
                    <Line key={line.product.id} line={line} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <div className="mt-3 flex items-baseline justify-between border-t border-line pt-4">
            <span className="text-[15px] font-semibold">Estimated total</span>
            <span className="text-[20px] font-semibold tabular-nums">{formatUsd(summary.totalCents)}</span>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-muted">
            You buy from each store on its own site, and its price may have changed. We may earn a commission; your price stays
            the same.
          </p>
        </>
      )}
    </Sheet>
  );
}
