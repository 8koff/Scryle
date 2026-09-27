import { describe, expect, it, vi } from "vitest";
import { fetchImage, handleShare, isTrustedResultUrl, jpegForBox, shareLayout, SHARE_SIZE, type ShareDeps } from "./share";
import { signJob, signPhoto, type PhotoClaim } from "./signing";

const SECRET = "share-test-secret-with-enough-length!";

const claim: PhotoClaim = {
  photoUrl: "https://cdn/person.jpg",
  pack: "clothing",
  width: 1080,
  height: 1440,
  scene: { subject: "a person", parts: [] },
};

const deps = (overrides: Partial<ShareDeps> = {}): ShareDeps => ({
  secret: SECRET,
  status: vi.fn(async () => ({ status: "completed", images: ["https://d1.cloudfront.net/after.jpg"] })),
  ...overrides,
});

const input = (overrides: Record<string, unknown> = {}) => ({
  claim,
  token: signPhoto(claim, SECRET),
  jobId: "job-12345678",
  jobToken: signJob("job-12345678", SECRET),
  ...overrides,
});

describe("shareLayout", () => {
  const inside = (box: { x: number; y: number; width: number; height: number }, area: { width: number; height: number }) =>
    box.x >= 0 && box.y >= 0 && box.x + box.width <= area.width && box.y + box.height <= area.height;

  it("overlaps tall photos, with the after photo bigger, all inside the card", () => {
    for (const aspect of [9 / 16, 3 / 4, 0.9]) {
      const l = shareLayout(aspect);
      expect(l.mode).toBe("stagger");
      expect(inside(l.before, l.area) && inside(l.after, l.area)).toBe(true);
      expect(l.after.width).toBeGreaterThan(l.before.width);
      expect(l.area.height + l.pad * 2 + l.footer).toBe(SHARE_SIZE.height);
    }
  });

  it("stacks wide photos (cars, rooms) without overlap, inside the card", () => {
    const l = shareLayout(4 / 3);
    expect(l.mode).toBe("stack");
    expect(inside(l.before, l.area) && inside(l.after, l.area)).toBe(true);
    expect(l.after.y).toBeGreaterThanOrEqual(l.before.y + l.before.height);
  });
});

describe("handleShare", () => {
  it("returns the original and the finished render for a signed photo and job", async () => {
    const result = await handleShare(input(), deps());
    expect(result).toEqual({ ok: true, beforeUrl: "https://cdn/person.jpg", afterUrl: "https://d1.cloudfront.net/after.jpg", aspect: 0.75 });
  });

  it("refuses a photo or job the server didn't sign (so it can't share other people's pictures)", async () => {
    expect((await handleShare(input({ token: "1.bad" }), deps())).ok).toBe(false);
    expect((await handleShare(input({ jobToken: "bad" }), deps())).ok).toBe(false);
    expect((await handleShare({ nonsense: true }, deps())).ok).toBe(false);
  });

  it("refuses a render that isn't finished", async () => {
    const result = await handleShare(input(), deps({ status: vi.fn(async () => ({ status: "in_progress" })) }));
    expect(result).toMatchObject({ ok: false, status: 409 });
  });
});

describe("isTrustedResultUrl", () => {
  it("only trusts Higgsfield's CDN over https", () => {
    expect(isTrustedResultUrl("https://d3u0tzju9qaucj.cloudfront.net/x.png")).toBe(true);
    expect(isTrustedResultUrl("http://d3u0tzju9qaucj.cloudfront.net/x.png")).toBe(false);
    expect(isTrustedResultUrl("https://169.254.169.254/latest")).toBe(false);
    expect(isTrustedResultUrl("https://evilcloudfront.net.example.com/x")).toBe(false);
  });

  it("refuses to share a render from an unexpected host", async () => {
    const result = await handleShare(input(), deps({ status: vi.fn(async () => ({ status: "completed", images: ["https://evil.example/x.jpg"] })) }));
    expect(result).toMatchObject({ ok: false, status: 502 });
  });
});

describe("jpegForBox", () => {
  it("turns a WebP into a JPEG data URL", async () => {
    const { default: sharp } = await import("sharp");
    const webp = await sharp({ create: { width: 40, height: 60, channels: 3, background: "#3d63a8" } }).webp().toBuffer();
    const url = await jpegForBox(webp, { width: 20, height: 30 });
    expect(url.startsWith("data:image/jpeg;base64,")).toBe(true);
  }, 30_000); // loading the image library the first time can be slow
});

describe("fetchImage", () => {
  it("fails loudly when the image can't be fetched", async () => {
    const fetcher = vi.fn(async () => new Response("nope", { status: 404 }));
    await expect(fetchImage("https://cdn/x.jpg", fetcher as unknown as typeof fetch)).rejects.toThrow();
  });
});
