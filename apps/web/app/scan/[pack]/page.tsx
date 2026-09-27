import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BRAND, getPack, isPackId, PACKS } from "@retrofit/core";
import { Logo } from "@/components/brand/logo";
import { ScanFlow } from "@/components/scan/scan-flow";

export function generateStaticParams() {
  return PACKS.map((pack) => ({ pack: pack.id }));
}

export async function generateMetadata({ params }: PageProps<"/scan/[pack]">): Promise<Metadata> {
  const { pack } = await params;
  return { title: isPackId(pack) ? `${getPack(pack).label} · ${BRAND.name}` : BRAND.name };
}

export default async function ScanPage({ params }: PageProps<"/scan/[pack]">) {
  const { pack } = await params;
  if (!isPackId(pack)) notFound();

  return (
    <div className="flex min-h-svh flex-col bg-bg text-fg">
      <header className="mx-auto flex h-16 w-full max-w-5xl items-center px-4 pt-[env(safe-area-inset-top)] sm:px-6">
        <Logo />
      </header>
      <ScanFlow pack={getPack(pack)} />
    </div>
  );
}
