import Image from "next/image";
import { HudBox } from "@/components/ui/hud-box";
import { DEMO } from "@/lib/demo";

const FRAME = "relative aspect-[3/4] overflow-hidden rounded-[14px] bg-surface-2";

export function HowItWorks() {
  const { person } = DEMO;
  const steps = [
    {
      title: "Take the photo",
      text: "Lean your phone on something and step back. It takes the shot when you're in frame.",
      media: (
        <div className={FRAME}>
          <Image src={person.before} alt="" fill sizes="(min-width: 768px) 30vw, 80vw" className="object-cover" />
          <HudBox box={{ x: 0.08, y: 0.05, w: 0.84, h: 0.9 }} />
        </div>
      ),
    },
    {
      title: "Tap what you'd change",
      text: "Everything you can swap is marked. Tap one to see what you can put there.",
      media: (
        <div className={FRAME}>
          <Image src={person.before} alt="" fill sizes="(min-width: 768px) 30vw, 80vw" className="object-cover" />
          <HudBox box={person.parts.top} label="Outerwear" isActive />
          <HudBox box={person.parts.bottoms} label="Pants" />
          <HudBox box={person.parts.shoes} label="Shoes" />
        </div>
      ),
    },
    {
      title: "See it on your photo",
      text: "Pick one item or a whole outfit. AI draws it onto your photo. Where we can, we link to the store.",
      media: (
        <div className={FRAME}>
          <Image src={person.outfit} alt="" fill sizes="(min-width: 768px) 30vw, 80vw" className="object-cover" />
        </div>
      ),
    },
  ];

  return (
    <section id="how" aria-labelledby="how-title" className="scroll-mt-20 border-y border-line bg-surface text-fg">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="grid gap-4 border-b border-line pb-6 md:grid-cols-12">
          <h2 id="how-title" className="display text-[2.4rem] font-semibold sm:text-[3.4rem] md:col-span-5">
            How it works
          </h2>
          <p className="max-w-md text-[16px] leading-[1.55] text-muted md:col-span-6 md:col-start-7">
            See a new look on your own photo instead of on a model. It&apos;s an AI picture, so it shows you the style,
            not an exact fit.
          </p>
        </div>

        <ol className="-mx-4 mt-8 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:px-0">
          {steps.map((step, i) => (
            <li key={step.title} className="w-[76%] shrink-0 snap-start md:w-auto">
              {step.media}
              <h3 className="mt-5 text-[17px] font-semibold tracking-[-0.01em]">
                <span className="mr-2 tabular-nums text-accent-ink">{i + 1}</span>
                {step.title}
              </h3>
              <p className="mt-1.5 text-[15px] leading-[1.55] text-muted">{step.text}</p>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-[13px] text-muted">Examples. The demo photos are AI-generated.</p>
      </div>
    </section>
  );
}
