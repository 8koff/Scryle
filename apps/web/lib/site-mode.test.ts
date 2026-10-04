import { describe, expect, it } from "vitest";
import { waitlistRedirect } from "./site-mode";

describe("waitlistRedirect (waitlist-only mode)", () => {
  it("sends every app page to the waitlist", () => {
    for (const path of ["/", "/app", "/scan/room", "/renders", "/b/abcdefgh23", "/go/live-123", "/login", "/signup", "/admin", "/nope"]) {
      expect(waitlistRedirect(path, true)).toBe("/waitlist");
    }
  });

  it("keeps the waitlist, its link image, the legal pages and the icons open", () => {
    for (const path of ["/waitlist", "/waitlist/opengraph-image", "/privacy", "/terms", "/icon", "/apple-icon", "/manifest.webmanifest", "/opengraph-image"]) {
      expect(waitlistRedirect(path, true)).toBeNull();
    }
  });

  it("does not open look-alike paths", () => {
    for (const path of ["/waitlist-old", "/privacy/x", "/terms-of-sale", "/icons", "/iconic"]) {
      expect(waitlistRedirect(path, true)).toBe("/waitlist");
    }
  });

  it("changes nothing when the full site is on", () => {
    expect(waitlistRedirect("/", false)).toBeNull();
    expect(waitlistRedirect("/scan/room", false)).toBeNull();
  });
});
