import { MAX_SWAPS_PER_PICTURE } from "@retrofit/core";
import { PlanPicker } from "@/components/account/plan-picker";

/** One real example of a single picture with several swaps in it. */
const EXAMPLE_SWAPS = ["Sofa", "Rug", "Wall colour"];

const NOTES = [
  "Switch plans anytime.",
  "If a picture fails, you get it back.",
  "Going back to an earlier version is free.",
];

/**
 * What it costs, and what you get for it. The one idea to land: a plan gives finished pictures
 * every month, and one picture can hold several swaps. Plans come from the same list the app uses.
 */
export function Pricing() {
  return (
    <section id="pricing" aria-labelledby="pricing-title" className="scroll-mt-20">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-4">
        <h2 id="pricing-title" className="display text-[2.4rem] font-semibold sm:text-[3.4rem]">
          Pricing
        </h2>
        <p className="text-[15px] text-muted">Monthly or yearly. Cancel anytime.</p>
      </div>

      <PictureExplainer />
      <PlanPicker variant="page" />

      <ul className="mt-6 grid gap-2 text-[15px] text-muted sm:grid-cols-3">
        {NOTES.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </section>
  );
}

/** Picture vs swap, with a worked example people can picture. */
function PictureExplainer() {
  return (
    <div className="mt-8 grid gap-8 rounded-[28px] bg-surface p-7 sm:p-10 md:grid-cols-[1fr_1.1fr] md:items-center">
      <div>
        <h3 className="display text-[2rem] font-semibold leading-tight sm:text-[2.6rem]">Plans count pictures, not items.</h3>
        <p className="mt-3 text-[17px] text-muted sm:text-[19px]">
          A <span className="font-semibold text-fg">swap</span> is one thing you change, like the sofa. A{" "}
          <span className="font-semibold text-fg">picture</span> is the new photo we make, and one picture can hold up to{" "}
          {MAX_SWAPS_PER_PICTURE} swaps at once.
        </p>
      </div>

      <div className="rounded-[22px] bg-bg p-6 sm:p-7">
        <p className="text-[14px] font-semibold text-muted">Example</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {EXAMPLE_SWAPS.map((part) => (
            <span key={part} className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-[16px] font-semibold">
              {part}
            </span>
          ))}
        </div>
        <p className="mt-4 text-[17px]">
          {EXAMPLE_SWAPS.length} swaps in one photo <span className="text-muted">=</span>{" "}
          <span className="font-semibold text-accent-ink">1 picture</span>
        </p>
        <p className="mt-1 text-[15px] text-muted">
          Want a different sofa after that? That&apos;s a new picture. So more pictures means more looks to compare.
        </p>
      </div>
    </div>
  );
}
