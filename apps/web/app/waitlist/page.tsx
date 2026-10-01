import type { Metadata } from "next";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { BRAND } from "@retrofit/core";
import { Logo } from "@/components/brand/logo";
import { JoinForm } from "@/components/waitlist/join-form";
import { WaitlistDemo } from "@/components/waitlist/waitlist-demo";
import { DEMO, HERO_DEMO } from "@/lib/demo";

const PITCH = `${BRAND.name} sees the sofa, the wheels, the jacket, and shows you something better on your own photo. Then it tells you where to buy it.`;

export const metadata: Metadata = {
  title: `Join the waitlist · ${BRAND.name}`,
  description: PITCH,
  openGraph: { title: `${BRAND.name}: point at anything, tap it, swap it.`, description: PITCH },
  twitter: { card: "summary_large_image" },
};

const CATEGORIES: { label: string; examples: string; image: StaticImageData; position: string }[] = [
  { label: "Room", examples: "Sofas, walls, rugs, lamps", image: HERO_DEMO.room.after, position: "60% 60%" },
  { label: "Car", examples: "Wheels, paint, tint, stance", image: DEMO.wheel.after, position: "50% 45%" },
  { label: "Clothing", examples: "Jackets, trousers, shoes", image: DEMO.person.outfit, position: "50% 30%" },
];

const CONTAINER = "mx-auto w-full max-w-6xl px-4 sm:px-6";

/** A ?param value as one short string. */
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.slice(0, 40) ?? "";

function Categories() {
  return (
    // Same padding on every column (the row reaches past the container instead), so the photos match in size.
    <ul aria-label="What you can swap" className="grid border-t border-line sm:-mx-5 sm:grid-cols-3 sm:border-t-0">
      {CATEGORIES.map((c, i) => (
        <li key={c.label} className="border-line py-6 sm:border-t sm:px-5 sm:[&+&]:border-l">
          <p className="text-[14px] font-semibold text-accent-ink">{`${String(i + 1).padStart(2, "0")} / ${c.label}`}</p>
          <div className="photo-edge relative mt-3 aspect-[3/2] overflow-hidden rounded-[10px] bg-surface-2">
            <Image src={c.image} alt="" fill sizes="(min-width: 640px) 360px, 100vw" className="object-cover" style={{ objectPosition: c.position }} />
          </div>
          <p className="mt-3 text-[18px] font-semibold">{c.examples}</p>
        </li>
      ))}
    </ul>
  );
}

/**
 * The waitlist page for posting on social media. Light warm paper with the app's denim
 * (chosen 2026-09-30 from the owner's Framer draft), unlike the dark app.
 */
export default async function WaitlistPage({ searchParams }: PageProps<"/waitlist">) {
  const { ref } = await searchParams;

  return (
    <div className="theme-paper flex flex-1 flex-col bg-bg text-fg">
      <header className="border-b border-line">
        <div className={`${CONTAINER} flex h-16 items-center justify-between pt-[env(safe-area-inset-top)]`}>
          <Logo />
          <p className="text-[13px] font-medium text-muted">Early access</p>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        <section
          aria-labelledby="waitlist-title"
          className={`${CONTAINER} grid items-center gap-x-16 gap-y-12 py-12 sm:py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:py-20`}
        >
          <div className="max-w-[560px]">
            <h1 id="waitlist-title" className="display text-[3rem] font-semibold sm:text-[4.2rem]">
              Point at anything. Tap it. <span className="text-accent-ink">Swap it.</span>
            </h1>
            <p className="mt-6 max-w-[440px] text-[18px] leading-relaxed text-muted">{PITCH}</p>
            <div className="mt-8 max-w-[440px]">
              <JoinForm source={one(ref)} />
              <p className="mt-3 text-[14px] text-muted">Your first picture is free. No password: we email you a code.</p>
            </div>
          </div>
          <div className="mx-auto w-full max-w-[440px]">
            <WaitlistDemo />
            <p className="mt-4 text-center text-[12px] text-muted">Example. The demo photos are AI-generated.</p>
          </div>
        </section>

        <div className={`${CONTAINER} pb-12 sm:pb-16`}>
          <Categories />
        </div>
      </main>

      <footer className="border-t border-line">
        <div className={`${CONTAINER} flex items-center justify-between gap-4 py-6 text-[13px] text-muted`}>
          <p>
            © {new Date().getFullYear()} {BRAND.name}
          </p>
          <nav aria-label="Legal" className="flex gap-5">
            <Link href="/privacy" className="transition-colors hover:text-fg">
              Privacy
            </Link>
            <Link href="/" className="transition-colors hover:text-fg">
              scryapp.io
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
