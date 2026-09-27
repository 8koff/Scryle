import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApiResponse, CreditsInfo } from "@/lib/api";

export type Account =
  | { status: "loading" }
  /** Supabase keys aren't set: renders will say accounts aren't ready. */
  | { status: "unavailable" }
  | { status: "signed-out" }
  | { status: "signed-in"; email: string | undefined; credits: number | null };

type Listener = () => void;

const RETURN_KEY = "retrofit:return-to";
/** A sign-in link is only worth following back for an hour. */
const RETURN_TTL_MS = 60 * 60 * 1000;
/** Supabase codes are 6 digits by default; the project setting allows up to 10. */
const MIN_CODE_LENGTH = 6;
export const MAX_CODE_LENGTH = 10;

/** Where to go after the sign-in link lands on the home page. Read once, then cleared. */
export function takeReturnPath(storage: Storage, now: number = Date.now()): string | null {
  try {
    const raw = storage.getItem(RETURN_KEY);
    if (!raw) return null;
    storage.removeItem(RETURN_KEY);
    const { path, at } = JSON.parse(raw) as { path?: unknown; at?: unknown };
    if (typeof path !== "string" || typeof at !== "number" || now - at > RETURN_TTL_MS) return null;
    // Only our own pages: a path, never another site.
    return /^\/[a-z0-9/_-]*$/i.test(path) && !path.startsWith("//") ? path : null;
  } catch {
    return null;
  }
}

/**
 * Who is signed in and how many renders they have, shared by every component.
 * Sign-in is an emailed link (Supabase's standard email, no custom email setup needed).
 */
export function createAccountStore(getClient: () => SupabaseClient | null, fetcher: typeof fetch = fetch) {
  let state: Account = { status: "loading" };
  let token: string | null = null;
  let started = false;
  const listeners = new Set<Listener>();

  const set = (next: Account) => {
    state = next;
    listeners.forEach((l) => l());
  };

  const authFetch = (url: string, init: RequestInit = {}) =>
    fetcher(url, { ...init, headers: { ...(init.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) } });

  const setCredits = (credits: number | null) => {
    if (state.status === "signed-in") set({ ...state, credits });
  };

  const refreshCredits = async (): Promise<number | null> => {
    if (!token) return null;
    try {
      const body = (await (await authFetch("/api/credits", { cache: "no-store" })).json()) as ApiResponse<CreditsInfo>;
      const credits = body.success ? body.data.credits : null;
      setCredits(credits);
      return credits;
    } catch {
      return null;
    }
  };

  const start = () => {
    if (started) return;
    started = true;
    const client = getClient();
    if (!client) return set({ status: "unavailable" });

    const apply = (session: { access_token: string; user: { email?: string } } | null) => {
      const wasSignedIn = Boolean(token);
      token = session?.access_token ?? null;
      if (!session) return set({ status: "signed-out" });
      const credits = state.status === "signed-in" ? state.credits : null;
      set({ status: "signed-in", email: session.user.email, credits });
      if (!wasSignedIn) void refreshCredits();
    };

    void client.auth.getSession().then(({ data }) => apply(data.session));
    client.auth.onAuthStateChange((_event, session) => apply(session));
  };

  return {
    subscribe(listener: Listener) {
      start();
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => state,
    authFetch,
    refreshCredits,
    setCredits,

    /**
     * Emails a sign-in code and link. The link opens our home page in a new tab; Supabase signs that
     * tab in and tells this tab too, and `takeReturnPath` sends the new tab back to `returnTo`.
     * Returns an error message, or null when sent.
     */
    async sendLink(email: string, returnTo: string, origin: string, storage: Storage): Promise<string | null> {
      const client = getClient();
      if (!client) return "Sign-in isn't set up yet.";
      try {
        storage.setItem(RETURN_KEY, JSON.stringify({ path: returnTo, at: Date.now() }));
      } catch {
        // Storage blocked: the link still signs you in, on the home page.
      }
      // The trailing slash matters: Supabase's allow list is `<site>/**`, and a bare origin
      // doesn't match it, so the link would fall back to the live Site URL.
      const { error } = await client.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true, emailRedirectTo: `${origin.replace(/\/+$/, "")}/` },
      });
      if (!error) return null;
      if (error.status === 429) return "Too many emails sent. Please wait a minute and try again.";
      if (!error.status) return "Couldn't reach sign-in. Check your connection and try again.";
      // 5xx: Supabase couldn't build or send the email (template or mail server), not a bad address.
      if (error.status >= 500) return "We couldn't send the email right now. Please try again later.";
      return "Couldn't send the email. Check the address.";
    },

    /**
     * Signs in with the code from the same email. Works on any device, unlike the link,
     * which only signs in the browser that opens it. Returns an error message, or null.
     */
    async verifyCode(email: string, code: string): Promise<string | null> {
      const client = getClient();
      if (!client) return "Sign-in isn't set up yet.";
      const token = code.replace(/\D/g, "");
      if (token.length < MIN_CODE_LENGTH) return "Enter the code from the email.";
      const { error } = await client.auth.verifyOtp({ email, token, type: "email" });
      if (!error) return null;
      if (error.status === 429) return "Too many tries. Please wait a minute and try again.";
      if (!error.status) return "Couldn't reach sign-in. Check your connection and try again.";
      return "That code is wrong or too old. Check it, or send a new email.";
    },

    async signOut() {
      await getClient()?.auth.signOut();
    },
  };
}
