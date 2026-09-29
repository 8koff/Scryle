import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BRAND, getPack } from "@retrofit/core";
import { Logo } from "@/components/brand/logo";
import { OwnerActions } from "@/components/share/owner-actions";
import { RemixButton } from "@/components/share/remix-button";
import { ReportButton } from "@/components/share/report-button";
import { ShopLook } from "@/components/shop/shop-look";
import { CompareSlider } from "@/components/ui/compare-slider";
import { findProduct } from "@/lib/catalog/catalog";
import { SHARE_SIZE } from "@/lib/server/share";
import { loadShare, swapTitle } from "@/lib/server/share-page";

export async function generateMetadata({ params }: PageProps<"/b/[id]">): Promise<Metadata> {
  const { id } = await params;
  const share = await loadShare(id);
  if (!share) return { title: BRAND.name, robots: { index: false } };
  const title = `${swapTitle(share.labels)}: before and after`;
  return {
    title: `${title} · ${BRAND.name}`,
    description: `An AI edit of a photo, made with ${BRAND.name}. ${BRAND.shareHashtag}`,
    // Links are unlisted: only people who get the link should find them.
    robots: { index: false, follow: false },
    // The card was drawn once when the link was made, so previews cost nothing to serve.
    openGraph: { title, type: "article", images: [{ url: share.cardUrl, width: SHARE_SIZE.width, height: SHARE_SIZE.height, alt: title }] },
    twitter: { card: "summary_large_image", title, images: [share.cardUrl] },
  };
}

export default async function SharePage({ params }: PageProps<"/b/[id]">) {
  const { id } = await params;
  const share = await loadShare(id);
  if (!share) notFound();

  const pack = getPack(share.pack);
  const hasSamples = share.selections.some((s) => "productId" in s && findProduct(s.productId)?.kind === "sample");

  return (
    <div className="flex flex-1 flex-col bg-bg text-fg">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 pt-[env(safe-area-inset-top)] sm:px-6">
        <Logo />
        <Link href="/" className="text-[15px] font-medium text-muted transition-colors hover:text-fg">
          What is this?
        </Link>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-8 px-4 pb-16 pt-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-14 lg:pt-8">
        <div className="mx-auto w-full" style={{ maxWidth: `min(100%, calc(72svh * ${share.width / share.height}))` }}>
          <CompareSlider
            before={share.beforeUrl}
            after={share.afterUrl}
            beforeAlt="The original photo"
            afterAlt={`An AI edit of the same photo, with ${swapTitle(share.labels).toLowerCase()}`}
            aspect={share.width / share.height}
            intro
            priority
            unoptimized
            className="photo-edge rounded-[28px]"
          />
        </div>

        <section aria-labelledby="swap-title" className="flex flex-col">
          <p className="text-[15px] font-medium text-muted">{pack.label}, before and after</p>
          <h1 id="swap-title" className="display mt-2 text-[2.6rem] font-semibold sm:text-[3.4rem]">
            {swapTitle(share.labels)}
          </h1>
          <p className="mt-4 max-w-sm text-[17px] text-muted">
            An AI edit of the original photo, made with {BRAND.name}. It shows an idea of the look, not the real product. Drag
            the line to compare.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <RemixButton shareId={share.id} pack={share.pack} selections={share.selections} />
            <Link href="/" className="inline-flex h-13 items-center justify-center rounded-full px-5 text-[16px] font-semibold text-fg transition-colors hover:bg-surface-2">
              Start with my own photo
            </Link>
          </div>
          <p className="mt-3 text-[13px] text-muted">
            {share.selections.length ? "Take your photo and we pick the same items for you." : "Take your photo and pick what to swap."} Your first picture is free.
          </p>
          <div className="mt-8">
            <ShopLook selections={share.selections} />
          </div>
          {hasSamples && <p className="mt-6 text-[13px] text-muted">Items marked as samples are examples and aren&apos;t for sale yet.</p>}

          <OwnerActions shareId={share.id} />
          <ReportButton shareId={share.id} />
        </section>
      </main>
    </div>
  );
}
