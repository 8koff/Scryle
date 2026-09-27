"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { takeReturnPath } from "@/lib/account/account-store";
import { useAccount } from "@/lib/account/use-account";

/**
 * The sign-in link always lands on the home page. Once that tab is signed in, this sends
 * it back to the page the person was on (usually their studio). Renders nothing.
 */
export function SignInReturn() {
  const me = useAccount();
  const router = useRouter();
  const isSignedIn = me.status === "signed-in";

  useEffect(() => {
    if (!isSignedIn || window.location.pathname !== "/") return;
    const path = takeReturnPath(window.localStorage);
    if (path && path !== "/") router.replace(path);
  }, [isSignedIn, router]);

  return null;
}
