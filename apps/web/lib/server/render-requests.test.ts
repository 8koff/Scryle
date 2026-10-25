import { describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { createMemoryRenderRequestStore, createSupabaseRenderRequestStore, runRenderRequest, type RenderRequestResult } from "./render-requests";

const INPUT = { claim: { pack: "room" }, selections: [{ partId: "wall", text: "green" }] };
const RESULT: RenderRequestResult = { status: 200, body: { success: true, data: { jobId: "job-original", jobToken: "test-job-proof", costUsd: 0.03 } } };

describe("durable render requests", () => {
  it("shares a claim across handlers and returns the saved outcome", async () => {
    const store = createMemoryRenderRequestStore();
    let finish!: (result: RenderRequestResult) => void;
    const run = vi.fn(() => new Promise<RenderRequestResult>((resolve) => { finish = resolve; }));
    const first = runRenderRequest("u1", "request-a", INPUT, store, run);
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    const concurrent = await runRenderRequest("u1", "request-a", INPUT, store, run);
    expect(concurrent.body).toMatchObject({ success: false, code: "render_pending" });
    finish(RESULT);
    expect(await first).toEqual(RESULT);
    expect(await runRenderRequest("u1", "request-a", INPUT, store, run)).toEqual(RESULT);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("rejects changed input but treats reordered object keys consistently", async () => {
    const store = createMemoryRenderRequestStore();
    const run = vi.fn(async () => RESULT);
    await runRenderRequest("u1", "request-a", INPUT, store, run);
    const reordered = { selections: INPUT.selections, claim: INPUT.claim };
    expect(await runRenderRequest("u1", "request-a", reordered, store, run)).toEqual(RESULT);
    const changed = await runRenderRequest("u1", "request-a", { ...INPUT, selections: [] }, store, run);
    expect(changed.status).toBe(409);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("isolates accounts even when request IDs match", async () => {
    const store = createMemoryRenderRequestStore();
    const run = vi.fn(async () => RESULT);
    await runRenderRequest("u1", "request-a", INPUT, store, run);
    expect(await store.get("u2", "request-a")).toBeNull();
    await runRenderRequest("u2", "request-a", INPUT, store, run);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("fails closed when claiming storage is unavailable", async () => {
    const store = createMemoryRenderRequestStore();
    store.claim = vi.fn(async () => { throw new Error("unavailable"); });
    const run = vi.fn(async () => RESULT);
    expect((await runRenderRequest("u1", "request-a", INPUT, store, run)).status).toBe(503);
    expect(run).not.toHaveBeenCalled();
  });

  it("never reclaims an ambiguous operation after an exception", async () => {
    const store = createMemoryRenderRequestStore();
    const run = vi.fn(async (): Promise<RenderRequestResult> => { throw new Error("process failed after submitting"); });
    expect((await runRenderRequest("u1", "request-a", INPUT, store, run)).body).toMatchObject({ code: "render_pending" });
    expect((await runRenderRequest("u1", "request-a", INPUT, store, run)).body).toMatchObject({ code: "render_pending" });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("keeps a provider-uncertain outcome pending", async () => {
    const store = createMemoryRenderRequestStore();
    const run = vi.fn(async (): Promise<RenderRequestResult> => ({ status: 503, body: { success: false, code: "render_pending", error: "Checking" } }));
    await runRenderRequest("u1", "request-a", INPUT, store, run);
    expect((await store.get("u1", "request-a"))?.result).toBeNull();
    await runRenderRequest("u1", "request-a", INPUT, store, run);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("does not resubmit if saving the known outcome fails", async () => {
    const store = createMemoryRenderRequestStore();
    store.complete = vi.fn(async () => { throw new Error("write unavailable"); });
    const run = vi.fn(async () => RESULT);
    // Deliver the known job if possible, even when durable acknowledgement is unavailable.
    expect(await runRenderRequest("u1", "request-a", INPUT, store, run)).toEqual(RESULT);
    expect((await runRenderRequest("u1", "request-a", INPUT, store, run)).body).toMatchObject({ code: "render_pending" });
    expect(run).toHaveBeenCalledTimes(1);
    expect(store.complete).toHaveBeenCalledTimes(2);
  });
});

describe("Supabase render request adapter", () => {
  const fingerprint = "a".repeat(64);

  function database() {
    // Real Supabase query construction with a mocked HTTP boundary; no network or database calls.
    const fetcher = vi.fn<typeof fetch>();
    const db = createClient("https://example.test", "test-only-service-key", {
      global: { fetch: fetcher }, auth: { persistSession: false, autoRefreshToken: false },
    });
    return { fetcher, store: () => createSupabaseRenderRequestStore(db) };
  }

  it("claims by insert and recovers a unique conflict through another adapter instance", async () => {
    const { fetcher, store } = database();
    fetcher.mockResolvedValueOnce(new Response(null, { status: 201 }));
    expect(await store().claim("owner-a", "request-a", fingerprint)).toBeNull();
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({ owner: "owner-a", request_id: "request-a", fingerprint });

    fetcher.mockResolvedValueOnce(Response.json({ code: "23505" }, { status: 409 }));
    fetcher.mockResolvedValueOnce(Response.json([{ fingerprint, result: RESULT }]));
    expect(await store().claim("owner-a", "request-a", fingerprint)).toEqual({ fingerprint, result: RESULT });
    const lookup = new URL(String(fetcher.mock.calls[2][0]));
    expect(lookup.pathname).toBe("/rest/v1/render_requests");
    expect(lookup.searchParams.get("owner")).toBe("eq.owner-a");
    expect(lookup.searchParams.get("request_id")).toBe("eq.request-a");
  });

  it("refuses claim errors and unreadable conflicts instead of declaring a new operation", async () => {
    const { fetcher, store } = database();
    fetcher.mockResolvedValueOnce(Response.json({ code: "42P01" }, { status: 400 }));
    await expect(store().claim("owner-a", "request-a", fingerprint)).rejects.toThrow("claim failed");
    expect(fetcher).toHaveBeenCalledTimes(1);
    fetcher.mockResolvedValueOnce(Response.json({ code: "23505" }, { status: 409 }));
    fetcher.mockResolvedValueOnce(Response.json([]));
    await expect(store().claim("owner-a", "request-a", fingerprint)).rejects.toThrow("not readable");
  });

  it("rejects corrupt outcomes and lookup failures", async () => {
    const { fetcher, store } = database();
    fetcher.mockResolvedValueOnce(Response.json([{ fingerprint, result: { status: 200, body: { success: true, data: {} } } }]));
    await expect(store().get("owner-a", "request-a")).rejects.toThrow();
    fetcher.mockResolvedValueOnce(Response.json({ code: "42501" }, { status: 403 }));
    await expect(store().get("owner-a", "request-a")).rejects.toThrow("lookup failed");
  });

  it("only completes the owner's unfinished row and tolerates an already-saved outcome", async () => {
    const { fetcher, store } = database();
    fetcher.mockResolvedValueOnce(Response.json({ request_id: "request-a" }));
    await store().complete("owner-a", "request-a", RESULT);
    const update = new URL(String(fetcher.mock.calls[0][0]));
    expect(fetcher.mock.calls[0][1]?.method).toBe("PATCH");
    expect(update.searchParams.get("owner")).toBe("eq.owner-a");
    expect(update.searchParams.get("request_id")).toBe("eq.request-a");
    expect(update.searchParams.get("result")).toBe("is.null");
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toMatchObject({ result: RESULT, finished_at: expect.any(String) });

    fetcher.mockResolvedValueOnce(Response.json(null));
    fetcher.mockResolvedValueOnce(Response.json([{ fingerprint, result: RESULT }]));
    await expect(store().complete("owner-a", "request-a", RESULT)).resolves.toBeUndefined();
  });

  it("does not acknowledge a failed write or a missing outcome", async () => {
    const { fetcher, store } = database();
    fetcher.mockResolvedValueOnce(Response.json({ code: "42501" }, { status: 403 }));
    await expect(store().complete("owner-a", "request-a", RESULT)).rejects.toThrow("completion failed");
    fetcher.mockResolvedValueOnce(Response.json(null));
    fetcher.mockResolvedValueOnce(Response.json([{ fingerprint, result: null }]));
    await expect(store().complete("owner-a", "request-a", RESULT)).rejects.toThrow("not completed");
  });
});
