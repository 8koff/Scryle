"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useAccount } from "@/lib/account/use-account";
import { AuthScreen } from "./auth-screen";

/** Google adds "?error=…" (and "#error=…") when the person cancels or something goes wrong on its side. */
function googleError(): string | null {
  if (typeof window === "undefined") return null;
  const error = new URLSearchParams(window.location.search).get("error");
  if (!error) return null;
  return error === "access_denied" ? "Google sign-in was cancelled." : "Google sign-in didn't work. Please try again.";
}

/** Takes the error out of the address, so a reload or a copied link doesn't show it again. */
function clearGoogleError() {
  const url = new URL(window.location.href);
  for (const key of ["error", "error_code", "error_description"]) url.searchParams.delete(key);
  window.history.replaceState(null, "", url.pathname + url.search);
}

/** This page, plus the chosen category if there is one, so sign-in comes back to the same screen. */
function currentPage(path: string): string {
  if (typeof window === "undefined") return path;
  const pack = new URLSearchParams(window.location.search).get("pack");
  return pack && /^[a-z]+$/.test(pack) ? `${path}?pack=${pack}` : path;
}

/**
 * The app is for signed-in people. Anyone else gets the sign-up screen in place of the page,
 * and Google brings them back to this same page. (The APIs check the account too.)
 */
export function RequireAccount({ children }: { children: ReactNode }) {
  const me = useAccount();
  const path = usePathname();
  const [arrivalError] = useState(googleError);
  useEffect(() => {
    if (arrivalError) clearGoogleError();
  }, [arrivalError]);

  if (me.status === "signed-in") return children;
  if (me.status === "loading") return <div aria-busy className="flex-1" />;
  if (me.status === "unavailable") {
    return <p className="mx-auto max-w-sm flex-1 px-4 py-24 text-center text-[15px] text-muted">Accounts aren&apos;t set up yet.</p>;
  }
  return <AuthScreen initialMode="signup" returnTo={currentPage(path)} initialError={arrivalError} />;
}
