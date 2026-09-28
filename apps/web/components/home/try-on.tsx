"use client";

import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { useState } from "react";
import { CompareSlider } from "@/components/ui/compare-slider";
import { TRY_ON_DEMO } from "@/lib/demo";

type Look = (typeof TRY_ON_DEMO.looks)[number];

function LookButton({ look, isActive, onSelect }: { look: Look; isActive: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isActive}
      className={`flex w-[184px] shrink-0 items-center gap-3 rounded-[16px] border p-2 pr-3 text-left transition-[border-color,background-color,transform] duration-150 ease-out active:scale-[0.98] md:w-full ${
        isActive ? "border-accent bg-surface" : "border-line hover:border-fg/40"
      }`}
    >
      <span className="photo-edge relative h-14 w-11 shrink-0 overflow-hidden rounded-[10px] bg-surface-2">
        <Image src={look.image} alt="" fill sizes="44px" className="object-cover object-top" />
      </span>
      <span className="min-w-0">
        <span className={`block truncate text-[15px] font-semibold ${isActive ? "text-fg" : "text-muted"}`}>{look.label}</span>
        <span className="block truncate text-[13px] text-muted">{look.pieces.length} pieces</span>
      </span>
    </button>
  );
}

function Frame({ before, look }: { before: StaticImageData; look: Look }) {
  return (
    // Keyed by look, so each pick plays the short sweep that shows the slider can be dragged.
    <CompareSlider
      key={look.id}
      before={before}
      after={look.image}
      beforeAlt={TRY_ON_DEMO.beforeAlt}
      afterAlt={look.alt}
      aspect={TRY_ON_DEMO.aspect}
      intro
      sizes="(min-width: 768px) 460px, 100vw"
      className="w-full rounded-[24px]"
    />
  );
}

/** One person, many outfits: pick a look and drag to compare it with what she had on. */
export function TryOn() {
  const [active, setActive] = useState(0);
  const look = TRY_ON_DEMO.looks[active]!;

  return (
    <section aria-labelledby="try-on-title" className="grid grid-cols-[minmax(0,1fr)] items-start gap-8 md:grid-cols-[minmax(0,460px)_1fr] md:gap-14">
      <div className="md:order-2 md:pt-6">
        <h2 id="try-on-title" className="display text-[2.4rem] font-semibold sm:text-[3.4rem]">
          Try it on first.
        </h2>
        <p className="mt-3 max-w-md text-[16px] text-muted">
          One photo of you. Try the dress, the blazer, the boots. Keep the look you love, then buy it.
        </p>

        <div role="group" aria-label="Outfits" className="-mx-4 mt-7 flex gap-2.5 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-2 md:px-0">
          {TRY_ON_DEMO.looks.map((l, i) => (
            <LookButton key={l.id} look={l} isActive={i === active} onSelect={() => setActive(i)} />
          ))}
        </div>

        <ul aria-label={`What she has on: ${look.label}`} className="mt-5 flex flex-wrap gap-2">
          {look.pieces.map((piece) => (
            <li key={piece} className="rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] font-semibold">
              {piece}
            </li>
          ))}
        </ul>

        <Link
          href="/scan/clothing"
          className="mt-7 hidden h-11 items-center rounded-full bg-accent px-5 text-[15px] font-semibold text-on-accent transition-[transform,background-color] duration-150 ease-out hover:bg-accent-2 active:scale-[0.97] md:inline-flex"
        >
          Try on with my photo
        </Link>
      </div>

      <figure className="mx-auto w-full max-w-[460px] md:order-1">
        <Frame before={TRY_ON_DEMO.before} look={look} />
        <figcaption className="mt-3 flex items-baseline justify-between gap-3 text-[13px] text-muted">
          <span>Drag to compare with the photo she took.</span>
          <span className="shrink-0">AI-generated example.</span>
        </figcaption>
        <Link
          href="/scan/clothing"
          className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-full bg-accent px-5 text-[15px] font-semibold text-on-accent transition-[transform,background-color] duration-150 ease-out active:scale-[0.97] md:hidden"
        >
          Try on with my photo
        </Link>
      </figure>
    </section>
  );
}
