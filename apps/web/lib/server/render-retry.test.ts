import { describe, expect, it, vi } from "vitest";
import { createMemoryCreditStore } from "./credits";
import { handleRender, type RenderDeps } from "./render";
import { createMemoryRenderRequestStore } from "./render-requests";
import { signPhoto, type PhotoClaim } from "./signing";
import { createSpendGuard } from "./spend";

const SIGNING_KEY = "render-retry-unit-test-signing-key";

describe("retrying an interrupted render start", () => {
  it.each([1, 2])("recovers the accepted job after a lost response with %i starting credits", async (balance) => {
    const claim: PhotoClaim = {
      photoUrl: "https://example.test/room.jpg",
      pack: "room",
      width: 1080,
      height: 1440,
      scene: { subject: "a room", parts: [] },
    };
    const input = {
      requestId: "62cde81a-c140-491a-8c36-48d3c31e0a68",
      claim,
      token: signPhoto(claim, SIGNING_KEY),
      selections: [{ partId: "wall-colour", productId: "room-wall-colour-sage-green-matte-paint" }],
    };
    const credits = createMemoryCreditStore({ "test-user": balance });
    const submit = vi.fn<RenderDeps["submit"]>()
      .mockResolvedValueOnce("test-job-original")
      .mockResolvedValueOnce("test-job-duplicate");
    const deps: RenderDeps = {
      secret: SIGNING_KEY,
      model: "marketing-low",
      productImageUrl: vi.fn(async () => "https://example.test/product.jpg"),
      combine: vi.fn(async () => "https://example.test/products.jpg"),
      estimate: vi.fn(async () => 0.03),
      submit,
      spend: createSpendGuard({ dailyCapUsd: 1 }),
      userId: "test-user",
      credits,
      recordRender: vi.fn(async () => {}),
      requests: createMemoryRenderRequestStore(),
    };

    const accepted = await handleRender(input, deps);
    expect(accepted.status).toBe(200);
    // The server finishes, but this response never reaches the phone. It resends the same intent.
    const retried = await handleRender(input, deps);

    expect.soft(submit).toHaveBeenCalledTimes(1);
    expect.soft(await credits.balance("test-user")).toBe(balance - 1);
    expect(retried).toEqual(accepted);
  });

  it("refuses a request ID when durable storage is unavailable, before spending", async () => {
    const claim: PhotoClaim = { photoUrl: "https://example.test/room.jpg", pack: "room", width: 3, height: 4, scene: { subject: "room", parts: [] } };
    const credits = createMemoryCreditStore({ "test-user": 2 });
    const submit = vi.fn(async () => "test-job");
    const result = await handleRender({
      requestId: "62cde81a-c140-491a-8c36-48d3c31e0a68", claim, token: signPhoto(claim, SIGNING_KEY),
      selections: [{ partId: "wall-colour", productId: "room-wall-colour-sage-green-matte-paint" }],
    }, {
      secret: SIGNING_KEY, model: "marketing-low", productImageUrl: vi.fn(), combine: vi.fn(), estimate: vi.fn(async () => 0.03),
      submit, spend: createSpendGuard({ dailyCapUsd: 1 }), userId: "test-user", credits,
    });
    expect(result.status).toBe(503);
    expect(submit).not.toHaveBeenCalled();
    expect(await credits.balance("test-user")).toBe(2);
  });

  it("does not submit or release reserved spend again when provider acceptance is unknown", async () => {
    const claim: PhotoClaim = { photoUrl: "https://example.test/room.jpg", pack: "room", width: 3, height: 4, scene: { subject: "room", parts: [] } };
    const credits = createMemoryCreditStore({ "test-user": 2 });
    const submit = vi.fn(async (): Promise<string> => { throw new Error("provider response lost"); });
    const spend = createSpendGuard({ dailyCapUsd: 1 });
    const deps: RenderDeps = {
      secret: SIGNING_KEY, model: "marketing-low", productImageUrl: vi.fn(), combine: vi.fn(), estimate: vi.fn(async () => 0.03),
      submit, spend, userId: "test-user", credits, requests: createMemoryRenderRequestStore(),
    };
    const input = {
      requestId: "62cde81a-c140-491a-8c36-48d3c31e0a68", claim, token: signPhoto(claim, SIGNING_KEY),
      selections: [{ partId: "wall-colour", productId: "room-wall-colour-sage-green-matte-paint" }],
    };
    expect((await handleRender(input, deps)).body).toMatchObject({ code: "render_pending" });
    expect((await handleRender(input, deps)).body).toMatchObject({ code: "render_pending" });
    expect(submit).toHaveBeenCalledTimes(1);
    expect(await credits.balance("test-user")).toBe(1);
    expect(spend.spentTodayUsd()).toBe(0.03);
  });
});
