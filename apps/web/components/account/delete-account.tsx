"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ApiResponse } from "@/lib/api";
import { account } from "@/lib/account/use-account";

/** Everything this site keeps in the browser starts with this. */
const STORAGE_PREFIX = "retrofit:";

function forgetThisBrowser() {
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith(STORAGE_PREFIX)) localStorage.removeItem(key);
  } catch {
    // Storage can be blocked; nothing to forget then.
  }
}

type Phase = "idle" | "confirm" | "deleting" | "error";

/** Closing an account takes two taps, the same as signing up. */
export function DeleteAccount() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");

  const remove = async () => {
    setPhase("deleting");
    try {
      const response = await account.authFetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "delete" }),
      });
      const body = (await response.json()) as ApiResponse<{ deleted: boolean }>;
      if (!body.success) throw new Error(body.error);
    } catch {
      return setPhase("error");
    }
    forgetThisBrowser();
    await account.signOut().catch(() => {});
    router.replace("/");
  };

  if (phase === "idle") {
    return (
      <button type="button" onClick={() => setPhase("confirm")} className="mt-3 text-[12px] font-medium text-muted underline-offset-2 hover:text-fg hover:underline">
        Delete account
      </button>
    );
  }

  return (
    <div role="group" aria-label="Delete account" className="mt-4 rounded-2xl border border-line bg-bg p-4">
      <p className="text-[15px] font-semibold">Delete your account?</p>
      <p className="mt-1 text-[14px] text-muted">
        This deletes your photos, swaps, share links and any swaps you haven&apos;t used. It can&apos;t be undone.
      </p>
      {phase === "error" && (
        <p role="alert" className="mt-2 text-[14px] font-medium text-accent-ink">
          Couldn&apos;t delete your account. Please try again.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={remove}
          disabled={phase === "deleting"}
          className="h-10 rounded-full bg-accent px-4 text-[14px] font-semibold text-on-accent disabled:opacity-60"
        >
          {phase === "deleting" ? "Deleting…" : "Yes, delete everything"}
        </button>
        <button type="button" onClick={() => setPhase("idle")} disabled={phase === "deleting"} className="h-10 rounded-full px-4 text-[14px] font-semibold hover:bg-surface-2">
          Keep my account
        </button>
      </div>
    </div>
  );
}
