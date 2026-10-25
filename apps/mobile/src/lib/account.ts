import type { ApiResponse, CreditsInfo, PlanInfo } from "@retrofit/core";
import type { SupabaseClient } from "@supabase/supabase-js";

export type Account =
  | { status: "loading" }
  /** Supabase keys aren't set in this build. */
  | { status: "unavailable" }
  | { status: "signed-out" }
  | {
      status: "signed-in";
      /** The account id. Apple purchases carry it, so a purchase can only add to this account. */
      userId: string;
      email: string | undefined;
      name: string | null;
      /** Swaps left this month (0 without a plan); null until loaded. */
      credits: number | null;
      /** The plan giving swaps, or null without one. Decides the hard paywall. */
      plan: PlanInfo | null;
      /** "loading" until the server has answered once; "error" when it couldn't be reached. */
      planCheck: PlanCheck;
      /** Signed in with Apple at least once. Deleting the account must then disconnect Apple. */
      hasApple: boolean;
    };

export type PlanCheck = "loading" | "ready" | "error";

type Metadata = Record<string, unknown> | undefined;
type SessionLike = { access_token: string; user: { id: string; email?: string; user_metadata?: Metadata; app_metadata?: Metadata } };
type Listener = () => void;

/** What Apple's sign-in sheet gives back. Null when the person closed the sheet. */
export type AppleCredential = { identityToken: string; rawNonce: string; name: string | null } | null;

/** Supabase codes are 6 digits by default; the project setting allows up to 10. */
const MIN_CODE_LENGTH = 6;
export const MAX_CODE_LENGTH = 10;
export const MAX_NAME_LENGTH = 50;

const CREDITS_TIMEOUT_MS = 15_000;

const OFFLINE ="Couldn't reach sign-in. Check your connection and try again.";
const NOT_READY = "Sign-in isn't set up yet.";

const text = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);

/** The name to show. The one the person typed wins, same as the web. */
export function accountName(meta: Metadata): string | null {
  return text(meta?.display_name) ?? text(meta?.full_name) ?? text(meta?.name);
}

/** Supabase lists every way an account has signed in under app_metadata.providers. */
export function usesApple(meta: Metadata): boolean {
  const providers = meta?.providers;
  return Array.isArray(providers) ? providers.includes("apple") : meta?.provider === "apple";
}

/** True when nothing a screen shows has changed (token refreshes don't count). */
export function isSameAccount(a: Account, b: Account): boolean {
  if (a.status !== b.status) return false;
  if (a.status !== "signed-in" || b.status !== "signed-in") return true;
  return (
    a.userId === b.userId &&
    a.email === b.email &&
    a.name === b.name &&
    a.credits === b.credits &&
    a.planCheck === b.planCheck &&
    JSON.stringify(a.plan) === JSON.stringify(b.plan) &&
    a.hasApple === b.hasApple
  );
}

/**
 * Who is signed in and how many swaps they have. Same job as the web's account store:
 * the server only needs `Authorization: Bearer <token>`, so the app calls the same API.
 */
export function createAccountStore({
  getClient,
  apiUrl,
  fetcher = fetch,
  appleSignIn,
}: {
  getClient: () => SupabaseClient | null;
  apiUrl: string;
  fetcher?: typeof fetch;
  appleSignIn: () => Promise<AppleCredential>;
}) {
  let state: Account = { status: "loading" };
  let token: string | null = null;
  let started = false;
  const listeners = new Set<Listener>();

  const set = (next: Account) => {
    if (isSameAccount(state, next)) return;
    state = next;
    listeners.forEach((l) => l());
  };

  /** Fetches our API. `path` is "/api/…"; the site address comes from the build. */
  const authFetch = (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetcher(`${apiUrl}${path}`, { ...init, headers });
  };

  const setCredits = (credits: number | null) => {
    if (state.status === "signed-in") set({ ...state, credits });
  };

  /** A failed check keeps whatever was known; it only marks a first check as failed. */
  const markCheckFailed = () => {
    if (state.status === "signed-in" && state.planCheck !== "ready") set({ ...state, planCheck: "error" });
  };

  const refreshCredits = async (): Promise<number | null> => {
    const asked = token;
    if (!asked) return null;
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), CREDITS_TIMEOUT_MS);
    try {
      const response = await authFetch("/api/credits", { signal: abort.signal });
      const body = (await response.json()) as ApiResponse<CreditsInfo>;
      // Someone else signed in while this was loading: that balance isn't theirs.
      if (token !== asked) return null;
      if (!body.success) {
        markCheckFailed();
        return null;
      }
      const { credits, plan } = body.data;
      if (state.status === "signed-in") set({ ...state, credits, plan: plan ?? null, planCheck: "ready" });
      return credits;
    } catch {
      if (token === asked) markCheckFailed();
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  const apply = (session: SessionLike | null) => {
    const previousUser = state.status === "signed-in" ? state.userId : null;
    token = session?.access_token ?? null;
    if (!session) return set({ status: "signed-out" });
    // Same person (a token refresh): keep what's known about their plan.
    const known = state.status === "signed-in" && state.userId === session.user.id ? state : null;
    set({
      status: "signed-in",
      userId: session.user.id,
      email: session.user.email,
      name: accountName(session.user.user_metadata),
      credits: known?.credits ?? null,
      plan: known?.plan ?? null,
      planCheck: known?.planCheck ?? "loading",
      hasApple: usesApple(session.user.app_metadata),
    });
    if (previousUser !== session.user.id) void refreshCredits();
  };

  const start = () => {
    if (started) return;
    started = true;
    const client = getClient();
    if (!client) return set({ status: "unavailable" });
    void client.auth
      .getSession()
      .then(({ data }) => apply(data.session))
      // A Keychain read that fails must not leave the app on the splash screen.
      .catch(() => apply(null));
    client.auth.onAuthStateChange((_event, session) => apply(session));
  };

  return {
    subscribe(listener: Listener) {
      start();
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => state,
    authFetch,
    refreshCredits,
    setCredits,

    /** Emails a sign-in code. Returns an error message, or null when sent. */
    async sendCode(email: string): Promise<string | null> {
      const client = getClient();
      if (!client) return NOT_READY;
      const clean = email.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return "Type a full email address.";
      const { error } = await client.auth.signInWithOtp({ email: clean, options: { shouldCreateUser: true } });
      if (!error) return null;
      if (error.status === 429) return "Too many emails sent. Please wait a minute and try again.";
      if (!error.status) return OFFLINE;
      if (error.status >= 500) return "We couldn't send the email right now. Please try again later.";
      return "Couldn't send the email. Check the address.";
    },

    /** Signs in with the code from the email. Returns an error message, or null. */
    async verifyCode(email: string, code: string): Promise<string | null> {
      const client = getClient();
      if (!client) return NOT_READY;
      const digits = code.replace(/\D/g, "");
      if (digits.length < MIN_CODE_LENGTH) return "Enter the code from the email.";
      const { error } = await client.auth.verifyOtp({ email: email.trim(), token: digits, type: "email" });
      if (!error) return null;
      if (error.status === 429) return "Too many tries. Please wait a minute and try again.";
      if (!error.status) return OFFLINE;
      return "That code is wrong or too old. Check it, or send a new email.";
    },

    /**
     * Email and password. Only the App Review demo account has a password (the owner makes it in
     * Supabase): Apple's reviewers can't receive email codes. Returns an error message, or null.
     */
    async signInWithPassword(email: string, password: string): Promise<string | null> {
      const client = getClient();
      if (!client) return NOT_READY;
      const clean = email.trim();
      if (!clean || !password) return "Type your email and password.";
      const { error } = await client.auth.signInWithPassword({ email: clean, password });
      if (!error) return null;
      if (error.status === 429) return "Too many tries. Please wait a minute and try again.";
      if (!error.status) return OFFLINE;
      return "That email or password is wrong.";
    },

    /** Apple's native sheet, then Supabase. Returns an error message, or null (also when closed). */
    async signInWithApple(): Promise<string | null> {
      const client = getClient();
      if (!client) return NOT_READY;
      let credential: AppleCredential;
      try {
        credential = await appleSignIn();
      } catch {
        return "Couldn't open Sign in with Apple. Please try again.";
      }
      if (!credential) return null;
      const { error } = await client.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
        nonce: credential.rawNonce,
      });
      if (error) return error.status ? "Apple sign-in didn't work. Please try again." : OFFLINE;
      // Apple sends the name only the first time. Keep it, unless the account already has one.
      const { data } = await client.auth.getUser();
      if (credential.name && !accountName(data.user?.user_metadata)) {
        const { error: nameError } = await client.auth.updateUser({
          data: { display_name: credential.name.slice(0, MAX_NAME_LENGTH) },
        });
        // Signed in either way; the name can be set later on the account page.
        if (nameError) console.warn("[account] couldn't save the name from Apple", nameError.message);
      }
      return null;
    },

    /** Signs out this phone only; the website and other devices stay signed in. */
    async signOut(): Promise<void> {
      await getClient()?.auth.signOut({ scope: "local" });
    },
  };
}

export type AccountStore = ReturnType<typeof createAccountStore>;
