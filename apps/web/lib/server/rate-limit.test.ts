import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { createRateLimiter, createSupabaseRateLimiter } from "./rate-limit";

describe("rate limiter", () => {
  it("allows up to the limit inside the window, then blocks", async () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000, now: () => 0 });

    expect((await limiter.check("a")).allowed).toBe(true);
    expect((await limiter.check("a")).allowed).toBe(true);
    const third = await limiter.check("a");
    expect(third.allowed).toBe(false);
    expect(third.retryAfterSec).toBe(1);
  });

  it("tracks each key separately", async () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now: () => 0 });
    expect((await limiter.check("a")).allowed).toBe(true);
    expect((await limiter.check("b")).allowed).toBe(true);
  });

  it("frees up again once the window has passed", async () => {
    let now = 0;
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now: () => now });
    await limiter.check("a");
    now = 1001;
    expect((await limiter.check("a")).allowed).toBe(true);
  });
});

describe("shared rate limiter", () => {
  const setup = (result: { data?: unknown; error?: { message: string } }, failClosed = false) => {
    const rpc = vi.fn(async () => ({ data: result.data ?? null, error: result.error ?? null }));
    const limiter = createSupabaseRateLimiter({ rpc } as unknown as SupabaseClient, {
      name: "scan",
      limit: 20,
      windowMs: 60 * 60 * 1000,
      secret: "rate-limit-test-secret",
      failClosed,
    });
    return { rpc, limiter };
  };

  it("never stores the raw IP address", async () => {
    const { rpc, limiter } = setup({ data: 0 });
    await limiter.check("203.0.113.9");
    const args = (rpc.mock.calls[0] as unknown[])[1] as { p_key: string; p_limit: number; p_window_sec: number };
    expect(args.p_key).not.toContain("203.0.113.9");
    expect(args).toMatchObject({ p_limit: 20, p_window_sec: 3600 });
  });

  it("blocks with the wait time the database gives", async () => {
    const { limiter } = setup({ data: 120 });
    expect(await limiter.check("a")).toEqual({ allowed: false, retryAfterSec: 120 });
  });

  it("refuses when the database is down, for limits in front of paid AI calls", async () => {
    const { limiter } = setup({ error: { message: "offline" } }, true);
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await limiter.check("a")).toEqual({ allowed: false, retryAfterSec: 60 });
  });

  it("lets people through when the database is down", async () => {
    const { limiter } = setup({ error: { message: "offline" } });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await limiter.check("a")).allowed).toBe(true);
  });
});
