import Link from "next/link";
import type { ReactNode } from "react";
import { BRAND, LEGAL } from "@retrofit/core";
import { Logo } from "@/components/brand/logo";

export type LegalSection = { id: string; title: string; body: ReactNode };

/** Who runs the service, in words. Falls back to the brand until LEGAL is filled in. */
export const operatorName = LEGAL.operator || `the ${BRAND.name} team`;

/** The contact address as a link, or a clear gap until it is filled in. */
export function ContactEmail() {
  if (!LEGAL.contactEmail) return <span className="font-semibold">[contact email]</span>;
  return (
    <a href={`mailto:${LEGAL.contactEmail}`} className="font-semibold text-accent-ink underline-offset-4 hover:underline">
      {LEGAL.contactEmail}
    </a>
  );
}

/** A long, plain page of numbered sections with a jump list beside it on wide screens. */
export function LegalPage({ title, intro, sections }: { title: string; intro: ReactNode; sections: LegalSection[] }) {
  return (
    <div className="flex flex-1 flex-col bg-bg text-fg">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 pt-[env(safe-area-inset-top)] sm:px-6">
        <Logo />
        <nav aria-label="Legal" className="flex gap-5 text-[15px] font-medium text-muted">
          <Link href="/terms" className="transition-colors hover:text-fg">
            Terms
          </Link>
          <Link href="/privacy" className="transition-colors hover:text-fg">
            Privacy
          </Link>
        </nav>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-12 px-4 pb-24 pt-8 sm:px-6 lg:grid-cols-[220px_minmax(0,680px)] lg:pt-14">
        <aside className="hidden lg:block">
          <nav aria-label="On this page" className="sticky top-8">
            <ol className="flex flex-col gap-2 text-[14px] text-muted">
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="flex gap-2 transition-colors hover:text-fg">
                    <span className="w-5 shrink-0 tabular-nums">{i + 1}</span>
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>

        <article className="min-w-0">
          {!LEGAL.reviewed && (
            <p role="note" className="mb-8 rounded-2xl border border-line bg-surface px-4 py-3 text-[14px] text-muted">
              Draft. This page has not been checked by a lawyer yet.
            </p>
          )}
          <p className="text-[14px] font-medium text-muted">Last updated {LEGAL.updated}</p>
          <h1 className="display mt-2 text-[2.6rem] font-semibold sm:text-[3.4rem]">{title}</h1>
          <div className="mt-4 text-[17px] leading-relaxed text-muted">{intro}</div>

          <ol className="mt-12 flex flex-col gap-10">
            {sections.map((s, i) => (
              <li key={s.id} id={s.id} className="scroll-mt-8">
                <h2 className="flex gap-3 text-[20px] font-semibold">
                  <span className="w-6 shrink-0 text-muted tabular-nums">{i + 1}</span>
                  {s.title}
                </h2>
                <div className="legal-body mt-3 pl-9 text-[16px] leading-relaxed">{s.body}</div>
              </li>
            ))}
          </ol>
        </article>
      </main>
    </div>
  );
}
