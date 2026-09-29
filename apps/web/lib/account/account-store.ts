import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApiResponse, CreditsInfo } from "@/lib/api";

export type Account =
  | { status: "loading" }
  /** Supabase keys aren't set: renders will say accounts aren't ready. */
  | { status: "unavailable" }
  | { status: "signed-out" }
  | { status: "signed-in"; email: string | undefined; name: string | null; avatarUrl: string | null; credits: number | null };

type Metadata = Record<string, unknown> | undefined;
type SessionLike = { access_token: string; user: { email?: string; user_metadata?: Metadata } };

type Listener = () => void;

const RETURN_KEY = "retrofit:return-to";
/** A sign-in link is only worth following back for an hour. */
const RETURN_TTL_MS = 60 * 60 * 1000;
/** Supabase codes are 6 digits by default; the project setting allows up to 10. */
const MIN_CODE_LENGTH = 6;
export const MAX_CODE_LENGTH = 10;
export const MAX_NAME_LENGTH = 50;
/** Where people land after signing in with Google, unless a page asks to come back to itself. */
export const APP_HOME = "/app";

/**
 * Only our own pages: a plain path, never another site (no "//", no scheme). The one query
 * allowed is the app's category, so "/app?pack=room" comes back to Room.
 */
export function isOwnPath(path: string): boolean {
  return /^\/[a-z0-9/_-]*(\?pack=[a-z]+)?$/i.test(path) && !path.includes("//");
}

const text = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);

/** The name to show. The one the person typed wins, because Google rewrites its own on each sign-in. */
export function accountName(meta: Metadata): string | null {
  return text(meta?.display_name) ?? text(meta?.full_name) ?? text(meta?.name);
}

function accountAvatar(meta: Metadata): string | null {
  const url = text(meta?.avatar_url) ?? text(meta?.picture);
  return url?.startsWith("https://") ? url : null;
}

/** Where to go after the sign-in link lands on the home page. Read once, then cleared. */
export function takeReturnPath(storage: Storage, now: number = Date.now()): string | null {
  try {
    const raw = storage.getItem(RETURN_KEY);
    if (!raw) return null;
    storage.removeItem(RETURN_KEY);
    const { path, at } = JSON.parse(raw) as { path?: unknown; at?: unknown };
    if (typeof path !== "string" || typeof at !== "number" || now - at > RETURN_TTL_MS) return null;
    return isOwnPath(path) ? path : null;
  } catch {
    return null;
  }
}

/**
 * Who is signed in and how many renders they have, shared by every component.
 * Sign-in is Google, with an emailed code as the backup.
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

    const apply = (session: SessionLike | null) => {
      const wasSignedIn = Boolean(token);
      token = session?.access_token ?? null;
      if (!session) return set({ status: "signed-out" });
      const credits = state.status === "signed-in" ? state.credits : null;
      const meta = session.user.user_metadata;
      set({ status: "signed-in", email: session.user.email, name: accountName(meta), avatarUrl: accountAvatar(meta), credits });
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
     * `name` (from the sign-up form) is saved on a new account.
     * Returns an error message, or null when sent.
     */
    async sendLink(email: string, returnTo: string, origin: string, storage: Storage, name?: string): Promise<string | null> {
      const client = getClient();
      if (!client) return "Sign-in isn't set up yet.";
      try {
        storage.setItem(RETURN_KEY, JSON.stringify({ path: returnTo, at: Date.now() }));
      } catch {
        // Storage blocked: the link still signs you in, on the home page.
      }
      const cleanName = name?.trim().replace(/\s+/g, " ").slice(0, MAX_NAME_LENGTH);
      // The trailing slash matters: Supabase's allow list is `<site>/**`, and a bare origin
      // doesn't match it, so the link would fall back to the live Site URL.
      const { error } = await client.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${origin.replace(/\/+$/, "")}/`,
          // Only used when this email is new: the name typed at sign-up becomes the account's name.
          ...(cleanName ? { data: { display_name: cleanName } } : {}),
        },
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

    /**
     * Goes to Google, which sends the person back to `returnPath` on this site, signed in.
     * Returns an error message if the trip can't start (on success the page navigates away).
     */
    async signInWithGoogle(origin: string, returnPath: string): Promise<string | null> {
      const client = getClient();
      if (!client) return "Sign-in isn't set up yet.";
      const path = isOwnPath(returnPath) ? returnPath : APP_HOME;
      const { error } = await client.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${origin.replace(/\/+$/, "")}${path}` },
      });
      if (!error) return null;
      if (!error.status) return "Couldn't reach sign-in. Check your connection and try again.";
      return "Couldn't open Google sign-in. Please try again.";
    },

    /** Saves the name shown in the header. Returns an error message, or null. */
    async updateName(name: string): Promise<string | null> {
      const clean = name.trim();
      if (!clean) return "Type a name.";
      if (clean.length > MAX_NAME_LENGTH) return `Keep it to ${MAX_NAME_LENGTH} characters.`;
      const client = getClient();
      if (!client) return "Sign-in isn't set up yet.";
      const { error } = await client.auth.updateUser({ data: { display_name: clean } });
      if (!error) return null;
      if (!error.status) return "Couldn't reach the server. Check your connection and try again.";
      return "Couldn't save your name. Please try again.";
    },

    async signOut() {
      await getClient()?.auth.signOut();
    },
  };
}
