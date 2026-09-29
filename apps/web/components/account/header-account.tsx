"use client";

import Link from "next/link";
import { APP_HOME } from "@/lib/account/account-store";
import { useAccount } from "@/lib/account/use-account";
import { AccountMenu } from "./account-menu";

const cta =
  "inline-flex h-10 items-center whitespace-nowrap rounded-full bg-fg px-4 text-[15px] font-semibold text-bg transition-transform duration-150 ease-out active:scale-[0.97]";

/** The landing page's way in: log in or sign up, or open the app when already signed in. */
export function HeaderAccount() {
  const me = useAccount();

  if (me.status === "loading") return <span className="h-10 w-28" />;

  if (me.status === "signed-in") {
    return (
      <>
        <Link href={APP_HOME} className={cta}>
          Open app
        </Link>
        <AccountMenu />
      </>
    );
  }

  return (
    <>
      <Link href="/login" className="text-[15px] font-medium text-muted transition-colors hover:text-fg">
        Log in
      </Link>
      <Link href="/signup" className={`${cta} hidden sm:inline-flex`}>
        Get started
      </Link>
    </>
  );
}
