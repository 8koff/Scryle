import type { Metadata } from "next";
import { BRAND } from "@retrofit/core";
import { HeaderAccount } from "@/components/account/header-account";
import { Logo } from "@/components/brand/logo";
import { MyRenders } from "@/components/renders/my-renders";
import { CartButton } from "@/components/shop/cart-button";

export const metadata: Metadata = { title: `My swaps · ${BRAND.name}`, robots: { index: false } };

export default function RendersPage() {
  return (
    <div className="flex flex-1 flex-col bg-bg text-fg">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 pt-[env(safe-area-inset-top)] sm:px-6">
        <Logo />
        <div className="flex items-center gap-3">
          <CartButton />
          <HeaderAccount returnTo="/renders" />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-20 pt-6 sm:px-6 sm:pt-10">
        <h1 className="display text-[2.6rem] font-semibold sm:text-[3.4rem]">My swaps</h1>
        <p className="mb-10 mt-2 text-[17px] text-muted">Every swap you made, kept in your account.</p>
        <MyRenders />
      </main>
    </div>
  );
}
