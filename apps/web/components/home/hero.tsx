"use client";

import type { Box, PackId } from "@retrofit/core";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { useState } from "react";
import { CompareSlider, REVEAL } from "@/components/ui/compare-slider";
import { HudBox } from "@/components/ui/hud-box";
import { HERO_DEMO } from "@/lib/demo";

type Demo = {
  pack: PackId;
  label: string;
  examples: string;
  cta: string;
  before: StaticImageData;
  after: StaticImageData;
  photoAspect: number;
  /** The part of a wide photo to keep in view when it is cropped. */
  focus: { x: number; y: number };
  box: Box;
  swaps: readonly { part: string; to: string }[];
  beforeAlt: string;
  afterAlt: string;
};

const DEMOS: Demo[] = [
  {
    pack: "room",
    label: "Room",
    examples: "Sofas, walls, decor",
    cta: "Scan my room",
    ...HERO_DEMO.room,
    photoAspect: HERO_DEMO.room.aspect,
    focus: { x: 0.5, y: 0.6 },
    beforeAlt: "A plain living room with white walls, a grey sofa, a basic coffee table and a light oak floor",
    afterAlt: "The same room, every piece upgraded in place: a cream bouclé sofa, a travertine table, a walnut console, framed art, brass lights, a wool rug on the same oak floor and an olive tree",
  },
  {
    pack: "car",
    label: "Car",
    examples: "Paint, wheels, tint",
    cta: "Scan my car",
    ...HERO_DEMO.car,
    photoAspect: HERO_DEMO.car.aspect,
    focus: { x: 0.5, y: 0.6 },
    beforeAlt: "A plain silver sedan on a rooftop car park at sunset",
    afterAlt: "The same car in satin matte black with bronze wheels, dark windows and a lower stance",
  },
  {
    pack: "clothing",
    label: "Clothing",
    examples: "Coats, trousers, shoes",
    cta: "Scan yourself",
    ...HERO_DEMO.person,
    photoAspect: HERO_DEMO.person.aspect,
    focus: { x: 0.5, y: 0.3 },
    beforeAlt: "A person in a grey hoodie, jeans and white sneakers",
    afterAlt: "The same person in a camel overcoat, black roll-neck, charcoal trousers and Chelsea boots",
  },
];

/** Starts before the wipe, in step with the slider's reveal. */
const at = (ms: number) => ({ animationDelay: `${ms}ms` });
const POP = "motion-safe:animate-[reveal-pop_450ms_var(--ease-out)_both]";

/** What changed, as a row of chips under the photo. Pops in once the new version has wiped across. */
function SwapStrip({ demo }: { demo: Demo }) {
  return (
    <div aria-label={`${demo.swaps.length} swaps in one photo`} className="mt-2.5 flex flex-wrap items-center gap-2">
      <span className={`mr-1 text-[13px] font-semibold text-muted ${POP}`} style={at(REVEAL.wipeAt + REVEAL.wipeMs - 100)}>
        {demo.swaps.length} swaps, one photo
      </span>
      {demo.swaps.map((s, i) => (
        <span
          key={s.part}
          className={`inline-flex items-baseline gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] ${POP}`}
          style={at(REVEAL.wipeAt + REVEAL.wipeMs + 70 * i)}
        >
          <span className="text-muted">{s.part}</span>
          <span className="font-semibold">{s.to}</span>
        </span>
      ))}
    </div>
  );
}

/** The plain photo gets "read": a scan line passes and the part box locks on. */
function ScanOverlay({ box }: { box: Box }) {
  return (
    <>
      <div
        aria-hidden
        className="absolute inset-0 hidden overflow-hidden motion-safe:block"
      >
        <div
          className="absolute inset-x-0 h-2/5 opacity-0 motion-safe:animate-[reveal-scan_1100ms_ease-in-out_both]"
          style={{
            ...at(150),
            background: "linear-gradient(to bottom, transparent, rgb(74 112 181 / 0.35) 88%, rgb(255 255 255 / 0.95) 99%)",
            boxShadow: "0 8px 30px rgb(255 255 255 / 0.5)",
          }}
        />
      </div>
      {/* Full size: the pop animation's transform makes this the box's frame of reference. */}
      <div className={`absolute inset-0 ${POP}`} style={at(900)}>
        <HudBox box={box} isActive size="lg" />
      </div>
      {/* The flash as the new version lands. */}
      <div
        aria-hidden
        className="absolute inset-0 hidden bg-white opacity-0 motion-safe:block motion-safe:animate-[reveal-flash_700ms_ease-out_both]"
        style={at(REVEAL.wipeAt + REVEAL.wipeMs - 150)}
      />
    </>
  );
}

/**
 * The first screen is the product: a big before/after you can drag. It opens with a reveal
 * (scan → mark the parts → the new version wipes in), then sways until someone touches it.
 */
export function Hero() {
  const [active, setActive] = useState(0);
  const demo = DEMOS[active]!;
  const isTall = demo.photoAspect < 1;

  return (
    // Full width of the page column. The photo frame is capped by the screen height instead of
    // the column shrinking, so a short window (or 150% zoom) crops the photo but never the layout.
    <section aria-labelledby="hero-title" className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      {/* One slim line above the demo: headline (and a short line on wide screens) left, buttons right.
          Kept short on purpose, so the before/after sits high on the screen. */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 pb-5 pt-4 sm:pt-6">
        <div className="flex min-w-0 items-baseline gap-5">
          <h1 id="hero-title" className="display text-[2.6rem] font-semibold sm:text-[3.4rem] lg:text-[3.9rem]">
            See it before you buy it.
          </h1>
          <p className="hidden truncate text-[16px] text-muted xl:block">Tap a part. See the swap on your own photo.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <Link
            href={`/scan/${demo.pack}`}
            className="inline-flex h-11 items-center rounded-full bg-accent px-5 text-[15px] font-semibold text-on-accent transition-[transform,background-color] duration-150 ease-out hover:bg-accent-2 active:scale-[0.97]"
          >
            {demo.cta}
          </Link>
          <Link
            href="#how"
            className="inline-flex h-11 items-center rounded-full border border-line px-5 text-[15px] font-semibold transition-colors hover:border-fg active:scale-[0.97]"
          >
            How it works
          </Link>
        </div>
      </div>

      {/* Keyed, so each tab replays the reveal. Wide photos fill the 16:9 frame (almost no crop);
          tall ones (people) stand in the middle at full height over a soft copy of themselves. */}
      <div key={demo.pack}>
        <div
          className={`relative aspect-[4/5] max-h-[78svh] min-h-[320px] w-full overflow-hidden rounded-[28px] bg-surface-2 sm:aspect-[16/9] sm:max-h-[80svh] sm:rounded-[32px] ${
            isTall ? "flex justify-center" : ""
          }`}
        >
          {isTall && <Image src={demo.after} alt="" fill sizes="60vw" className="scale-110 object-cover opacity-70 blur-2xl" />}
          <CompareSlider
            before={demo.before}
            after={demo.after}
            beforeAlt={demo.beforeAlt}
            afterAlt={demo.afterAlt}
            aspect={isTall ? demo.photoAspect : undefined}
            photoAspect={isTall ? undefined : demo.photoAspect}
            focus={demo.focus}
            intro="reveal"
            priority
            sizes={isTall ? "(min-width: 640px) 500px, 100vw" : "(min-width: 640px) 1250px, 100vw"}
            className={isTall ? "h-full w-auto" : "size-full"}
            overlay={<ScanOverlay box={demo.box} />}
          />
        </div>
        <SwapStrip demo={demo} />
        <p className="mt-2 text-[12px] text-muted">Examples. The demo photos are AI-generated.</p>
      </div>

      <div role="group" aria-label="Examples" className="-mx-4 mt-2 flex overflow-x-auto border-b border-line px-4 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0">
        {DEMOS.map((d, i) => (
          <button
            key={d.pack}
            type="button"
            onClick={() => setActive(i)}
            aria-pressed={i === active}
            className={`-mb-px flex shrink-0 items-center gap-3.5 border-b-2 px-3 pb-4 pt-5 text-left transition-colors ${
              i === active ? "border-accent" : "border-transparent hover:border-line"
            }`}
          >
            <span className="photo-edge relative size-12 shrink-0 overflow-hidden rounded-[12px] bg-surface-2">
              <Image src={d.after} alt="" fill sizes="48px" className="object-cover" />
            </span>
            <span>
              <span className={`block text-[17px] font-semibold ${i === active ? "text-fg" : "text-muted"}`}>{d.label}</span>
              <span className="block whitespace-nowrap text-[13px] text-muted">{d.examples}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
