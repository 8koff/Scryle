import type { Metadata } from "next";
import type { StaticImageData } from "next/image";
import Link from "next/link";
import { BRAND } from "@retrofit/core";
import { Logo } from "@/components/brand/logo";
import { CompareSlider } from "@/components/ui/compare-slider";
import { JoinForm } from "@/components/waitlist/join-form";
import { ShopRow, Steps, type ExampleProduct } from "@/components/waitlist/shop-parts";
import { WaitlistDemo } from "@/components/waitlist/waitlist-demo";
import { DEMO } from "@/lib/demo";
import personOutfit from "@/public/demo/person-outfit.jpg";
import productCargo from "@/public/demo/product-cargo.jpg";
import productSneakers from "@/public/demo/product-sneakers.jpg";

const PITCH = `${BRAND.name} sees the sofa, the wheels, the jacket. Swap in a real product on your own photo, then buy it straight from the store.`;

export const metadata: Metadata = {
  title: `Join the waitlist · ${BRAND.name}`,
  description: PITCH,
  openGraph: { title: `${BRAND.name}: point at anything, swap it, shop it.`, description: PITCH },
  twitter: { card: "summary_large_image" },
};

type Category = {
  label: string;
  examples: string;
  before: StaticImageData;
  after: StaticImageData;
  beforeAlt: string;
  afterAlt: string;
  /** The part of the photo to keep in view when it is cropped to the card. */
  focus: { x: number; y: number };
  /** The products in the "after" photo, as the app would list them. */
  products: readonly ExampleProduct[];
  /** A short name when there are several products. */
  shopTitle?: string;
};

/** One before/after per category, so each card can be dragged like the big demo. */
const CATEGORIES: Category[] = [
  {
    label: "Room",
    examples: "Sofas, walls, rugs, lamps",
    before: DEMO.room.before,
    after: DEMO.room.after,
    beforeAlt: "A living room with a beige fabric sofa",
    afterAlt: "The same living room with an emerald velvet sofa",
    focus: { x: 0.5, y: 0.6 },
    products: [DEMO.room.product],
  },
  {
    label: "Car",
    examples: "Wheels, paint, tint, stance",
    before: DEMO.wheel.before,
    after: DEMO.wheel.after,
    beforeAlt: "A white car's stock silver wheel",
    afterAlt: "The same car with a gloss black 10-spoke wheel",
    focus: { x: 0.47, y: 0.46 },
    products: [DEMO.wheel.product],
  },
  {
    label: "Clothing",
    examples: "Jackets, trousers, sneakers",
    before: DEMO.person.before,
    after: personOutfit,
    beforeAlt: "A person in a grey hoodie, jeans and white sneakers",
    afterAlt: "The same person in a black leather bomber jacket, olive cargo trousers and white and green sneakers",
    focus: { x: 0.5, y: 0.4 },
    // The three pieces in this outfit render, each with its own product photo.
    products: [
      DEMO.person.product,
      { image: productCargo, title: "Olive cargo trousers" },
      { image: productSneakers, title: "White and green sneakers" },
    ],
    shopTitle: "Bomber, cargos, sneakers",
  },
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
          <CompareSlider
            before={c.before}
            after={c.after}
            beforeAlt={c.beforeAlt}
            afterAlt={c.afterAlt}
            aspect={4 / 5}
            focus={c.focus}
            intro
            sizes="(min-width: 640px) 360px, 100vw"
            className="mt-3 rounded-[10px]"
          />
          <ShopRow products={c.products} title={c.shopTitle} className="mt-3" />
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
          className={`${CONTAINER} grid grid-cols-[minmax(0,1fr)] items-center gap-x-16 gap-y-12 py-12 sm:py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:py-20`}
        >
          <div className="max-w-[560px]">
            <h1 id="waitlist-title" className="display text-[3rem] font-semibold sm:text-[4.2rem]">
              Point at anything. Swap it. <span className="text-accent-ink">Shop it.</span>
            </h1>
            <p className="mt-6 max-w-[440px] text-[18px] leading-relaxed text-muted">{PITCH}</p>
            <div className="mt-8 max-w-[440px]">
              <JoinForm source={one(ref)} />
              <p className="mt-3 text-[14px] text-muted">Your first picture is free. No password: sign in with Google or an email code.</p>
            </div>
          </div>
          <div className="mx-auto w-full max-w-[440px]">
            <WaitlistDemo />
            <p className="mt-20 text-center text-[12px] text-muted">Example. The demo photos are AI-generated.</p>
          </div>
        </section>

        <div className={`${CONTAINER} pb-14 sm:pb-20`}>
          <Steps />
        </div>

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
            <Link href="/terms" className="transition-colors hover:text-fg">
              Terms
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
