"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { MAX_CODE_LENGTH, MAX_NAME_LENGTH } from "@/lib/account/account-store";
import { account } from "@/lib/account/use-account";
import { SeamMark } from "@/lib/brand-mark";

export type AuthMode = "signup" | "login";

interface AuthScreenProps {
  initialMode: AuthMode;
  /** The page Google sends the person back to, e.g. "/app" or "/app/build/abc". */
  returnTo: string;
  /** An error to show on arrival, e.g. Google said the sign-in was cancelled. */
  initialError?: string | null;
  /** "sheet": inside a pop-up, so no page padding and no second card border. */
  variant?: "page" | "sheet";
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const field =
  "h-12 w-full min-w-0 rounded-xl border border-line bg-transparent px-4 text-[16px] outline-none transition-colors placeholder:text-muted focus:border-fg";
const button =
  "flex h-12 w-full items-center justify-center gap-3 rounded-xl text-[16px] font-semibold transition-[transform,opacity,border-color] duration-150 active:scale-[0.985] disabled:opacity-50";
const link = "font-medium text-fg underline underline-offset-4 hover:text-accent-ink";

const COPY: Record<AuthMode, { title: string; google: string; other: string; otherLink: string }> = {
  signup: { title: "Create your account.", google: "Sign up with Google", other: "Already have an account?", otherLink: "Log in" },
  login: { title: "Welcome back.", google: "Log in with Google", other: "New here?", otherLink: "Create an account" },
};

/** Google's "G", drawn in its own colours as Google's brand rules ask. */
function GoogleMark() {
  return (
    <svg aria-hidden viewBox="0 0 48 48" className="size-5 shrink-0">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.2l7.9 6.2C12.4 13.7 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 7l7.4 5.8c4.3-4 6.9-9.9 6.9-17.3z" />
      <path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.2C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.8l7.9-6.2z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.8-5.8l-7.4-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.2-13.5-9.9l-7.9 6.2C6.6 42.6 14.6 48 24 48z" />
    </svg>
  );
}

/**
 * Sign up or log in: Google, or an emailed code. There is no password. Google leaves this page and
 * comes back to `returnTo` signed in; the code signs in right here and the account store tells every component.
 */
export function AuthScreen({ initialMode, returnTo, initialError = null, variant = "page" }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [isAgreed, setIsAgreed] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState<"google" | "email" | "code" | null>(null);
  const [error, setError] = useState<string | null>(initialError);
  const copy = COPY[mode];

  const needsAgreement = () => {
    if (isAgreed) return false;
    setError("Please confirm you're 18 or older and agree to the Terms.");
    return true;
  };

  const google = async () => {
    if (needsAgreement()) return;
    setBusy("google");
    setError(null);
    const problem = await account.signInWithGoogle(window.location.origin, returnTo);
    // On success the browser is already on its way to Google.
    if (problem) {
      setBusy(null);
      setError(problem);
    }
  };

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    const clean = (sentTo ?? email).trim().toLowerCase();
    if (!EMAIL.test(clean)) return setError("Check the email address.");
    if (needsAgreement()) return;
    setBusy("email");
    setError(null);
    const name = mode === "signup" ? `${firstName} ${lastName}` : undefined;
    const problem = await account.sendLink(clean, returnTo, window.location.origin, window.localStorage, name);
    setBusy(null);
    if (problem) return setError(problem);
    setCode("");
    setSentTo(clean);
  };

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    if (!sentTo) return;
    setBusy("code");
    setError(null);
    const problem = await account.verifyCode(sentTo, code);
    // On success the account store switches to signed in, and the page shows the app.
    setBusy(null);
    if (problem) setError(problem);
  };

  const switchMode = () => {
    setMode((m) => (m === "signup" ? "login" : "signup"));
    setError(null);
  };

  return (
    <div
      className={`mx-auto flex w-full max-w-[440px] flex-1 flex-col items-center ${variant === "page" ? "px-4 pb-16 pt-10 sm:pt-16" : "pt-2"}`}
    >
      <SeamMark size={variant === "page" ? 48 : 36} />
      <h1 className={`${variant === "page" ? "mt-6" : "mt-4"} text-center text-[1.75rem] font-semibold tracking-tight`}>{sentTo ? "Check your email." : copy.title}</h1>

      <div className={`w-full ${variant === "page" ? "mt-8 rounded-[24px] border border-line p-5 sm:p-7" : "mt-6"}`}>
        {sentTo ? (
          <form onSubmit={verify} className="flex flex-col gap-4">
            <p className="text-[15px] text-muted">
              We sent a code to <span className="font-semibold text-fg">{sentTo}</span>. Type it here.
            </p>
            <label htmlFor="auth-code" className="sr-only">
              Code from the email
            </label>
            <input
              id="auth-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              maxLength={MAX_CODE_LENGTH + 4}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ""))}
              className={`${field} text-center text-[22px] tracking-[0.3em]`}
              autoFocus
            />
            <button type="submit" disabled={busy !== null} className={`${button} bg-fg text-bg`}>
              {busy === "code" ? "Checking…" : "Continue"}
            </button>
            <p className="text-[14px] text-muted">It can take a minute. Check your spam folder too.</p>
            <div className="flex justify-between text-[14px]">
              <button type="button" onClick={() => setSentTo(null)} className="text-muted hover:text-fg">
                Change email
              </button>
              <button type="button" onClick={() => send()} disabled={busy !== null} className="text-muted hover:text-fg">
                Send a new code
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <button type="button" onClick={google} disabled={busy !== null} className={`${button} border border-line hover:border-fg`}>
              <GoogleMark />
              {busy === "google" ? "Opening Google…" : copy.google}
            </button>

            <div aria-hidden className="flex items-center gap-3 py-1 text-[12px] font-medium tracking-wide text-muted">
              <span className="h-px flex-1 bg-line" />
              OR
              <span className="h-px flex-1 bg-line" />
            </div>

            <form onSubmit={send} className="flex flex-col gap-4">
              {mode === "signup" && (
                <div className="grid grid-cols-2 gap-3">
                  <label className="sr-only" htmlFor="auth-first">
                    First name
                  </label>
                  <input
                    id="auth-first"
                    autoComplete="given-name"
                    placeholder="First name"
                    maxLength={MAX_NAME_LENGTH}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={field}
                  />
                  <label className="sr-only" htmlFor="auth-last">
                    Last name
                  </label>
                  <input
                    id="auth-last"
                    autoComplete="family-name"
                    placeholder="Last name"
                    maxLength={MAX_NAME_LENGTH}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className={field}
                  />
                </div>
              )}
              <label className="sr-only" htmlFor="auth-email">
                Email
              </label>
              <input
                id="auth-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={field}
              />

              <label className="flex cursor-pointer items-start gap-3 text-[13px] leading-snug text-muted">
                <input
                  type="checkbox"
                  checked={isAgreed}
                  onChange={(e) => {
                    setIsAgreed(e.target.checked);
                    setError(null);
                  }}
                  className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
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

              <button type="submit" disabled={busy !== null} className={`${button} bg-fg text-bg`}>
                {busy === "email" ? "Sending…" : "Continue"}
              </button>
            </form>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 text-[14px] font-medium text-accent-ink">
            {error}
          </p>
        )}

        {!sentTo && (
          <p className="mt-6 text-center text-[15px] text-muted">
            {copy.other}{" "}
            <button type="button" onClick={switchMode} className={link}>
              {copy.otherLink}
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
