"use client";

import { Check } from "lucide-react";
import type { Chosen } from "@/lib/build/remix";
import type { StudioPart } from "@/lib/build/parts";

interface PicksTrayProps {
  parts: StudioPart[];
  chosen: Record<string, Chosen>;
  onShow: (partId: string) => void;
  onRemove: (partId: string) => void;
}

/** Everything picked so far, one per part. Tap one to see its row, × to take it out. */
export function PicksTray({ parts, chosen, onShow, onRemove }: PicksTrayProps) {
  const picks = parts.flatMap((part) => (chosen[part.id] ? [{ part, pick: chosen[part.id]! }] : []));
  if (!picks.length) return null;

  return (
    <ul aria-label="Your picks" className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:px-0">
      {picks.map(({ part, pick }) => (
        <li
          key={`${part.id}-${pick.label}`}
          className="flex h-11 shrink-0 items-center gap-2 rounded-full border border-line bg-surface pl-1.5 pr-1 motion-safe:animate-[sticker-in_280ms_var(--ease-out)]"
        >
          <button type="button" onClick={() => onShow(part.id)} className="flex min-w-0 items-center gap-2" title={pick.label}>
            <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-white">
              {pick.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- a small product thumbnail
                <img src={pick.image} alt="" className="size-full object-contain p-0.5" />
              ) : pick.swatch ? (
                <span className="size-full" style={{ backgroundColor: pick.swatch }} />
              ) : (
                <span className="grid size-full place-items-center bg-accent text-on-accent">
                  <Check aria-hidden className="size-4" strokeWidth={3} />
                </span>
              )}
            </span>
            <span className="max-w-32 truncate text-[13px] font-semibold">
              <span className="text-muted">{part.label}:</span> {pick.label}
            </span>
          </button>
          <button
            type="button"
            onClick={() => onRemove(part.id)}
            aria-label={`Take out ${pick.label}`}
            className="grid size-8 shrink-0 place-items-center rounded-full text-[16px] text-muted hover:bg-surface-2 hover:text-fg"
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  );
}
