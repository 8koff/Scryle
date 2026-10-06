import Image, { type StaticImageData } from "next/image";

export type ExampleProduct = {
  image: StaticImageData;
  title: string;
  /** For a thumbnail cut out of a bigger photo: the spot to zoom in on (like object-position). */
  crop?: string;
};

/**
 * The products behind a demo swap, the way the app lists them. Examples only: no prices or store
 * names (we don't invent those), and nothing to click while the app is closed.
 */
export function ShopRow({
  products,
  title = products.map((p) => p.title).join(", "),
  className = "",
}: {
  products: readonly ExampleProduct[];
  /** A short name for several pieces together; the product names are too long side by side. */
  title?: string;
  className?: string;
}) {
  const isLook = products.length > 1;
  return (
    <div className={`flex items-center gap-3 rounded-[12px] border border-line bg-surface p-2 ${className}`}>
      {/* Several pieces overlap like a hand of cards, so the row stays short. */}
      <div className="flex shrink-0">
        {products.map((p) => (
          <span
            key={p.title}
            className={`relative overflow-hidden rounded-[8px] border border-line bg-white ${isLook ? "size-10 ring-2 ring-surface [&+&]:-ml-4" : "size-12"}`}
          >
            <Image
              src={p.image}
              alt=""
              fill
              sizes={p.crop ? "384px" : "48px"}
              className={p.crop ? "scale-[2.2] object-cover" : "object-contain p-1"}
              style={p.crop ? { objectPosition: p.crop, transformOrigin: p.crop } : undefined}
            />
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold">{title}</p>
        <p className="truncate text-[12px] text-muted">{isLook ? "Example of store results" : "Example of a store result"}</p>
      </div>
      {/* Looks like the app's button, but it is only a picture of it: the app is closed for now. */}
      <span className="shrink-0 rounded-[8px] bg-accent px-3 py-1.5 text-[13px] font-semibold text-on-accent">Shop</span>
    </div>
  );
}

const STEPS = [
  { title: "Point", body: "Point your camera at a room, a car or an outfit. Scryle finds every part you can change." },
  { title: "Swap", body: "Tap a part and pick a real product from real stores. See it on your own photo first." },
  { title: "Shop", body: "Like it? Buy it from the store. Every pick waits in one list, so a whole look is one trip." },
] as const;

/** Point → Swap → Shop: the whole product in three lines, shopping included. */
export function Steps() {
  return (
    <ol aria-label="How it works" className="grid gap-x-10 gap-y-6 border-t border-line pt-8 sm:grid-cols-3">
      {STEPS.map((s, i) => (
        <li key={s.title}>
          <p className="display text-[2rem] font-semibold">
            <span className="mr-2 text-accent-ink">{String(i + 1).padStart(2, "0")}</span>
            {s.title}
          </p>
          <p className="mt-2 max-w-[320px] text-[16px] leading-relaxed text-muted">{s.body}</p>
        </li>
      ))}
    </ol>
  );
}
