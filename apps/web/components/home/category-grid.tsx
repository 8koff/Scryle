import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { PACKS, type PackId } from "@retrofit/core";
import { DEMO } from "@/lib/demo";

const COVERS: Record<PackId, { image: StaticImageData; position?: string; examples: string }> = {
  clothing: { image: DEMO.person.outfit, position: "50% 25%", examples: "Dresses, shirts, jeans, sneakers, bags" },
  car: { image: DEMO.wheel.after, examples: "Wheels, paint, tint, lights, ride height" },
  room: { image: DEMO.room.after, position: "58% 62%", examples: "Sofas, rugs, lamps, wall colour" },
  anything: { image: DEMO.object, examples: "Bikes, desks, gardens, gear" },
};

/** A contents-page style index: one row per category, photo on the right. */
export function CategoryGrid() {
  return (
    <section id="categories" aria-labelledby="categories-title" className="scroll-mt-20">
      <div className="flex items-baseline justify-between border-b border-line pb-4">
        <h2 id="categories-title" className="display text-[2.4rem] font-semibold sm:text-[3.4rem]">
          Categories
        </h2>
        <p className="text-[14px] text-muted">Four to start</p>
      </div>

      <ol>
        {PACKS.map((pack, i) => {
          const cover = COVERS[pack.id];
          return (
            <li key={pack.id} className="border-b border-line">
              <Link
                href={`/scan/${pack.id}`}
                className="group grid grid-cols-[2rem_1fr_auto] items-center gap-x-4 py-4 sm:grid-cols-[3rem_1fr_1fr_auto] sm:gap-x-8 sm:py-5"
              >
                <span className="text-[13px] font-semibold tabular-nums text-accent-ink">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="display text-[1.9rem] font-semibold transition-[transform,color] duration-300 ease-out group-hover:translate-x-1 group-hover:text-accent-ink sm:text-[2.75rem]">
                    {pack.label}
                  </h3>
                  <p className="mt-1 text-[14px] leading-snug text-muted sm:hidden">{cover.examples}</p>
                </div>
                <p className="hidden text-[15px] leading-snug text-muted sm:block">
                  {pack.tagline}
                  <span className="mt-1 block text-[13px] text-muted/80">{cover.examples}</span>
                </p>
                <div className="photo-edge relative h-20 w-16 overflow-hidden rounded-[6px] bg-surface-2 sm:h-28 sm:w-24">
                  <Image
                    src={cover.image}
                    alt=""
                    fill
                    sizes="96px"
                    className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
                    style={{ objectPosition: cover.position ?? "50% 50%" }}
                  />
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
