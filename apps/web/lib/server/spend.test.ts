import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { createSpendGuard, createSupabaseSpendGuard } from "./spend";

describe("spend guard", () => {
  it("allows spending up to the daily cap, then refuses", async () => {
    const guard = createSpendGuard({ dailyCapUsd: 0.1, now: () => Date.UTC(2026, 8, 23, 12) });
    expect(await guard.tryReserve(0.04)).toBe(true);
    expect(await guard.tryReserve(0.04)).toBe(true);
    expect(await guard.tryReserve(0.04)).toBe(false);
    expect(guard.spentTodayUsd()).toBeCloseTo(0.08);
  });

  it("starts a fresh budget on a new UTC day", async () => {
    let now = Date.UTC(2026, 8, 23, 23, 59);
    const guard = createSpendGuard({ dailyCapUsd: 0.05, now: () => now });
    expect(await guard.tryReserve(0.05)).toBe(true);
    now = Date.UTC(2026, 8, 24, 0, 1);
    expect(await guard.tryReserve(0.05)).toBe(true);
  });

  it("stops a share of the budget early, leaving the rest for others", async () => {
    const guard = createSpendGuard({ dailyCapUsd: 0.2, now: () => 0 });
    expect(await guard.tryReserve(0.1, { share: 0.5 })).toBe(true);
    expect(await guard.tryReserve(0.05, { share: 0.5 })).toBe(false);
    expect(await guard.tryReserve(0.1)).toBe(true);
  });

  it("gives money back when a render fails", async () => {
    const guard = createSpendGuard({ dailyCapUsd: 0.05, now: () => 0 });
    await guard.tryReserve(0.05);
    await guard.release(0.05);
    expect(await guard.tryReserve(0.05)).toBe(true);
  });
});

const fakeDb = (result: { data?: unknown; error?: { message: string } | null }) => {
  const rpc = vi.fn(async () => ({ data: result.data ?? null, error: result.error ?? null }));
  return { db: { rpc } as unknown as SupabaseClient, rpc };
};

describe("shared spend guard", () => {
  it("sends the price and the cap to the database", async () => {
    const { db, rpc } = fakeDb({ data: true });
    const guard = createSupabaseSpendGuard(db, { dailyCapUsd: 2 });
    expect(await guard.tryReserve(0.03)).toBe(true);
    expect(rpc).toHaveBeenCalledWith("reserve_spend", { p_usd: 0.03, p_cap: 2 });
  });

  it("sends a smaller cap for a share of the budget", async () => {
    const { db, rpc } = fakeDb({ data: true });
    await createSupabaseSpendGuard(db, { dailyCapUsd: 2 }).tryReserve(0.05, { share: 0.5 });
    expect(rpc).toHaveBeenCalledWith("reserve_spend", { p_usd: 0.05, p_cap: 1 });
  });

  it("refuses when the database says the cap is reached", async () => {
    const { db } = fakeDb({ data: false });
    expect(await createSupabaseSpendGuard(db, { dailyCapUsd: 2 }).tryReserve(0.03)).toBe(false);
  });

  it("fails closed when the database is down", async () => {
    const { db } = fakeDb({ error: { message: "offline" } });
    await expect(createSupabaseSpendGuard(db, { dailyCapUsd: 2 }).tryReserve(0.03)).rejects.toThrow(/reserve failed/);
  });
});
