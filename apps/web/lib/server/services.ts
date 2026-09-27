import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminDb } from "./accounts";
import { anthropicFromEnv } from "./anthropic";
import { higgsfieldFromEnv } from "./higgsfield/client";
import { renderModelFromEnv } from "./higgsfield/defaults";
import { createRateLimiter, createSupabaseRateLimiter, type RateLimiter } from "./rate-limit";
import { createRenderAssets } from "./render-assets";
import { createMemoryShopStore, createSupabaseShopStore } from "./shop/products";
import { serpApiFromEnv } from "./shop/serpapi";
import { signingSecretFromEnv } from "./signing";
import { createSpendGuard, createSupabaseSpendGuard, type SpendGuard } from "./spend";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/**
 * New store searches per day, all visitors together. 12 a day is a little over SerpApi's free
 * 250 a month: fine while testing. Raise SHOP_SEARCH_DAILY_CAP after upgrading the plan.
 */
const DEFAULT_SHOP_SEARCHES_PER_DAY = 12;
/** New store searches per visitor per day, so one visitor can't use up everyone's budget. */
const SHOP_SEARCHES_PER_VISITOR = 8;

const positiveNumber = (raw: string | undefined, fallback: number) => {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/**
 * One shared set of server services per process, created on first use.
 * With Supabase set up, the spend cap and rate limits live in the database, so every
 * server instance shares them. Without it (plain local dev) they fall back to memory.
 */
let services: ReturnType<typeof create> | null = null;

function databaseOrNull(): SupabaseClient | null {
  try {
    return getAdminDb();
  } catch {
    console.warn("[services] Supabase isn't set up: spend cap and rate limits are per server");
    return null;
  }
}

function create() {
  const higgsfield = higgsfieldFromEnv();
  const secret = signingSecretFromEnv();
  const dailyCapUsd = positiveNumber(process.env.RENDER_DAILY_CAP_USD, 2);
  const shopSearchesPerDay = Math.floor(positiveNumber(process.env.SHOP_SEARCH_DAILY_CAP, DEFAULT_SHOP_SEARCHES_PER_DAY));
  const db = databaseOrNull();

  const limiter = (name: string, limit: number, { windowMs = HOUR_MS, failClosed = false } = {}): RateLimiter =>
    db ? createSupabaseRateLimiter(db, { name, limit, windowMs, secret, failClosed }) : createRateLimiter({ limit, windowMs });
  const spend: SpendGuard = db ? createSupabaseSpendGuard(db, { dailyCapUsd }) : createSpendGuard({ dailyCapUsd });
  // One shared count for everyone (key "all"). If it can't be checked, no paid search is made.
  const shopBudget = limiter("shop-search-day", shopSearchesPerDay, { windowMs: DAY_MS, failClosed: true });
  const shopVisitorBudget = limiter("shop-search-visitor", Math.min(SHOP_SEARCHES_PER_VISITOR, shopSearchesPerDay), {
    windowMs: DAY_MS,
    failClosed: true,
  });

  return {
    higgsfield,
    anthropic: anthropicFromEnv(),
    secret,
    renderModel: renderModelFromEnv(),
    visionModel: process.env.VISION_MODEL || undefined,
    assets: createRenderAssets(higgsfield),
    spend,
    // In front of paid AI calls: if the limit can't be checked, refuse.
    scanLimit: limiter("scan", 20, { failClosed: true }),
    renderLimit: limiter("render", 15, { failClosed: true }),
    shareCardLimit: limiter("share-card", 30),
    shareLinkLimit: limiter("share-link", 20),
    checkoutLimit: limiter("checkout", 10),
    reopenLimit: limiter("reopen", 30),
    reportLimit: limiter("report", 10),
    /** Reports that hide a link at once, per visitor per day, so nobody can empty the gallery. */
    reportHideLimit: limiter("report-hide", 3, { windowMs: DAY_MS }),
    shopSearchLimit: limiter("shop-search", 60),
    shopProductsLimit: limiter("shop-products", 120),
    goLimit: limiter("go", 120),
    /** Store search (SerpApi). Found products live in the database so every server sees them. */
    shop: {
      store: db ? createSupabaseShopStore(db) : createMemoryShopStore(),
      api: serpApiFromEnv(),
      /** One new search from this visitor's daily share, then from everyone's. */
      takeSearch: async (visitor: string) =>
        (await shopVisitorBudget.check(visitor)).allowed && (await shopBudget.check("all")).allowed,
    },
  };
}

export function getServices() {
  services ??= create();
  return services;
}

/**
 * Who is calling, for rate limits. The first X-Forwarded-For entry is whatever the caller
 * wrote, so prefer the header Vercel sets itself, then the last hop our proxy added.
 */
export function clientKey(request: Request): string {
  const h = request.headers;
  const forwarded = h.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean);
  return h.get("x-vercel-forwarded-for")?.trim() || h.get("x-real-ip")?.trim() || forwarded?.at(-1) || "local";
}
