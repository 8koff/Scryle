"use client";

import { INVITE_RENDERS } from "@retrofit/core";
import { useEffect, useState } from "react";
import { account, useAccount } from "@/lib/account/use-account";
import { readInvite, saveInvite, takeInviteCode } from "@/lib/account/invite-store";

const SHOW_MS = 7000;

/**
 * Invite links look like /?invite=CODE. The code is kept in this browser (the sign-in link opens
 * a new tab), then sent once the person is signed in. The server decides if it counts.
 */
export function InviteCapture() {
  const me = useAccount();
  const [notice, setNotice] = useState<string | null>(null);
  const signedIn = me.status === "signed-in";

  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("invite");
    if (!code) return;
    url.searchParams.delete("invite");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    if (saveInvite(window.localStorage, code)) {
      // Deferred so the message isn't set while this effect runs.
      queueMicrotask(() => setNotice(`A friend invited you. When you buy your first pack, you both get ${INVITE_RENDERS} free swaps.`));
    }
  }, []);

  useEffect(() => {
    if (!signedIn || !readInvite(window.localStorage)) return;
    const code = takeInviteCode(window.localStorage);
    if (!code) return;
    void account
      .authFetch("/api/invites/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) })
      .catch(() => saveInvite(window.localStorage, code)); // offline: try again next visit
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
      className={`pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 mx-auto w-fit max-w-[calc(100%-2rem)] rounded-2xl bg-fg px-5 py-3 text-center text-[15px] font-semibold text-bg shadow-lg motion-safe:transition-[opacity,translate] motion-safe:duration-300 ${
        notice ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      }`}
    >
      {notice}
    </p>
  );
}
