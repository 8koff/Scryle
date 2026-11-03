import { describe, expect, it } from "vitest";
import { waitlistRedirect } from "./site-mode";

describe("waitlistRedirect (waitlist-only mode)", () => {
  it("sends every app page to the waitlist", () => {
    for (const path of ["/", "/app", "/app/account", "/scan/room", "/renders", "/go/live-123", "/login", "/signup", "/nope"]) {
      expect(waitlistRedirect(path, true)).toBe("/waitlist");
    }
  });

  it("keeps the waitlist, its link image, the legal pages and the icons open", () => {
    for (const path of ["/waitlist", "/waitlist/opengraph-image", "/privacy", "/terms", "/icon", "/apple-icon", "/manifest.webmanifest", "/opengraph-image"]) {
      expect(waitlistRedirect(path, true)).toBeNull();
    }
  });

  it("keeps what the iPhone app links to open: share links, Buy links and the admin page", () => {
    // The app makes /b/<id> links and opens /go/<id> for Buy; closed, both would show the waitlist instead.
    for (const path of ["/b/abcdefgh23", `/go/live-${"a1".repeat(10)}`, "/admin"]) {
      expect(waitlistRedirect(path, true)).toBeNull();
    }
  });

  it("does not open look-alike paths", () => {
    for (const path of ["/waitlist-old", "/privacy/x", "/terms-of-sale", "/icons", "/iconic", "/b/short", "/b/abcdefgh23/x", "/go/anything", "/admin/x", "/administrator"]) {
      expect(waitlistRedirect(path, true)).toBe("/waitlist");
    }
  });

  it("changes nothing when the full site is on", () => {
    expect(waitlistRedirect("/", false)).toBeNull();
    expect(waitlistRedirect("/scan/room", false)).toBeNull();
  });
});
