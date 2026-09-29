import Link from "next/link";
import { BRAND } from "@retrofit/core";
import { HeaderAccount } from "@/components/account/header-account";
import { CartButton } from "@/components/shop/cart-button";
import { Logo } from "@/components/brand/logo";
import { CategoryGrid } from "@/components/home/category-grid";
import { Gallery } from "@/components/home/gallery";
import { Hero } from "@/components/home/hero";
import { HowItWorks } from "@/components/home/how-it-works";
import { Pricing } from "@/components/home/pricing";
import { SwapWall } from "@/components/home/swap-wall";
import { TryOn } from "@/components/home/try-on";

const CONTAINER = "mx-auto w-full max-w-6xl px-4 sm:px-6";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-bg text-fg">
      <header className="sticky top-0 z-30 bg-bg/80 backdrop-blur-xl">
        <div className={`${CONTAINER} flex h-16 items-center justify-between pt-[env(safe-area-inset-top)]`}>
          <Logo />
          <nav aria-label="Main" className="flex items-center gap-3 text-[15px] font-medium sm:gap-6">
            <Link href="#categories" className="hidden text-muted transition-colors hover:text-fg sm:inline">
              Categories
            </Link>
            <Link href="#how" className="hidden text-muted transition-colors hover:text-fg sm:inline">
              How it works
            </Link>
            <Link href="#pricing" className="hidden text-muted transition-colors hover:text-fg sm:inline">
              Pricing
            </Link>
            <CartButton />
            <HeaderAccount />
          </nav>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        <div className="w-full">
          <Hero />
        </div>
        <div className={`${CONTAINER} pt-20 sm:pt-28`}>
          <TryOn />
        </div>
        <div className={`${CONTAINER} py-20 sm:py-28`}>
          <SwapWall />
        </div>
        <div className={`${CONTAINER} empty:hidden pb-20 sm:pb-28`}>
          <Gallery />
        </div>
        <HowItWorks />
        <div className={`${CONTAINER} py-20 sm:py-28`}>
          <CategoryGrid />
        </div>
        <div className={`${CONTAINER} pb-20 sm:pb-28`}>
          <Pricing />
        </div>
      </main>

      <footer className="border-t border-line">
        <div className={`${CONTAINER} flex flex-col gap-2 py-8 text-[13px] text-muted sm:flex-row sm:justify-between`}>
          <p>
            © {new Date().getFullYear()} {BRAND.name}. Pictures made with Higgsfield.
          </p>
          <p>We may earn a commission when you buy through links on this site.</p>
          <nav aria-label="Legal" className="flex gap-4">
            <Link href="/terms" className="transition-colors hover:text-fg">
              Terms
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-fg">
              Privacy
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
