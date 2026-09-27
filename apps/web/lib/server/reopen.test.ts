import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import { createMemoryRenderStore, keepRender, type NewRender } from "./renders";
import { handleReopen } from "./reopen";

const scene = { subject: "a living room", parts: [{ partId: "sofa", label: "Sofa", current: "grey sofa", box: { x: 0.1, y: 0.5, w: 0.5, h: 0.3 } }] };
const render = (over: Partial<NewRender> = {}): NewRender => ({
  jobId: "job-1",
  owner: "u1",
  pack: "room",
  width: 1200,
  height: 900,
  selections: [{ partId: "sofa", text: "green velvet sofa" }],
  labels: ["green velvet sofa"],
  photoUrl: "https://d1.cloudfront.net/photo.jpg",
  scene,
  ...over,
});

async function setup(over: Partial<NewRender> = {}, keep = true) {
  const renders = createMemoryRenderStore();
  await renders.record(render(over));
  if (keep) {
    const jpeg = await sharp({ create: { width: 640, height: 480, channels: 3, background: "#888" } }).jpeg().toBuffer();
    await keepRender("job-1", "https://d1.cloudfront.net/after.png", { renders, fetchImage: async () => jpeg, keep: async (b) => b });
  }
  const upload = vi.fn(async () => "https://d1.cloudfront.net/fresh.jpg");
  const sign = vi.fn(() => "signed-token");
  return { renders, upload, sign };
}

describe("handleReopen", () => {
  it("opens the stored photo again with a fresh signature and the same swaps", async () => {
    const { renders, upload, sign } = await setup();
    const result = await handleReopen("job-1", { userId: "u1", renders, upload, sign });
    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      success: true,
      data: {
        pack: "room",
        photoUrl: "https://d1.cloudfront.net/fresh.jpg",
        width: 640,
        height: 480,
        scene,
        token: "signed-token",
        selections: [{ partId: "sofa", text: "green velvet sofa" }],
      },
    });
    expect(sign).toHaveBeenCalledWith({ photoUrl: "https://d1.cloudfront.net/fresh.jpg", pack: "room", width: 640, height: 480, scene });
  });

  it("only opens renders in your own account", async () => {
    const { renders, upload, sign } = await setup();
    expect((await handleReopen("job-1", { userId: "someone-else", renders, upload, sign })).status).toBe(404);
    expect((await handleReopen("nope", { userId: "u1", renders, upload, sign })).status).toBe(404);
    expect(upload).not.toHaveBeenCalled();
  });

  it("refuses renders that aren't saved yet or have no part map", async () => {
    const notKept = await setup({}, false);
    expect((await handleReopen("job-1", { userId: "u1", ...notKept })).status).toBe(409);
    const noScene = await setup({ scene: null });
    expect((await handleReopen("job-1", { userId: "u1", ...noScene })).status).toBe(409);
  });
});
