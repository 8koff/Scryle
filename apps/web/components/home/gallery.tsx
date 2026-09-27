import Link from "next/link";
import { getPack } from "@retrofit/core";
import { loadGallery } from "@/lib/server/gallery";
import { swapTitle } from "@/lib/server/share-page";

/** Before/afters people shared and we approved. Hidden until there is at least one. */
export async function Gallery() {
  const cards = await loadGallery();
  if (!cards.length) return null;

  return (
    <section aria-labelledby="gallery-title">
      <div className="flex items-baseline justify-between border-b border-line pb-4">
        <h2 id="gallery-title" className="display text-[2.4rem] font-semibold sm:text-[3.4rem]">
          From the gallery
        </h2>
        <p className="text-[14px] text-muted">AI edits shared by people using it</p>
      </div>
      <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-4">
        {cards.map((card) => (
          <li key={card.id}>
            <Link href={`/b/${card.id}`} className="group block">
              <span className="relative block aspect-[4/5] overflow-hidden rounded-[20px] bg-surface-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- stored share picture */}
                <img
                  src={card.afterUrl}
                  alt={`${getPack(card.pack).label}: ${swapTitle(card.labels)}`}
                  loading="lazy"
                  className="size-full object-cover transition-transform duration-300 ease-(--ease-out) group-hover:scale-[1.02]"
                />
              </span>
              <span className="mt-2 block truncate text-[15px] font-semibold">{swapTitle(card.labels)}</span>
              <span className="block text-[13px] text-muted">{getPack(card.pack).label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
