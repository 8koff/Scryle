import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, createNonce, SECURITY_HEADERS } from "./csp";

const directive = (policy: string, name: string) => policy.split("; ").find((d) => d.startsWith(`${name} `)) ?? "";

describe("contentSecurityPolicy", () => {
  const prod = contentSecurityPolicy({ nonce: "abc123", supabaseUrl: "https://proj.supabase.co/rest/v1/", isDev: false });

  it("only runs scripts that carry this request's nonce", () => {
    expect(directive(prod, "script-src")).toBe("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(prod).not.toContain("unsafe-eval");
  });

  it("lets the browser talk to Supabase, Higgsfield images and the detector model", () => {
    const connect = directive(prod, "connect-src");
    expect(connect).toContain("https://proj.supabase.co");
    expect(connect).toContain("wss://proj.supabase.co");
    expect(connect).toContain("https://storage.googleapis.com");
    expect(directive(prod, "img-src")).toBe("img-src 'self' blob: data: https:");
  });

  it("blocks framing, plugins and foreign form posts", () => {
    expect(prod).toContain("frame-ancestors 'none'");
    expect(prod).toContain("object-src 'none'");
    expect(prod).toContain("form-action 'self'");
    expect(prod).toContain("upgrade-insecure-requests");
  });

  it("allows what the dev server needs, only in dev", () => {
    const dev = contentSecurityPolicy({ nonce: "n", isDev: true });
    expect(directive(dev, "script-src")).toContain("'unsafe-eval'");
    expect(directive(dev, "connect-src")).toContain("ws:");
    expect(dev).not.toContain("upgrade-insecure-requests");
  });

  it("works before Supabase is set up", () => {
    expect(contentSecurityPolicy({ nonce: "n", isDev: false })).not.toContain("supabase");
  });
});

describe("createNonce", () => {
  it("is different every time", () => {
    expect(createNonce()).not.toBe(createNonce());
  });
});

describe("SECURITY_HEADERS", () => {
  it("tells browsers to use HTTPS only, for two years", () => {
    expect(SECURITY_HEADERS["Strict-Transport-Security"]).toBe("max-age=63072000");
  });
});
