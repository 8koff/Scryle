import { describe, expect, it } from "vitest";
import { buildEditRequest, EDIT_MODELS, type EditModelId } from "./models";

const input = {
  prompt: "Replace the jacket",
  imageUrls: ["https://cdn/scene.jpg", "https://cdn/jacket.jpg"],
  width: 1080,
  height: 1920,
};

describe("edit model registry", () => {
  it("builds a cheap Marketing Studio request: low quality, 1k, no prompt rewriting", () => {
    const { endpoint, body } = buildEditRequest("marketing-low", input);

    expect(endpoint).toBe("marketing-studio/image");
    expect(body).toMatchObject({ quality: "low", resolution: "1k", enhance_prompt: false, aspect_ratio: "9:16" });
    expect(body.image_urls).toEqual(input.imageUrls);
    expect(body.prompt).toBe(input.prompt);
  });

  it("builds a Qwen 1k request with the scene first", () => {
    const { endpoint, body } = buildEditRequest("qwen-1k", input);

    expect(endpoint).toBe("alibaba/qwen-image-3/edit");
    expect(body).toMatchObject({ resolution: "1k", prompt_extend: false, aspect_ratio: "9:16" });
  });

  it("has no expensive settings left in the list", () => {
    for (const id of Object.keys(EDIT_MODELS) as EditModelId[]) {
      const extra: Record<string, unknown> = EDIT_MODELS[id].extra;
      expect(extra.quality === undefined || extra.quality === "low").toBe(true);
      expect(EDIT_MODELS[id].endpoint).not.toContain("grok");
    }
  });

  it("rejects more images than the model accepts", () => {
    const tooMany = { ...input, imageUrls: ["a", "b", "c", "d"] };
    expect(() => buildEditRequest("qwen-1k", tooMany)).toThrow(/at most 3/);
  });

  it("rejects an empty image list", () => {
    expect(() => buildEditRequest("marketing-low", { ...input, imageUrls: [] })).toThrow(/at least one image/i);
  });
});
