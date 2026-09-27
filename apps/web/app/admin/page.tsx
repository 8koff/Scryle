import type { Metadata } from "next";
import { BRAND } from "@retrofit/core";
import { HeaderAccount } from "@/components/account/header-account";
import { AdminPanel } from "@/components/admin/admin-panel";
import { Logo } from "@/components/brand/logo";

export const metadata: Metadata = { title: `Admin · ${BRAND.name}`, robots: { index: false, follow: false } };

export default function AdminPage() {
  return (
    <div className="flex flex-1 flex-col bg-bg text-fg">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 pt-[env(safe-area-inset-top)] sm:px-6">
        <Logo />
        <HeaderAccount returnTo="/" />
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-20 pt-6 sm:px-6 sm:pt-10">
        <h1 className="display text-[2.6rem] font-semibold sm:text-[3.4rem]">Admin</h1>
        <AdminPanel />
      </main>
    </div>
  );
}
