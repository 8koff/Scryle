import { AI_CONSENT_VERSION, type AiConsentInfo, type ApiResponse } from "@retrofit/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { userFromRequest, type VerifyUser } from "./accounts";

/** Who allowed photos to go to our AI partners, and which wording they saw (migration 0013). */
export type AiConsentStore = {
  /** The consent version this account allowed, or null if it never did. */
  version(userId: string): Promise<number | null>;
  /** Saves the allowed version, replacing an older one. */
  record(userId: string, version: number): Promise<void>;
};

export function createSupabaseAiConsentStore(db: SupabaseClient): AiConsentStore {
  return {
    async version(userId) {
      const { data, error } = await db.from("ai_consents").select("version").eq("user_id", userId).maybeSingle();
      if (error) throw new Error(`[ai-consent] read failed: ${error.message}`);
      return typeof data?.version === "number" ? data.version : null;
    },
    async record(userId, version) {
      const row = { user_id: userId, version, consented_at: new Date().toISOString() };
      const { error } = await db.from("ai_consents").upsert(row, { onConflict: "user_id" });
      if (error) throw new Error(`[ai-consent] save failed: ${error.message}`);
    },
  };
}

/** For tests. */
export function createMemoryAiConsentStore(): AiConsentStore & { rows: Map<string, number> } {
  const rows = new Map<string, number>();
  return {
    rows,
    async version(userId) {
      return rows.get(userId) ?? null;
    },
    async record(userId, version) {
      rows.set(userId, version);
    },
  };
}

/** True only when the account allowed the current wording. Throws if the store can't be read. */
export async function hasAiConsent(store: AiConsentStore, userId: string): Promise<boolean> {
  const version = await store.version(userId);
  return version !== null && version >= AI_CONSENT_VERSION;
}

type Result<T> = { status: number; body: ApiResponse<T> };

export async function handleAiConsentGet(userId: string, store: AiConsentStore): Promise<Result<AiConsentInfo>> {
  return { status: 200, body: { success: true, data: { hasConsented: await hasAiConsent(store, userId), version: AI_CONSENT_VERSION } } };
}

const AllowInput = z.object({ version: z.number().int().positive() });

/**
 * The person tapped "Allow". The app sends the version of the wording it showed, so an old app
 * can't agree to wording it never displayed.
 */
export async function handleAiConsentPost(input: unknown, userId: string, store: AiConsentStore): Promise<Result<AiConsentInfo>> {
  const parsed = AllowInput.safeParse(input);
  if (!parsed.success) return { status: 400, body: { success: false, error: "That request didn't look right." } };
  if (parsed.data.version !== AI_CONSENT_VERSION) {
    return { status: 409, body: { success: false, error: "Please update the app to read what's changed, then try again." } };
  }
  await store.record(userId, AI_CONSENT_VERSION);
  return { status: 200, body: { success: true, data: { hasConsented: true, version: AI_CONSENT_VERSION } } };
}

export const AI_CONSENT_NEEDED = "Please allow Scryle to send your photo to its AI partners first.";

/**
 * Who is scanning, for the consent rule:
 * - no sign-in header: a website visitor. The website shows its own notice on the scan page.
 * - a valid sign-in: the account must have allowed the current wording (the iPhone app always signs in).
 * - a sign-in header that doesn't check out: refused, so a bad token can't skip the consent check.
 */
export type ScanCaller = { kind: "visitor" } | { kind: "user"; id: string } | { kind: "bad-token" };

export async function scanCaller(request: Request, verify: () => VerifyUser): Promise<ScanCaller> {
  if (!request.headers.has("authorization")) return { kind: "visitor" };
  const user = await userFromRequest(request, verify());
  return user ? { kind: "user", id: user.id } : { kind: "bad-token" };
}
