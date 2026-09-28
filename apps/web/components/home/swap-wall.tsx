import type { StaticImageData } from "next/image";
import Link from "next/link";
import { CompareSlider } from "@/components/ui/compare-slider";
import { DEMO } from "@/lib/demo";
import roomMakeoverAfter from "@/public/demo/room-makeover-after.jpg";
import roomMakeoverBefore from "@/public/demo/room-makeover-before.jpg";
import wallWomanAfter from "@/public/demo/wall-woman-after.jpg";
import wallWomanBefore from "@/public/demo/wall-woman-before.jpg";

type Example = {
  category: string;
  from: string;
  to: string;
  before: StaticImageData;
  after: StaticImageData;
  photoAspect: number;
  focus?: { x: number; y: number };
  beforeAlt: string;
  afterAlt: string;
};

/** Real renders from our tests. Each is one photo and one tap. */
const ROW_ONE: Example[] = [
  {
    category: "Room",
    from: "Worn brown sofa",
    to: "Green walls, bouclé sofa, Persian rug",
    before: roomMakeoverBefore,
    after: roomMakeoverAfter,
    photoAspect: 1600 / 895,
    beforeAlt: "A dull living room with a worn brown leather sofa and beige carpet",
    afterAlt: "The same room with forest green walls, a cream curved sofa, a Persian rug and a brass lamp",
  },
  {
    category: "Clothing",
    from: "Loungewear",
    to: "Full outfit",
    before: wallWomanBefore,
    after: wallWomanAfter,
    photoAspect: 1744 / 2336,
    focus: { x: 0.5, y: 0.2 },
    beforeAlt: "A woman with curly red hair in a grey sweatshirt, black leggings and white sneakers",
    afterAlt: "The same woman in a cropped black leather jacket, a white top, cream wide-leg trousers and black loafers",
  },
  {
    category: "Clothing",
    from: "Hoodie, jeans, sneakers",
    to: "Full outfit",
    before: DEMO.person.before,
    after: DEMO.person.outfit,
    photoAspect: DEMO.person.aspect,
    focus: { x: 0.5, y: 0.5 },
    beforeAlt: "A person in a grey hoodie, jeans and white sneakers",
    afterAlt: "The same person in a leather bomber, olive cargo trousers and retro sneakers",
  },
];

const ROW_TWO: Example[] = [
  {
    category: "Car",
    from: "Stock wheels",
    to: "Gloss black 10-spoke",
    before: DEMO.wheel.before,
    after: DEMO.wheel.after,
    photoAspect: DEMO.wheel.aspect,
    beforeAlt: "A white car's stock silver wheel",
    afterAlt: "The same car with a gloss black 10-spoke wheel",
  },
  {
    category: "Room",
    from: "Beige sofa",
    to: "Emerald velvet sofa",
    before: DEMO.room.before,
    after: DEMO.room.after,
    photoAspect: DEMO.room.aspect,
    focus: { x: 0.5, y: 0.6 },
    beforeAlt: "A living room with a beige fabric sofa",
    afterAlt: "The same living room with an emerald velvet sofa",
  },
];

function Tile({ example }: { example: Example }) {
  return (
    <figure className="flex min-w-0 flex-col">
      <CompareSlider
        before={example.before}
        after={example.after}
        beforeAlt={example.beforeAlt}
        afterAlt={example.afterAlt}
        photoAspect={example.photoAspect}
        focus={example.focus}
        sizes="(min-width: 768px) 40vw, 100vw"
        className="h-[340px] w-full rounded-[20px] sm:h-[400px]"
      />
      <figcaption className="mt-3 flex items-baseline gap-2 text-[14px]">
        <span className="text-muted">{example.category}</span>
        <span className="min-w-0 truncate font-semibold">
          {example.from} <span className="font-normal text-muted">to</span> {example.to}
        </span>
      </figcaption>
    </figure>
  );
}

/** A wall of real before/afters: proof it works on more than one thing. */
export function SwapWall() {
  return (
    <section aria-labelledby="wall-title">
      <div className="flex items-baseline justify-between border-b border-line pb-4">
        <h2 id="wall-title" className="display text-[2.4rem] font-semibold sm:text-[3.4rem]">
          More swaps
        </h2>
        <p className="text-right text-[14px] text-muted">Examples. The demo photos are AI-generated.</p>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-[1.75fr_0.85fr_0.85fr]">
        {ROW_ONE.map((e) => (
          <Tile key={`${e.from}-${e.to}`} example={e} />
        ))}
      </div>
      <div className="mt-8 grid gap-6 md:grid-cols-[0.9fr_1.45fr_1.1fr]">
        {ROW_TWO.map((e) => (
          <Tile key={`${e.from}-${e.to}`} example={e} />
        ))}
        <Link
          href="/scan/anything"
          className="group flex h-[340px] flex-col justify-between rounded-[20px] bg-fg p-7 text-bg transition-transform active:scale-[0.99] sm:h-[400px]"
        >
          <span className="text-[14px] font-semibold text-bg/60">Anything else</span>
          <span>
            <span className="display block text-[2.4rem] font-semibold">Your turn.</span>
            <span className="mt-2 block text-[15px] text-bg/70">Bikes, desks, gardens. Point the camera, we find what you can swap.</span>
            <span className="mt-6 inline-flex h-11 items-center rounded-full bg-bg px-5 text-[15px] font-semibold text-fg transition-transform group-hover:translate-x-1">
              Scan something
            </span>
          </span>
        </Link>
      </div>
    </section>
  );
}
