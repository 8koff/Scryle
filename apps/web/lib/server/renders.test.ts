import { describe, expect, it, vi } from "vitest";
import { createMemoryRenderStore, keepRender, listRenderCards, type NewRender } from "./renders";

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
