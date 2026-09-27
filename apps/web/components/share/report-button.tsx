"use client";

import { useId, useState, type FormEvent } from "react";
import type { ApiResponse } from "@/lib/api";
import { REPORT_LABELS, REPORT_REASONS, REVIEW_HOURS, type ReportReason } from "@/lib/reports";
import { Sheet } from "@/components/ui/sheet";

type Phase = { kind: "form"; error?: string } | { kind: "sending" } | { kind: "sent"; hidden: boolean };

const field = "w-full rounded-2xl border border-line bg-bg px-4 py-3 text-[15px] outline-none focus:border-accent";

/** Anyone can report a link, signed in or not. Sexual pictures and children are hidden at once. */
export function ReportButton({ shareId }: { shareId: string }) {
  const ids = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [contact, setContact] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "form" });

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!reason) return setPhase({ kind: "form", error: "Please pick a reason." });
    setPhase({ kind: "sending" });
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareId, reason, details, contact: contact.trim() }),
      });
      const body = (await response.json()) as ApiResponse<{ hidden: boolean }>;
      setPhase(body.success ? { kind: "sent", hidden: body.data.hidden } : { kind: "form", error: body.error });
    } catch {
      setPhase({ kind: "form", error: "No connection. Check your internet and try again." });
    }
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="mt-6 w-max text-[13px] font-medium text-muted underline-offset-4 hover:text-fg hover:underline">
        Report this picture
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} label="Report this picture">
        {phase.kind === "sent" ? (
          <div role="status">
            <h2 className="display text-[2rem] font-semibold">Thanks for telling us</h2>
            <p className="mt-2 text-[15px] text-muted">
              {phase.hidden ? "We've hidden this picture while we check it. " : ""}
              We look at every report within {REVIEW_HOURS} hours and remove pictures that break our rules.
            </p>
            <button type="button" onClick={() => setOpen(false)} className="mt-6 h-12 w-full rounded-full bg-fg text-[16px] font-semibold text-bg">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={send}>
            <h2 className="display text-[2rem] font-semibold">Report this picture</h2>
            <p className="mt-2 text-[15px] text-muted">We check every report within {REVIEW_HOURS} hours.</p>

            <fieldset className="mt-5">
              <legend className="text-[14px] font-semibold">What&apos;s wrong?</legend>
              <div className="mt-2 flex flex-col gap-2">
                {REPORT_REASONS.map((r) => (
                  <label key={r} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-bg px-4 py-3 has-checked:border-accent">
                    <input
                      type="radio"
                      name={`${ids}-reason`}
                      value={r}
                      checked={reason === r}
                      onChange={() => setReason(r)}
                      className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
                    />
                    <span className="text-[15px] leading-snug">{REPORT_LABELS[r]}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label htmlFor={`${ids}-details`} className="mt-5 block text-[14px] font-semibold">
              Anything that helps us check it <span className="font-normal text-muted">(optional)</span>
            </label>
            <textarea id={`${ids}-details`} value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} rows={3} className={`${field} mt-2 resize-none`} />

            <label htmlFor={`${ids}-contact`} className="mt-4 block text-[14px] font-semibold">
              Your email, if you want an answer <span className="font-normal text-muted">(optional)</span>
            </label>
            <input id={`${ids}-contact`} type="email" value={contact} onChange={(e) => setContact(e.target.value)} maxLength={200} autoComplete="email" className={`${field} mt-2`} />

            {phase.kind === "form" && phase.error && (
              <p role="alert" className="mt-3 text-[14px] font-medium text-accent-ink">
                {phase.error}
              </p>
            )}
            <button type="submit" disabled={phase.kind === "sending"} className="mt-6 h-12 w-full rounded-full bg-accent text-[16px] font-semibold text-on-accent disabled:opacity-60">
              {phase.kind === "sending" ? "Sending…" : "Send report"}
            </button>
          </form>
        )}
      </Sheet>
    </>
  );
}
