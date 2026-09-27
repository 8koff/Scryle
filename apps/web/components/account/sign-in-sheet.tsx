"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { MAX_CODE_LENGTH } from "@/lib/account/account-store";
import { account, useAccount } from "@/lib/account/use-account";
import { Sheet } from "@/components/ui/sheet";

interface SignInSheetProps {
  open: boolean;
  onClose: () => void;
  /** Called once this tab is signed in (from the link, in this tab or another one). */
  onSignedIn: () => void;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const field = "h-12 w-full rounded-2xl border border-line bg-bg px-4 text-[16px] outline-none focus:border-accent";
const primary =
  "h-12 w-full rounded-full bg-accent text-[16px] font-semibold text-on-accent transition-[transform,opacity] active:scale-[0.98] disabled:opacity-45";

/**
 * Email → code. The email holds a code (type it here, on any device) and a link (signs in
 * the browser that opens it; Supabase tells this tab too). The build is kept in local
 * storage, so nothing is lost either way.
 */
export function SignInSheet({ open, onClose, onSignedIn }: SignInSheetProps) {
  const me = useAccount();
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAgreed, setIsAgreed] = useState(false);
  const [code, setCode] = useState("");

  // The link was opened (maybe in another tab): carry on here.
  const [handled, setHandled] = useState(false);
  if (open && sentTo && me.status === "signed-in" && !handled) {
    setHandled(true);
    setSentTo(null);
    onSignedIn();
  }
  if (!open && handled) setHandled(false);

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!EMAIL.test(clean)) return setError("Check the email address.");
    if (!isAgreed) return setError("Please confirm you're 18 or older and agree to the Terms.");
    setBusy(true);
    setError(null);
    const problem = await account.sendLink(clean, window.location.pathname, window.location.origin, window.localStorage);
    setBusy(false);
    if (problem) return setError(problem);
    setCode("");
    setSentTo(clean);
  };

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    if (!sentTo) return;
    setBusy(true);
    setError(null);
    const problem = await account.verifyCode(sentTo, code);
    setBusy(false);
    // On success the account store switches to signed-in, and the check above closes the sheet.
    if (problem) setError(problem);
  };

  const reset = () => {
    setSentTo(null);
    setCode("");
    setError(null);
  };

  return (
    <Sheet open={open} onClose={onClose} label="Sign in">
      <h2 className="display text-[2rem] font-semibold">{sentTo ? "Check your email" : "Your first swap is free"}</h2>
      {sentTo ? (
        <form onSubmit={verify} className="mt-3 flex flex-col gap-3">
          <p className="text-[15px] text-muted">
            We sent an email to <span className="font-semibold text-fg">{sentTo}</span>. Type the code from it here. You can
            read it on any device.
          </p>
          <label htmlFor="signin-code" className="sr-only">
            Code from the email
          </label>
          <input
            id="signin-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            maxLength={MAX_CODE_LENGTH + 4}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ""))}
            className={`${field} mt-1 text-center text-[22px] tracking-[0.3em]`}
            autoFocus
          />
          <button type="submit" disabled={busy} className={primary}>
            {busy ? "Checking…" : "Sign in"}
          </button>
          <p className="text-[14px] text-muted">It can take a minute. Check your spam folder too.</p>
          <div className="flex justify-between text-[14px] font-medium text-muted">
            <button type="button" onClick={() => reset()} className="hover:text-fg">
              Change email
            </button>
            <button type="button" onClick={() => send()} disabled={busy} className="hover:text-fg">
              Send a new email
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={send} className="mt-3 flex flex-col gap-3">
          <p className="text-[15px] text-muted">Sign in with your email. We send you a code. There is no password.</p>
          <label htmlFor="signin-email" className="sr-only">
            Email
          </label>
          <input
            id="signin-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`${field} mt-1`}
          />
          <label className="flex cursor-pointer items-start gap-3 text-[14px] leading-snug">
            <input
              type="checkbox"
              checked={isAgreed}
              onChange={(e) => setIsAgreed(e.target.checked)}
              className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]"
            />
            <span>
              I&apos;m 18 or older, and I agree to the{" "}
              <Link href="/terms" target="_blank" className="underline underline-offset-2 hover:text-fg">
                Terms
              </Link>{" "}
              and{" "}
              <Link href="/privacy" target="_blank" className="underline underline-offset-2 hover:text-fg">
                Privacy Policy
              </Link>
              .
            </span>
          </label>
          <button type="submit" disabled={busy} className={primary}>
            {busy ? "Sending…" : "Email me a code"}
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="mt-3 text-[14px] font-medium text-accent-ink">
          {error}
        </p>
      )}
    </Sheet>
  );
}
