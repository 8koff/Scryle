import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { supabaseProjectUrl } from "@/lib/account/supabase-url";
import { createSupabaseCreditStore, type CreditStore } from "./credits";
import { createSupabaseRenderStore, type RenderStore } from "./renders";
import { createSupabaseReportStore, type ReportStore } from "./reports";
import { createSupabaseShareStore, type ShareStore } from "./shares";

export type User = { id: string; email?: string };
/** Checks a Supabase access token. Returns null for a missing, bad or expired token. */
export type VerifyUser = (accessToken: string) => Promise<User | null>;

type Env = Record<string, string | undefined>;

/** Server-only Supabase client. Accepts the new secret key or the older service-role key. */
export function supabaseAdminFromEnv(env: Env = process.env): SupabaseClient {
  const url = supabaseProjectUrl(env.NEXT_PUBLIC_SUPABASE_URL);
  const key = (env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function stripeFromEnv(env: Env = process.env): Stripe {
  const key = env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  return new Stripe(key);
}

export function createVerifyUser(db: SupabaseClient): VerifyUser {
  return async (accessToken) => {
    const { data, error } = await db.auth.getClaims(accessToken);
    if (error || !data?.claims?.sub || data.claims.role !== "authenticated") return null;
    return { id: data.claims.sub, email: typeof data.claims.email === "string" ? data.claims.email : undefined };
  };
}

/** "Authorization: Bearer <token>" → the signed-in user, or null. */
export async function userFromRequest(request: Request, verify: VerifyUser): Promise<User | null> {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+([\w.-]{20,4096})$/.exec(header.trim());
  if (!match) return null;
  try {
    return await verify(match[1]!);
  } catch (error) {
    console.error("[accounts] token check failed", error);
    return null;
  }
}

let adminDb: SupabaseClient | null = null;
let accounts: {
  credits: CreditStore;
  shares: ShareStore;
  renders: RenderStore;
  reports: ReportStore;
  verifyUser: VerifyUser;
} | null = null;
let stripe: Stripe | null = null;

/** The one server-side Supabase client. Throws when Supabase isn't configured. */
export function getAdminDb(): SupabaseClient {
  adminDb ??= supabaseAdminFromEnv();
  return adminDb;
}

/** Accounts, credits and share links. Throws when Supabase isn't configured; routes answer 503 then. */
export function getAccounts() {
  if (!accounts) {
    const db = getAdminDb();
    accounts = {
      credits: createSupabaseCreditStore(db),
      shares: createSupabaseShareStore(db),
      renders: createSupabaseRenderStore(db),
      reports: createSupabaseReportStore(db),
      verifyUser: createVerifyUser(db),
    };
  }
  return accounts;
}

export function getStripe(): Stripe {
  stripe ??= stripeFromEnv();
  return stripe;
}

export const NOT_SET_UP = { success: false, error: "Accounts aren't set up yet. Please try again later." } as const;

type SignedIn =
  | { ok: true; accounts: ReturnType<typeof getAccounts>; user: User }
  | { ok: false; response: Response };

/** For routes that need an account: answers 503 (not set up) or 401 (signed out) for you. */
export async function requireUser(request: Request): Promise<SignedIn> {
  let current;
  try {
    current = getAccounts();
  } catch (error) {
    console.error("[accounts] not configured", error);
    return { ok: false, response: Response.json(NOT_SET_UP, { status: 503 }) };
  }
  const user = await userFromRequest(request, current.verifyUser);
  if (!user) {
    return { ok: false, response: Response.json({ success: false, error: "Please sign in.", code: "sign_in" }, { status: 401 }) };
  }
  return { ok: true, accounts: current, user };
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * The public site address for Stripe's return links. Set NEXT_PUBLIC_SITE_URL when deployed:
 * the request's own host can be faked, so it is only trusted on your own computer.
 */
export function siteOrigin(request: Request, env: Env = process.env): string {
  const configured = env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  const url = new URL(request.url);
  if (LOCAL_HOSTS.has(url.hostname)) return url.origin;
  throw new Error("Missing NEXT_PUBLIC_SITE_URL");
}
