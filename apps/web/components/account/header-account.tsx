"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAccount } from "@/lib/account/use-account";
import { BuySheet } from "./buy-sheet";
import { CreditsButton } from "./credits-button";
import { SignInSheet } from "./sign-in-sheet";

/** Sign in, or see and top up your renders, from any page's header. */
export function HeaderAccount({ returnTo = "/" }: { returnTo?: string }) {
  const me = useAccount();
  const [sheet, setSheet] = useState<"sign-in" | "buy" | null>(null);
  const onRendersPage = usePathname() === "/renders";

  return (
    <>
      {me.status === "signed-in" && !onRendersPage && (
        <Link href="/renders" className="hidden text-[15px] font-medium text-muted transition-colors hover:text-fg sm:inline">
          My pictures
        </Link>
      )}
      <CreditsButton current={me} onSignIn={() => setSheet("sign-in")} onBuy={() => setSheet("buy")} />
      <SignInSheet open={sheet === "sign-in"} onClose={() => setSheet(null)} onSignedIn={() => setSheet(null)} />
      <BuySheet open={sheet === "buy"} onClose={() => setSheet(null)} returnTo={returnTo} />
    </>
  );
}
