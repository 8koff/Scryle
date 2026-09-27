"use client";

import type { PackId } from "@retrofit/core";
import type { StudioPart } from "@/lib/build/parts";
import { remixChoices, type Chosen } from "@/lib/build/remix";
import { looksFor } from "@/lib/catalog/looks";

interface LooksRowProps {
  pack: PackId;
  parts: StudioPart[];
  activeId: string | null;
  onApply: (lookId: string, chosen: Record<string, Chosen>) => void;
}

/** One tap picks a whole look. Only looks that fit at least two parts of this photo are shown. */
export function LooksRow({ pack, parts, activeId, onApply }: LooksRowProps) {
  const looks = looksFor(pack)
    .map((look) => ({ look, chosen: remixChoices(pack, parts, look.selections) }))
    .filter(({ chosen }) => Object.keys(chosen).length >= 2);
  if (!looks.length) return null;

  return (
    <section aria-labelledby="looks-title">
      <h2 id="looks-title" className="text-[13px] font-semibold text-muted">
        Try a whole look
      </h2>
      <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:px-0">
        {looks.map(({ look, chosen }) => {
          const count = Object.keys(chosen).length;
          const isActive = activeId === look.id;
          return (
            <button
              key={look.id}
              type="button"
              onClick={() => onApply(look.id, chosen)}
              aria-pressed={isActive}
              className={`h-10 shrink-0 rounded-full border px-4 text-[14px] font-semibold transition-colors ${
                isActive ? "border-accent bg-accent text-on-accent" : "border-line bg-surface hover:border-muted"
              }`}
            >
              {look.name}
              <span className={`ml-1.5 font-medium ${isActive ? "text-on-accent/80" : "text-muted"}`}>{count} swaps</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
