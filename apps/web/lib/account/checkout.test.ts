import { describe, expect, it, vi } from "vitest";
import { startCheckout } from "./checkout";

const reply = (body: unknown) => vi.fn(async () => new Response(JSON.stringify(body)));

describe("startCheckout", () => {
  it("asks for the chosen pack and goes to Stripe's page", async () => {
    const fetcher = reply({ success: true, data: { url: "https://checkout.stripe.com/x" } });
    const go = vi.fn();
    expect(await startCheckout("plus", "/", fetcher, go)).toBeNull();
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/checkout");
    expect(JSON.parse(init.body as string)).toEqual({ pack: "plus", returnTo: "/" });
    expect(go).toHaveBeenCalledWith("https://checkout.stripe.com/x");
  });

  it("returns the server's message and stays on the page", async () => {
    const go = vi.fn();
    expect(await startCheckout("pro", "/", reply({ success: false, error: "Sign in first." }), go)).toBe("Sign in first.");
    expect(go).not.toHaveBeenCalled();
  });

  it("explains a network failure", async () => {
    const fetcher = vi.fn(async () => {
      throw new TypeError("offline");
    });
    expect(await startCheckout("starter", "/", fetcher, vi.fn())).toMatch(/aren't working/);
  });
});
