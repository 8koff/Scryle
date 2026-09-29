import type { ApiResponse, CreditsInfo } from "@retrofit/core";
import type { SupabaseClient } from "@supabase/supabase-js";

export type Account =
  | { status: "loading" }
  /** Supabase keys aren't set in this build. */
  | { status: "unavailable" }
  | { status: "signed-out" }
  | { status: "signed-in"; email: string | undefined; name: string | null; credits: number | null };

type Metadata = Record<string, unknown> | undefined;
type SessionLike = { access_token: string; user: { email?: string; user_metadata?: Metadata } };
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

  const refreshCredits = async (): Promise<number | null> => {
    const asked = token;
    if (!asked) return null;
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), CREDITS_TIMEOUT_MS);
    try {
      const response = await authFetch("/api/credits", { signal: abort.signal });
      const body = (await response.json()) as ApiResponse<CreditsInfo>;
      const credits = body.success ? body.data.credits : null;
      // Someone else signed in while this was loading: that balance isn't theirs.
      if (token !== asked) return null;
      setCredits(credits);
      return credits;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  const apply = (session: SessionLike | null) => {
    const wasSignedIn = Boolean(token);
    token = session?.access_token ?? null;
    if (!session) return set({ status: "signed-out" });
    const credits = state.status === "signed-in" ? state.credits : null;
    set({ status: "signed-in", email: session.user.email, name: accountName(session.user.user_metadata), credits });
    // The first /api/credits call also gives a new account its free swap.
    if (!wasSignedIn) void refreshCredits();
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
