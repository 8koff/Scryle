"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { APP_HOME } from "@/lib/account/account-store";
import { useAccount } from "@/lib/account/use-account";
import { AuthScreen, type AuthMode } from "./auth-screen";

/** /signup and /login. Signed-in people go straight to the app. */
export function AuthPage({ mode }: { mode: AuthMode }) {
  const me = useAccount();
  const router = useRouter();
  const isSignedIn = me.status === "signed-in";

  useEffect(() => {
    if (isSignedIn) router.replace(APP_HOME);
  }, [isSignedIn, router]);

  return (
    <main className="flex min-h-svh flex-col bg-bg text-fg">
      {me.status === "signed-out" && <AuthScreen initialMode={mode} returnTo={APP_HOME} />}
      {me.status === "unavailable" && <p className="px-4 py-24 text-center text-[15px] text-muted">Accounts aren&apos;t set up yet.</p>}
    </main>
  );
}
