"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { getPack, PACKS, type PackId } from "@retrofit/core";
import { BuySheet } from "@/components/account/buy-sheet";
import { ScanFlow } from "@/components/scan/scan-flow";
import { useAccount } from "@/lib/account/use-account";
import { BUILD_EVENT, browserBuildStore, type Build } from "@/lib/build/store";
import { PACK_COVERS } from "@/lib/scan/covers";

const RECENT = 6;
const NONE: Build[] = [];

/** Recent builds in this browser, re-read when one changes. Cached so React sees a stable value. */
let cached: { key: string; builds: Build[] } = { key: "", builds: NONE };
function readRecent(): Build[] {
  const builds = browserBuildStore().recent(RECENT);
  const key = builds.map((b) => `${b.id}:${b.versions.length}`).join(",");
  if (key !== cached.key) cached = { key, builds };
  return cached.builds;
}
function subscribe(onChange: () => void) {
  window.addEventListener(BUILD_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(BUILD_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The photos you were working on today, so you can go straight back to them. */
function ContinueRow() {
  const builds = useSyncExternalStore(subscribe, readRecent, () => NONE);
  if (!builds.length) return null;

  return (
    <section aria-labelledby="continue-title" className="mt-10">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 id="continue-title" className="text-[15px] font-semibold">
          Pick up where you left off
        </h2>
        <p className="text-[13px] text-muted">Photos stay open for a day</p>
      </div>
      <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
        {builds.map((b) => {
          const last = [...b.versions].reverse().find((v) => v.status === "done" && v.imageUrl);
          const done = b.versions.filter((v) => v.status === "done").length;
          return (
            <li key={b.id} className="shrink-0">
              <Link href={`/app/build/${b.id}`} className="group block w-36 sm:w-40">
                <span className="photo-edge relative block aspect-[4/5] overflow-hidden rounded-[14px] bg-surface-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- the person's own photo on the render service */}
                  <img
                    src={last?.imageUrl ?? b.photoUrl}
                    alt=""
                    className="size-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04]"
                  />
                </span>
                <span className="mt-2 block text-[14px] font-semibold">{getPack(b.pack).label}</span>
                <span className="block text-[13px] text-muted">{done ? `${done} swap${done === 1 ? "" : "s"}` : "No swaps yet"}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** "Hi, Ada" and what you have left, so the first line of the app is about you, not the product. */
function Greeting() {
  const me = useAccount();
  const [isBuying, setIsBuying] = useState(false);
  if (me.status !== "signed-in") return null;
  const first = me.name?.split(/\s+/)[0];
  const n = me.credits;

  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <div>
        <p className="text-[14px] font-medium text-muted">{first ? `Hi, ${first}` : "Welcome back"}</p>
        <h1 className="mt-0.5 text-[1.5rem] font-semibold tracking-tight">What do you want to change?</h1>
      </div>
      {n !== null && (
        <p className="text-[14px] text-muted">
          {n === 0 ? (
            <>
              You&apos;re out of pictures.{" "}
              <button type="button" onClick={() => setIsBuying(true)} className="font-semibold text-accent-ink underline-offset-4 hover:underline">
                Get more
              </button>
            </>
          ) : (
            <>
              <span className="font-semibold tabular-nums text-fg">{n}</span> swap{n === 1 ? "" : "s"} left
            </>
          )}
        </p>
      )}
      <BuySheet open={isBuying} onClose={() => setIsBuying(false)} returnTo="/app" />
    </div>
  );
}

/** Four categories as a switch with their pictures, so the choice reads at a glance. */
function CategorySwitch({ value, onChange }: { value: PackId; onChange: (id: PackId) => void }) {
  return (
    <div
      role="radiogroup"
      aria-label="What to change"
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 sm:pb-0"
    >
      {PACKS.map((p) => {
        const isOn = p.id === value;
        const cover = PACK_COVERS[p.id];
        return (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={isOn}
            onClick={() => onChange(p.id)}
            className={`flex shrink-0 items-center gap-3 rounded-2xl border p-2 pr-4 text-left transition-[border-color,background-color] duration-150 sm:pr-3 ${
              isOn ? "border-accent bg-accent/10" : "border-line hover:border-muted"
            }`}
          >
            <span className="photo-edge relative size-11 shrink-0 overflow-hidden rounded-[10px] bg-surface-2">
              <Image src={cover.image} alt="" fill sizes="44px" className="object-cover" style={{ objectPosition: cover.position ?? "50% 50%" }} />
            </span>
            <span className="min-w-0">
              <span className={`block text-[15px] font-semibold ${isOn ? "text-fg" : "text-muted"}`}>{p.label}</span>
              <span className="hidden truncate text-[12px] text-muted sm:block">{cover.examples}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * The app's first screen is the work itself: pick what to change, then take or drop a photo.
 * The category is kept in the address (?pack=), so a link from the landing page opens the right one.
 */
export function SwapHome({ initialPack }: { initialPack: PackId }) {
  const [packId, setPackId] = useState<PackId>(initialPack);

  const choose = (id: PackId) => {
    setPackId(id);
    window.history.replaceState(null, "", `/app?pack=${id}`);
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
      <Greeting />
      <CategorySwitch value={packId} onChange={choose} />
      <div className="mt-4">
        {/* Keyed, so switching category starts that category's scan fresh. */}
        <ScanFlow key={packId} pack={getPack(packId)} />
      </div>
      <ContinueRow />
    </div>
  );
}
