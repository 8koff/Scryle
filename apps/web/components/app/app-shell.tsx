"use client";

import { Images, ScanLine } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { BRAND } from "@retrofit/core";
import { AccountMenu } from "@/components/account/account-menu";
import { BuySheet } from "@/components/account/buy-sheet";
import { CreditsButton } from "@/components/account/credits-button";
import { CartButton } from "@/components/shop/cart-button";
import { SeamMark } from "@/lib/brand-mark";
import { useAccount } from "@/lib/account/use-account";

const TABS = [
  { href: "/app", label: "Swap", icon: ScanLine },
  { href: "/app/renders", label: "My pictures", icon: Images },
] as const;

const isActive = (href: string, path: string) => (href === "/app" ? path === "/app" || path.startsWith("/app/build") : path.startsWith(href));

/**
 * The app's frame: a slim bar with the two places you work (Swap, My pictures) and your account.
 * On phones the two tabs sit at the bottom, in thumb reach, except in the studio, which has its own bottom bar.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const me = useAccount();
  const path = usePathname();
  const [isBuying, setIsBuying] = useState(false);
  const inStudio = path.startsWith("/app/build");
  const isSignedIn = me.status === "signed-in";

  // Signed out, the page is the sign-up screen on its own: no app bar around it.
  if (!isSignedIn) return <div className="flex min-h-svh flex-col bg-bg text-fg">{children}</div>;

  return (
    <div className="flex min-h-svh flex-col bg-bg text-fg">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-4 pt-[env(safe-area-inset-top)] sm:px-6">
          <Link href="/app" className="flex items-center gap-2" aria-label={`${BRAND.name} app`}>
            <SeamMark size={24} />
            <span className="text-[17px] font-semibold tracking-tight">{BRAND.name}</span>
          </Link>

          <nav aria-label="App" className="hidden h-full items-stretch gap-1 sm:flex">
            {TABS.map((tab) => {
              const active = isActive(tab.href, path);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={`-mb-px flex items-center border-b-2 px-3 text-[14px] font-medium transition-colors ${
                    active ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <CartButton />
            <CreditsButton current={me} onSignIn={() => {}} onBuy={() => setIsBuying(true)} />
            <AccountMenu />
          </div>
        </div>
      </header>

      <main className={`flex flex-1 flex-col ${inStudio ? "" : "pb-20 sm:pb-0"}`}>{children}</main>

      {!inStudio && (
        <nav
          aria-label="App"
          className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl sm:hidden"
        >
          {TABS.map((tab) => {
            const active = isActive(tab.href, path);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-14 flex-col items-center justify-center gap-0.5 text-[12px] font-medium ${active ? "text-fg" : "text-muted"}`}
              >
                <Icon aria-hidden className={`size-5 ${active ? "text-accent-ink" : ""}`} strokeWidth={2} />
                {tab.label}
              </Link>
            );
          })}
        </nav>
      )}

      <BuySheet open={isBuying} onClose={() => setIsBuying(false)} returnTo={path} />
    </div>
  );
}
