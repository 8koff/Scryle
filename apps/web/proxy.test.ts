import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "./proxy";
import { WAITLIST_ONLY } from "./lib/site-mode";

const visit = (url: string) => proxy(new NextRequest(url));

describe.runIf(WAITLIST_ONLY)("proxy in waitlist-only mode", () => {
  it("keeps a marketing link's ?ref= on the way to the waitlist", () => {
    const response = visit("https://scryle.app/?ref=tiktok");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://scryle.app/waitlist?ref=tiktok");
  });

  it("keeps every query parameter, and adds none when there are none", () => {
    expect(visit("https://scryle.app/app?ref=x&invite=abc").headers.get("location")).toBe("https://scryle.app/waitlist?ref=x&invite=abc");
    expect(visit("https://scryle.app/app").headers.get("location")).toBe("https://scryle.app/waitlist");
  });

  it("only ever sends visitors to our own waitlist page", () => {
    const location = visit("https://scryle.app/?next=https://evil.example").headers.get("location");
    expect(new URL(location!).origin).toBe("https://scryle.app");
    expect(new URL(location!).pathname).toBe("/waitlist");
  });

  it("lets the waitlist page itself load, with its security headers", () => {
    const response = visit("https://scryle.app/waitlist?ref=tiktok");
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("content-security-policy")).toContain("default-src");
  });
});
