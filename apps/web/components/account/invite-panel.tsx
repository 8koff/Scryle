"use client";

import { useEffect, useState } from "react";
import type { ApiResponse, InviteInfo } from "@/lib/api";
import { account } from "@/lib/account/use-account";

type State = { status: "loading" } | { status: "error" } | { status: "ready"; link: string; reward: number };

/** Your invite link, with Copy (and Share on phones). Loaded when the account sheet opens. */
export function InvitePanel() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const body = (await (await account.authFetch("/api/invites", { cache: "no-store" })).json()) as ApiResponse<InviteInfo>;
        if (!live) return;
        setState(body.success ? { status: "ready", link: `${window.location.origin}/?invite=${body.data.code}`, reward: body.data.reward } : { status: "error" });
      } catch {
        if (live) setState({ status: "error" });
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  if (state.status !== "ready") {
    return state.status === "error" ? null : <div aria-hidden className="mt-5 h-[92px] animate-pulse rounded-2xl bg-surface-2" />;
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(state.link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the link is on screen to copy by hand.
    }
  };
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <section aria-labelledby="invite-title" className="mt-5 rounded-2xl bg-surface-2 p-4">
      <h3 id="invite-title" className="text-[15px] font-semibold">
        Invite a friend
      </h3>
      <p className="mt-1 text-[13px] text-muted">When they buy their first pack, you both get {state.reward} free swaps.</p>
      <div className="mt-3 flex gap-2">
        <input
          readOnly
          value={state.link}
          aria-label="Your invite link"
          onFocus={(e) => e.currentTarget.select()}
          className="h-10 min-w-0 flex-1 rounded-full border border-line bg-bg px-4 text-[13px] text-muted outline-none"
        />
        <button type="button" onClick={copy} className="h-10 shrink-0 rounded-full bg-fg px-4 text-[14px] font-semibold text-bg active:scale-[0.97]">
          {copied ? "Copied" : "Copy"}
        </button>
        {canShare && (
          <button
            type="button"
            onClick={() => navigator.share({ url: state.link, text: "Try this: see new stuff on your own photo before you buy it." }).catch(() => {})}
            className="h-10 shrink-0 rounded-full bg-bg px-4 text-[14px] font-semibold active:scale-[0.97]"
          >
            Share
          </button>
        )}
      </div>
    </section>
  );
}
