import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  owner: "user-a" as string | null,
  get: vi.fn(),
  check: vi.fn(),
}));
vi.mock("@/lib/server/accounts", () => ({
  getAdminDb: () => ({}),
  requireUser: async () => mocks.owner
    ? { ok: true, user: { id: mocks.owner } }
    : { ok: false, response: Response.json({ success: false }, { status: 401 }) },
}));
vi.mock("@/lib/server/render-requests", () => ({ createSupabaseRenderRequestStore: () => ({ get: mocks.get }) }));
vi.mock("@/lib/server/services", () => ({ getServices: () => ({ shopProductsLimit: { check: mocks.check } }), clientKey: () => "test-client" }));
const { GET } = await import("./route");
const ID = "62cde81a-c140-491a-8c36-48d3c31e0a68";
const call = (id = ID) => GET(new Request(`https://example.test/api/render/requests/${id}`), { params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.owner = "user-a";
  mocks.get.mockResolvedValue(null);
  mocks.check.mockResolvedValue({ allowed: true, retryAfterSec: 0 });
});

describe("render request recovery", () => {
  it("requires authentication", async () => {
    mocks.owner = null;
    expect((await call()).status).toBe(401);
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it("validates IDs before accessing storage", async () => {
    expect((await call("invalid")).status).toBe(400);
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it("scopes lookups to the signed-in account and does not cache the response", async () => {
    const response = await call();
    expect(await response.json()).toEqual({ success: true, data: { requestId: ID, state: "missing" } });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.get).toHaveBeenCalledWith("user-a", ID);
  });
  it("reports pending and completed outcomes", async () => {
    mocks.get.mockResolvedValueOnce({ result: null });
    expect(await (await call()).json()).toMatchObject({ data: { state: "pending" } });
    const result = { success: true, data: { jobId: "test-job", jobToken: "test-proof", costUsd: 0.03, requestId: ID } };
    mocks.get.mockResolvedValueOnce({ result: { status: 200, body: result } });
    expect(await (await call()).json()).toMatchObject({ data: { state: "finished", result } });
  });
  it("honors the read limit and fails closed on database errors", async () => {
    mocks.check.mockResolvedValueOnce({ allowed: false, retryAfterSec: 12 });
    const limited = await call();
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("12");
    expect(mocks.get).not.toHaveBeenCalled();
    mocks.get.mockRejectedValueOnce(new Error("db unavailable"));
    expect((await call()).status).toBe(503);
  });
});
