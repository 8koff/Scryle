import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Hard cap on AI spend per UTC day (renders and photo reading), so a viral spike or a bot
 * can't drain the Higgsfield or Anthropic balance.
 * The real one lives in Supabase (supabase/migrations/0003_launch_safety.sql), shared by every
 * server. The memory one is for tests and for running without a database.
 */
export type SpendGuard = {
  /**
   * Books `usd` against today's budget. False when it would go over the cap. `share` (0..1)
   * stops early, at that part of the cap: photo reading uses it so it can never use up the
   * money left for paid renders.
   */
  tryReserve(usd: number, opts?: { share?: number }): Promise<boolean>;
  /** Gives money back when a render couldn't start. */
  release(usd: number): Promise<void>;
};

export function createSpendGuard({ dailyCapUsd, now = Date.now }: { dailyCapUsd: number; now?: () => number }) {
  let day = "";
  let spent = 0;

  const roll = () => {
    const today = new Date(now()).toISOString().slice(0, 10);
    if (today !== day) {
      day = today;
      spent = 0;
    }
  };

  return {
    async tryReserve(usd: number, { share = 1 }: { share?: number } = {}): Promise<boolean> {
      roll();
      if (spent + usd > dailyCapUsd * share + 1e-9) return false;
      spent += usd;
      return true;
    },
    async release(usd: number): Promise<void> {
      roll();
      spent = Math.max(0, spent - usd);
    },
    spentTodayUsd(): number {
      roll();
      return spent;
    },
  } satisfies SpendGuard & { spentTodayUsd(): number };
}

/**
 * The shared cap. Fails closed: if the database can't be reached, `tryReserve` throws and
 * the render is refunded, so an outage can never mean unlimited spending.
 */
export function createSupabaseSpendGuard(db: SupabaseClient, { dailyCapUsd }: { dailyCapUsd: number }): SpendGuard {
  return {
    async tryReserve(usd, { share = 1 } = {}) {
      const { data, error } = await db.rpc("reserve_spend", { p_usd: usd, p_cap: dailyCapUsd * share });
      if (error) throw new Error(`[spend] reserve failed: ${error.message}`);
      return data === true;
    },
    async release(usd) {
      const { error } = await db.rpc("release_spend", { p_usd: usd });
      if (error) throw new Error(`[spend] release failed: ${error.message}`);
    },
  };
}
