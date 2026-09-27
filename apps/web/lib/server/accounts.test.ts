import { describe, expect, it, vi } from "vitest";
import { siteOrigin, userFromRequest } from "./accounts";
import { clientKey } from "./services";

const TOKEN = "eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiJ1MSJ9.sig-part-long-enough";
const req = (auth?: string) => new Request("https://x/api", { headers: auth ? { authorization: auth } : {} });

describe("userFromRequest", () => {
  it("returns the user for a valid bearer token", async () => {
    const verify = vi.fn(async () => ({ id: "u1" }));
    expect(await userFromRequest(req(`Bearer ${TOKEN}`), verify)).toEqual({ id: "u1" });
    expect(verify).toHaveBeenCalledWith(TOKEN);
  });

  it("returns null without a token or with a malformed one, without checking", async () => {
    const verify = vi.fn(async () => ({ id: "u1" }));
    expect(await userFromRequest(req(), verify)).toBeNull();
    expect(await userFromRequest(req("Basic abc"), verify)).toBeNull();
    expect(await userFromRequest(req("Bearer short"), verify)).toBeNull();
    expect(verify).not.toHaveBeenCalled();
  });

  it("returns null when the check fails or throws", async () => {
    expect(await userFromRequest(req(`Bearer ${TOKEN}`), async () => null)).toBeNull();
    const broken = vi.fn(async () => Promise.reject(new Error("network")));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await userFromRequest(req(`Bearer ${TOKEN}`), broken)).toBeNull();
  });
});

describe("siteOrigin", () => {
  const at = (url: string) => new Request(url);

  it("uses the configured site address", () => {
    expect(siteOrigin(at("https://evil.example/api"), { NEXT_PUBLIC_SITE_URL: "https://scryapp.io/" })).toBe("https://scryapp.io");
  });

  it("trusts the request host only on your own computer", () => {
    expect(siteOrigin(at("http://localhost:3000/api"), {})).toBe("http://localhost:3000");
    expect(() => siteOrigin(at("https://evil.example/api"), {})).toThrow();
  });
});

describe("clientKey", () => {
  const at = (headers: Record<string, string>) => new Request("https://x/api", { headers });

  it("prefers the platform's own header over what the caller wrote", () => {
    expect(clientKey(at({ "x-vercel-forwarded-for": "1.1.1.1", "x-forwarded-for": "6.6.6.6" }))).toBe("1.1.1.1");
    expect(clientKey(at({ "x-forwarded-for": "6.6.6.6, 2.2.2.2" }))).toBe("2.2.2.2");
    expect(clientKey(at({}))).toBe("local");
  });
});
