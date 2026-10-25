import { describe, expect, it, vi } from "vitest";
import { backfillThumbs, createMemoryRenderStore, keepRender, listRenderCards, THUMB_BACKFILL_LIMIT, type NewRender } from "./renders";

const render = (over: Partial<NewRender> = {}): NewRender => ({
  jobId: "job-1",
  owner: "u1",
  pack: "room",
  width: 1200,
  height: 900,
  selections: [{ partId: "sofa", productId: "room-sofa-1" }],
  labels: ["Cream boucle sofa"],
  photoUrl: "https://d1.cloudfront.net/photo.jpg",
  scene: { subject: "a living room", parts: [{ partId: "sofa", label: "Sofa", current: "grey sofa", box: { x: 0.1, y: 0.5, w: 0.5, h: 0.3 } }] },
  ...over,
});

const RESULT = "https://d1.cloudfront.net/result.png";

function deps() {
  const renders = createMemoryRenderStore();
  const fetchImage = vi.fn(async (url: string) => Buffer.from(url));
  const keep = vi.fn(async (bytes: Buffer) => Buffer.concat([Buffer.from("jpeg:"), bytes]));
  return { renders, fetchImage, keep };
}

describe("keepRender", () => {
  it("copies the photo and the result into the owner's storage", async () => {
    const d = deps();
    await d.renders.record(render());
    expect(await keepRender("job-1", RESULT, d)).toBe("kept");
    expect(d.renders.files.get("u1/job-1/before.jpg")?.toString()).toBe("jpeg:https://d1.cloudfront.net/photo.jpg");
    expect(d.renders.files.get("u1/job-1/after.jpg")?.toString()).toBe(`jpeg:${RESULT}`);
    expect((await d.renders.get("job-1"))?.keptAt).not.toBeNull();
  });

  it("does the work once", async () => {
    const d = deps();
    await d.renders.record(render());
    await keepRender("job-1", RESULT, d);
    expect(await keepRender("job-1", RESULT, d)).toBe("already");
    expect(d.fetchImage).toHaveBeenCalledTimes(2);
  });

  it("ignores renders it never recorded", async () => {
    const d = deps();
    expect(await keepRender("nope", RESULT, d)).toBe("unknown");
    expect(d.fetchImage).not.toHaveBeenCalled();
  });

  it("never downloads from a host that isn't Higgsfield's", async () => {
    const d = deps();
    await d.renders.record(render({ photoUrl: "https://169.254.169.254/latest" }));
    await expect(keepRender("job-1", RESULT, d)).rejects.toThrow(/untrusted/);
    await d.renders.record(render({ jobId: "job-2" }));
    await expect(keepRender("job-2", "https://evil.example/x.png", d)).rejects.toThrow(/untrusted/);
    expect(d.fetchImage).not.toHaveBeenCalled();
  });

  it("stores a small preview of the result when it can make one", async () => {
    const d = deps();
    await d.renders.record(render());
    await keepRender("job-1", RESULT, { ...d, thumb: async (bytes) => Buffer.concat([Buffer.from("thumb:"), bytes]) });
    expect(d.renders.files.get("u1/job-1/thumb.jpg")?.toString()).toBe(`thumb:jpeg:${RESULT}`);
  });

  it("still keeps the render when the preview fails", async () => {
    const d = deps();
    vi.spyOn(console, "error").mockImplementation(() => {});
    await d.renders.record(render());
    expect(await keepRender("job-1", RESULT, { ...d, thumb: async () => Promise.reject(new Error("bad image")) })).toBe("kept");
    expect(d.renders.files.has("u1/job-1/thumb.jpg")).toBe(false);
    expect((await d.renders.get("job-1"))?.keptAt).not.toBeNull();
  });

  it("stays unkept when storage fails, so the sweep tries again", async () => {
    const d = deps();
    await d.renders.record(render());
    d.renders.upload = vi.fn(async () => Promise.reject(new Error("storage down")));
    await expect(keepRender("job-1", RESULT, d)).rejects.toThrow("storage down");
    expect((await d.renders.get("job-1"))?.keptAt).toBeNull();
  });
});

describe("listRenderCards", () => {
  it("lists only the owner's kept renders, newest first, with links to both pictures", async () => {
    const d = deps();
    await d.renders.record(render({ jobId: "old" }));
    await d.renders.record(render({ jobId: "new" }));
    await d.renders.record(render({ jobId: "running" }));
    await d.renders.record(render({ jobId: "theirs", owner: "u2" }));
    for (const id of ["old", "new", "theirs"]) await keepRender(id, RESULT, d);

    const cards = await listRenderCards("u1", d.renders);
    expect(cards.map((c) => c.jobId)).toEqual(["new", "old"]);
    expect(cards[0]).toMatchObject({
      pack: "room",
      labels: ["Cream boucle sofa"],
      beforeUrl: "https://storage.test/u1/new/before.jpg",
      afterUrl: "https://storage.test/u1/new/after.jpg",
    });
  });
});

describe("render previews in the list", () => {
  it("links the preview when there is one, and \"\" when there isn't yet", async () => {
    const d = deps();
    await d.renders.record(render({ jobId: "with" }));
    await d.renders.record(render({ jobId: "without" }));
    await keepRender("with", RESULT, { ...d, thumb: async (b) => b });
    await keepRender("without", RESULT, d);

    const cards = await listRenderCards("u1", d.renders);
    expect(cards.find((c) => c.jobId === "with")?.thumbUrl).toBe("https://storage.test/u1/with/thumb.jpg");
    expect(cards.find((c) => c.jobId === "without")?.thumbUrl).toBe("");
  });

  it("still lists the renders when preview links fail", async () => {
    const d = deps();
    vi.spyOn(console, "error").mockImplementation(() => {});
    await d.renders.record(render());
    await keepRender("job-1", RESULT, d);
    const realUrls = d.renders.fileUrls;
    d.renders.fileUrls = vi.fn(async (files) => (files[0]?.file === "thumb" ? Promise.reject(new Error("down")) : realUrls(files, 60)));

    const cards = await listRenderCards("u1", d.renders);
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ afterUrl: "https://storage.test/u1/job-1/after.jpg", thumbUrl: "" });
  });
});

describe("backfillThumbs", () => {
  async function keptRenders(ids: string[], owner = "u1") {
    const d = deps();
    for (const jobId of ids) {
      await d.renders.record(render({ jobId, owner }));
      await keepRender(jobId, RESULT, d);
    }
    return d;
  }
  const thumb = vi.fn(async (bytes: Buffer) => Buffer.concat([Buffer.from("thumb:"), bytes]));

  it("makes the missing previews from the kept after picture", async () => {
    const d = await keptRenders(["a", "b"]);

    expect(await backfillThumbs("u1", ["a", "b"], { renders: d.renders, thumb })).toBe(2);
    expect(d.renders.files.get("u1/a/thumb.jpg")?.toString()).toBe(`thumb:jpeg:${RESULT}`);
  });

  it("never touches another person's render or one that isn't kept", async () => {
    const d = await keptRenders(["theirs"], "u2");
    await d.renders.record(render({ jobId: "running" }));

    expect(await backfillThumbs("u1", ["theirs", "running", "unknown"], { renders: d.renders, thumb })).toBe(0);
    expect(d.renders.files.has("u2/theirs/thumb.jpg")).toBe(false);
  });

  it("does a few per call and keeps going past a broken one", async () => {
    const ids = Array.from({ length: THUMB_BACKFILL_LIMIT + 2 }, (_, i) => `job-${i}`);
    const d = await keptRenders(ids);
    vi.spyOn(console, "error").mockImplementation(() => {});
    d.renders.files.delete("u1/job-0/after.jpg");

    expect(await backfillThumbs("u1", ids, { renders: d.renders, thumb })).toBe(THUMB_BACKFILL_LIMIT - 1);
    expect(d.renders.files.has(`u1/job-${THUMB_BACKFILL_LIMIT}/thumb.jpg`)).toBe(false);
  });
});
