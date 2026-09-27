import { describe, expect, it, vi } from "vitest";
import { checkSelections, createMemoryShareStore, handleCreateShare, newShareId, SHARE_ID, type CreateShareDeps } from "./shares";
import { signJob, signPhoto, type PhotoClaim } from "./signing";

const SECRET = "shares-test-secret-with-enough-length!";

const claim: PhotoClaim = {
  photoUrl: "https://cdn/person.jpg",
  pack: "clothing",
  width: 1080,
  height: 1440,
  scene: { subject: "a person", parts: [] },
};

const input = (overrides: Record<string, unknown> = {}) => ({
  claim,
  token: signPhoto(claim, SECRET),
  jobId: "job-12345678",
  jobToken: signJob("job-12345678", SECRET),
  selections: [{ partId: "outerwear", productId: "sample-bomber" }],
  ...overrides,
});

const deps = (overrides: Partial<CreateShareDeps> = {}): CreateShareDeps => ({
  secret: SECRET,
  status: vi.fn(async () => ({ status: "completed", images: ["https://d1.cloudfront.net/after.jpg"] })),
  userId: "u1",
  shares: createMemoryShareStore(),
  jobOwner: vi.fn(async () => "u1"),
  fetchImage: vi.fn(async (url: string) => Buffer.from(url)),
  keep: vi.fn(async (bytes: Buffer) => bytes),
  card: vi.fn(async () => Buffer.from("png")),
  newId: () => "abcdefgh23",
  ...overrides,
});

describe("newShareId", () => {
  it("makes 10-character ids that don't repeat", () => {
    const ids = new Set(Array.from({ length: 200 }, newShareId));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id).toMatch(SHARE_ID);
  });
});

describe("checkSelections", () => {
  it("keeps catalog products with their real titles and drops unknown ones", () => {
    const result = checkSelections("clothing", [
      { partId: "outerwear", productId: "sample-bomber" },
      { partId: "outerwear", productId: "made-up" },
    ]);
    expect(result.selections).toEqual([{ partId: "outerwear", productId: "sample-bomber" }]);
    expect(result.labels).toEqual(["Black leather bomber jacket"]);
  });

  it("keeps store-search products found by the lookup", () => {
    const id = `live-${"d".repeat(20)}`;
    const found = { id, pack: "room" as const, part: "rug", kind: "live" as const, title: "Jute rug", priceCents: 5000, store: "IKEA" };
    const result = checkSelections("room", [{ partId: "rug", productId: id }], (x) => (x === id ? found : undefined));
    expect(result.labels).toEqual(["Jute rug"]);
  });

  it("drops free text for clothing but keeps cleaned text elsewhere", () => {
    expect(checkSelections("clothing", [{ partId: "outerwear", text: "red jacket" }]).labels).toEqual([]);
    expect(checkSelections("room", [{ partId: "rug", text: "round jute rug" }]).labels).toEqual(["round jute rug"]);
  });
});

describe("handleCreateShare", () => {
  it("keeps both photos and saves the link for the signed-in owner", async () => {
    const d = deps();
    const result = await handleCreateShare(input(), d);
    expect(result).toEqual({ status: 200, body: { success: true, data: { id: "abcdefgh23" } } });
    const saved = await d.shares.get("abcdefgh23");
    expect(saved).toMatchObject({ owner: "u1", jobId: "job-12345678", pack: "clothing", labels: ["Black leather bomber jacket"] });
    expect(d.fetchImage).toHaveBeenCalledWith("https://cdn/person.jpg");
    expect(d.fetchImage).toHaveBeenCalledWith("https://d1.cloudfront.net/after.jpg");
    const shares = d.shares as ReturnType<typeof createMemoryShareStore>;
    expect([...shares.photos.keys()].sort()).toEqual(["abcdefgh23/after", "abcdefgh23/before", "abcdefgh23/card"]);
  });

  it("returns the same link when asked twice for one render", async () => {
    const d = deps();
    await handleCreateShare(input(), d);
    const again = await handleCreateShare(input(), { ...d, newId: () => "zzzzzzzzzz" });
    expect(again.body).toEqual({ success: true, data: { id: "abcdefgh23" } });
  });

  it("asks a signed-out visitor to sign in", async () => {
    const result = await handleCreateShare(input(), deps({ userId: null }));
    expect(result).toMatchObject({ status: 401, body: { code: "sign_in" } });
  });

  it("refuses unsigned photos and unfinished renders, without keeping anything", async () => {
    const d = deps();
    expect((await handleCreateShare(input({ token: "1.bad" }), d)).status).toBe(403);
    const unfinished = deps({ status: vi.fn(async () => ({ status: "in_progress" })) });
    expect((await handleCreateShare(input(), unfinished)).status).toBe(409);
    expect(d.fetchImage).not.toHaveBeenCalled();
  });

  it("only lets the account that paid for the render publish it", async () => {
    const d = deps({ userId: "u2" });
    expect((await handleCreateShare(input(), d)).status).toBe(403);
    expect(await d.shares.findByJob("job-12345678")).toBeNull();
  });

  it("removes the half-made link when the photos can't be kept", async () => {
    const d = deps({ fetchImage: vi.fn(async () => Promise.reject(new Error("expired"))) });
    await expect(handleCreateShare(input(), d)).rejects.toThrow();
    expect(await d.shares.get("abcdefgh23")).toBeNull();
  });
});

describe("memory share store", () => {
  it("lets only the owner delete a link", async () => {
    const store = createMemoryShareStore();
    await store.insert({ id: "abcdefgh23", owner: "u1", jobId: "j", pack: "room", width: 1, height: 1, selections: [], labels: [] });
    expect(await store.remove("abcdefgh23", "u2")).toBe(false);
    expect(await store.remove("abcdefgh23", "u1")).toBe(true);
    expect(await store.get("abcdefgh23")).toBeNull();
  });
});
