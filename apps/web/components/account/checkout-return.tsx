"use client";

import { useEffect, useRef, useState } from "react";
import type { ApiResponse, CheckoutDone } from "@/lib/api";
import { account, useAccount } from "@/lib/account/use-account";

const SHOW_MS = 6000;

/**
 * Back from Stripe on any page: adds the credits now (the webhook may still be on its way,
 * and there is no webhook when testing locally), then says so for a few seconds.
 */
export function CheckoutReturn() {
  const me = useAccount();
  const [notice, setNotice] = useState<string | null>(null);
  const checked = useRef(false);
  const signedIn = me.status === "signed-in";

  useEffect(() => {
    if (!signedIn || checked.current) return;
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (params.get("checkout") !== "done" || !sessionId) return;
    checked.current = true;
    window.history.replaceState(null, "", window.location.pathname);
    void (async () => {
      try {
        const response = await account.authFetch("/api/checkout/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const body = (await response.json()) as ApiResponse<CheckoutDone>;
        if (!body.success) return setNotice(body.error);
        account.setCredits(body.data.credits);
        const { added, bonus } = body.data;
        const invite = bonus ? ` Plus ${bonus} free from your invite.` : "";
        setNotice(added ? `Payment done. ${added} pictures added.${invite}` : "Payment done. Your pictures are ready.");
      } catch {
        setNotice("Payment done. Your pictures will show up in a moment.");
      }
    })();
  }, [signedIn]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), SHOW_MS);
    return () => window.clearTimeout(timer);
  }, [notice]);

  return (
    <p
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed inset-x-0 top-[max(1rem,env(safe-area-inset-top))] z-50 mx-auto w-fit max-w-[calc(100%-2rem)] rounded-full bg-fg px-5 py-3 text-[15px] font-semibold text-bg shadow-lg motion-safe:transition-[opacity,translate] motion-safe:duration-300 ${
        notice ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
      }`}
    >
      {notice}
    </p>
  );
}
