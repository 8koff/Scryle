import { FREE_RENDERS } from "@retrofit/core";
import Link from "next/link";
import { PricingPacks } from "./pricing-packs";

/** What it costs, plainly. The numbers come from the same list the checkout uses. */
export function Pricing() {
  return (
    <section id="pricing" aria-labelledby="pricing-title" className="scroll-mt-20">
      <div className="flex items-baseline justify-between border-b border-line pb-4">
        <h2 id="pricing-title" className="display text-[2.4rem] font-semibold sm:text-[3.4rem]">
          Pricing
        </h2>
        <p className="text-[14px] text-muted">No subscription</p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col rounded-[24px] bg-accent p-7 text-on-accent">
          <p className="text-[15px] font-semibold text-on-accent/75">To start</p>
          <p className="display mt-3 text-[3.2rem] font-semibold">Free</p>
          <p className="mb-8 mt-1 text-[15px] text-on-accent/85">
            {FREE_RENDERS} swap when you sign in with your email. Browsing and scanning are always free.
          </p>
          <Link
            href="/app?pack=room"
            className="mt-auto inline-flex h-11 w-max items-center rounded-full bg-on-accent px-5 text-[15px] font-semibold text-accent transition-transform active:scale-[0.97]"
          >
            Try it free
          </Link>
        </div>

        <PricingPacks />
      </div>

      <p className="mt-5 text-[14px] text-muted">
        One swap puts everything you picked onto your photo at once. Swaps don&apos;t expire, and a failed swap is given back.
      </p>
    </section>
  );
}
