"use client";

import { CompareSlider, REVEAL } from "@/components/ui/compare-slider";
import { HERO_DEMO } from "@/lib/demo";

const DEMO = HERO_DEMO.room;

/** Three of the room's swaps, pinned on the "after" side (frame-relative, 0..100). */
const PINS = [
  { part: "Wall", to: "Framed art", top: 24, right: 6 },
  { part: "Sofa", to: "Cream bouclé", top: 57, right: 3 },
  { part: "Rug", to: "Cream wool", top: 77, right: 8 },
] as const;

const at = (ms: number) => ({ animationDelay: `${ms}ms` });
const POP = "motion-safe:animate-[reveal-pop_450ms_var(--ease-out)_both]";
const LANDED = REVEAL.wipeAt + REVEAL.wipeMs;

/** Viewfinder corners, like the camera screen. */
function Corners() {
  const corner = "absolute size-7 border-white/90";
  return (
    <div aria-hidden className="pointer-events-none absolute inset-4">
      <span className={`${corner} left-0 top-0 rounded-tl-[6px] border-l-2 border-t-2`} />
      <span className={`${corner} right-0 top-0 rounded-tr-[6px] border-r-2 border-t-2`} />
      <span className={`${corner} bottom-8 left-0 rounded-bl-[6px] border-b-2 border-l-2`} />
      <span className={`${corner} bottom-8 right-0 rounded-br-[6px] border-b-2 border-r-2`} />
    </div>
  );
}

/** Pops in once the new version has wiped across: what was found, and three of the swaps. */
function Overlay() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <Corners />
      <span
        className={`absolute left-1/2 top-5 -translate-x-1/2 rounded-[6px] bg-black/70 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md ${POP}`}
        style={at(LANDED - 100)}
      >
        {DEMO.swaps.length} swaps in one photo
      </span>
      {PINS.map((pin, i) => (
        <span
          key={pin.part}
          className={`absolute flex items-center gap-2 rounded-full bg-white py-1.5 pl-2 pr-3 text-[13px] font-semibold text-[#161513] shadow-[0_6px_18px_rgb(0_0_0/0.22)] ${POP}`}
          style={{ top: `${pin.top}%`, right: `${pin.right}%`, ...at(LANDED + 120 * i) }}
        >
          <span aria-hidden className="size-3 rounded-full border-2 border-white bg-accent shadow-[0_0_0_1.5px_var(--accent)]" />
          {pin.part} → {pin.to}
        </span>
      ))}
    </div>
  );
}

/** The room makeover as a before/after you can drag, in a dark tablet frame tilted a little. */
export function WaitlistDemo() {
  return (
    <div className="rotate-[2deg] rounded-[34px] bg-[#161513] p-[10px] shadow-[0_50px_90px_-30px_rgb(22_21_19/0.55)]">
      <CompareSlider
        before={DEMO.before}
        after={DEMO.after}
        beforeAlt="A plain living room with white walls, a grey sofa and a light oak floor"
        afterAlt="The same room upgraded in place: a cream bouclé sofa, framed art, brass lights and a cream wool rug"
        aspect={4 / 5}
        focus={{ x: 0.74, y: 0.5 }}
        intro="reveal"
        priority
        sizes="(min-width: 1024px) 460px, 100vw"
        overlay={<Overlay />}
        className="rounded-[22px]"
      />
    </div>
  );
}
