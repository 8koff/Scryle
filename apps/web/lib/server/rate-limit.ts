import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type RateCheck = { allowed: boolean; retryAfterSec: number };
export type RateLimiter = { check(key: string): Promise<RateCheck> };

/** When a fail-closed limit can't be checked, callers are told to try again after this long. */
const FAIL_CLOSED_RETRY_SEC = 60;

/** In-memory sliding-window limiter. Used in tests and when there is no database. */
export function createRateLimiter({
  limit,
  windowMs,
  now = Date.now,
}: {
  limit: number;
  windowMs: number;
  now?: () => number;
}): RateLimiter {
  const hits = new Map<string, number[]>();

  return {
    async check(key) {
      const t = now();
      const recent = (hits.get(key) ?? []).filter((at) => t - at < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        const retryAfterSec = Math.max(1, Math.ceil((windowMs - (t - recent[0]!)) / 1000));
        return { allowed: false, retryAfterSec };
      }
      hits.set(key, [...recent, t]);
      return { allowed: true, retryAfterSec: 0 };
    },
  };
}

/**
 * Shared limiter in Supabase (fixed windows), so every server counts the same hits.
 * Visitors are stored as a keyed hash, never as a raw IP address. `name` keeps each
 * limit's counts apart. Fails open by default, so an outage doesn't lock everyone out;
 * `failClosed` limits (the ones in front of paid AI calls) refuse instead.
 */
export function createSupabaseRateLimiter(
  db: SupabaseClient,
  {
    name,
    limit,
    windowMs,
    secret,
    failClosed = false,
  }: { name: string; limit: number; windowMs: number; secret: string; failClosed?: boolean },
): RateLimiter {
  const windowSec = Math.max(1, Math.round(windowMs / 1000));
  return {
    async check(key) {
      const hashed = createHmac("sha256", secret).update(`${name}:${key}`).digest("base64url");
      const { data, error } = await db.rpc("rate_limit_hit", { p_key: hashed, p_limit: limit, p_window_sec: windowSec });
      if (error) {
        console.error(`[rate-limit] ${name} check failed`, error.message);
        return failClosed ? { allowed: false, retryAfterSec: FAIL_CLOSED_RETRY_SEC } : { allowed: true, retryAfterSec: 0 };
      }
      const wait = Number(data);
      return wait > 0 ? { allowed: false, retryAfterSec: wait } : { allowed: true, retryAfterSec: 0 };
    },
  };
}
