import { AI_CONSENT_VERSION } from "@retrofit/core";
import { describe, expect, it, vi } from "vitest";
import { createMemoryAiConsentStore, handleAiConsentGet, handleAiConsentPost, hasAiConsent, scanCaller } from "./ai-consent";

describe("AI-data consent", () => {
  it("a new account hasn't consented", async () => {
    const store = createMemoryAiConsentStore();
    expect(await handleAiConsentGet("u1", store)).toEqual({
      status: 200,
      body: { success: true, data: { hasConsented: false, version: AI_CONSENT_VERSION } },
    });
  });

  it("Allow is saved on the server and is still there next time", async () => {
    const store = createMemoryAiConsentStore();

    const allowed = await handleAiConsentPost({ version: AI_CONSENT_VERSION }, "u1", store);

    expect(allowed).toEqual({ status: 200, body: { success: true, data: { hasConsented: true, version: AI_CONSENT_VERSION } } });
    expect(store.rows.get("u1")).toBe(AI_CONSENT_VERSION);
    // A later visit (new request, same store) reads it back.
    expect((await handleAiConsentGet("u1", store)).body).toMatchObject({ data: { hasConsented: true } });
    expect(await hasAiConsent(store, "u1")).toBe(true);
  });

  it("allowing twice is fine", async () => {
    const store = createMemoryAiConsentStore();
    await handleAiConsentPost({ version: AI_CONSENT_VERSION }, "u1", store);
    expect((await handleAiConsentPost({ version: AI_CONSENT_VERSION }, "u1", store)).status).toBe(200);
    expect(store.rows.size).toBe(1);
  });

  it("refuses wording the app didn't show (an old or made-up version)", async () => {
    const store = createMemoryAiConsentStore();
    expect((await handleAiConsentPost({ version: AI_CONSENT_VERSION + 1 }, "u1", store)).status).toBe(409);
    expect((await handleAiConsentPost({ version: AI_CONSENT_VERSION - 1 }, "u1", store)).status).toBe(AI_CONSENT_VERSION > 1 ? 409 : 400);
    expect(store.rows.size).toBe(0);
  });

  it("refuses a body that isn't { version: number }", async () => {
    const store = createMemoryAiConsentStore();
    for (const input of [null, {}, { version: "1" }, { version: 1.5 }, "yes"]) {
      expect((await handleAiConsentPost(input, "u1", store)).status).toBe(400);
    }
    expect(store.rows.size).toBe(0);
  });

  it("consent to an older wording no longer counts once the wording changes", async () => {
    const store = createMemoryAiConsentStore();
    await store.record("u1", AI_CONSENT_VERSION - 1);
    expect(await hasAiConsent(store, "u1")).toBe(false);
  });
});

describe("scanCaller", () => {
  const request = (authorization?: string) =>
    new Request("https://scryle.test/api/scan", { method: "POST", headers: authorization ? { authorization } : {} });
  const token = "a".repeat(40);

  it("treats a request with no sign-in as a website visitor, without checking anything", async () => {
    const verify = vi.fn();
    expect(await scanCaller(request(), verify)).toEqual({ kind: "visitor" });
    expect(verify).not.toHaveBeenCalled();
  });

  it("finds the signed-in account", async () => {
    const verifyUser = vi.fn(async () => ({ id: "u1" }));
    expect(await scanCaller(request(`Bearer ${token}`), () => verifyUser)).toEqual({ kind: "user", id: "u1" });
    expect(verifyUser).toHaveBeenCalledWith(token);
  });

  it("flags a sign-in that doesn't check out, so it can't skip the consent check", async () => {
    const verifyUser = vi.fn(async () => null);
    expect(await scanCaller(request(`Bearer ${token}`), () => verifyUser)).toEqual({ kind: "bad-token" });
    expect(await scanCaller(request("Bearer"), () => verifyUser)).toEqual({ kind: "bad-token" });
  });
});
