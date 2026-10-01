"use client";

import { useState, type FormEvent } from "react";

type Status = { kind: "idle" | "sending" | "done" } | { kind: "error"; message: string };

type Props = {
  /** Where the link was posted (?ref=), saved with the email. */
  source: string;
};

const GENERIC_ERROR = "Couldn't add you. Please try again.";

/** Email box and button in one frame. On success it turns into a short thank-you. */
export function JoinForm({ source }: Props) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setStatus({ kind: "sending" });
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.get("email"), website: data.get("website"), source }),
      });
      const body: unknown = await res.json().catch(() => null);
      if (res.ok) return setStatus({ kind: "done" });
      const message = body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : GENERIC_ERROR;
      setStatus({ kind: "error", message });
    } catch {
      setStatus({ kind: "error", message: GENERIC_ERROR });
    }
  };

  if (status.kind === "done") {
    return (
      <div role="status" className="rounded-[14px] border border-line bg-surface px-5 py-4">
        <p className="text-[17px] font-semibold">You&rsquo;re on the list.</p>
        <p className="mt-1 text-[15px] text-muted">We&rsquo;ll email you when your early access is ready.</p>
      </div>
    );
  }

  const isSending = status.kind === "sending";
  return (
    <form onSubmit={handleSubmit}>
      <div className="flex items-center gap-2 rounded-[14px] border border-fg/70 bg-surface p-1.5 transition-colors focus-within:border-fg">
        <label htmlFor="waitlist-email" className="sr-only">
          Email address
        </label>
        <input
          id="waitlist-email"
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          inputMode="email"
          placeholder="you@email.com"
          className="h-11 min-w-0 flex-1 bg-transparent px-3 text-[16px] outline-none placeholder:text-muted/70"
        />
        {/* Hidden from people; bots fill it in. */}
        <input name="website" type="text" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] size-px opacity-0" />
        <button
          type="submit"
          disabled={isSending}
          className="h-11 shrink-0 rounded-[10px] bg-accent px-4 text-[15px] font-semibold text-on-accent transition-[transform,background-color] duration-150 ease-out hover:bg-accent-2 active:scale-[0.97] disabled:opacity-70 sm:px-5"
        >
          {isSending ? "Adding you…" : "Get early access"}
        </button>
      </div>
      {status.kind === "error" && (
        <p role="alert" className="mt-2 text-[14px] font-medium text-accent-ink">
          {status.message}
        </p>
      )}
    </form>
  );
}
