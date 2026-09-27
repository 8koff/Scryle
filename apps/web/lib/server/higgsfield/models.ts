import { nearestAspectRatio } from "@retrofit/core";

/**
 * Image edit models we can route a swap to. Each takes ordered reference images:
 * the user's photo first, then product images.
 *
 * Only cheap settings live here. Prices from Higgsfield's estimate call (2026-09-22,
 * after the 15% signup discount): Marketing Studio low/1k is ~$0.019 base + ~$0.009 per
 * input image + a little for prompt length. Never trust published per-image rates:
 * price real requests with client.estimate(). Grok and 2k/high settings were dropped as too expensive.
 */

export type EditInput = {
  prompt: string;
  /** Scene photo first, then product images. Public URLs. */
  imageUrls: readonly string[];
  /** Size of the scene photo, used to keep its shape. */
  width: number;
  height: number;
};

type EditModel = {
  label: string;
  endpoint: string;
  maxImages: number;
  aspectRatios: readonly string[];
  extra: Record<string, unknown>;
};

const MARKETING_RATIOS = ["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16", "21:9"];
const QWEN_RATIOS = ["1:1", "2:3", "3:2", "3:4", "4:3", "7:9", "9:7", "9:16", "16:9", "21:9"];

export const EDIT_MODELS = {
  "marketing-low": {
    label: "Marketing Studio · low · 1k",
    endpoint: "marketing-studio/image",
    maxImages: 16,
    aspectRatios: MARKETING_RATIOS,
    extra: { quality: "low", resolution: "1k", enhance_prompt: false }, // ~$0.028-0.031 with 1 product
  },
  "marketing-low-2k": {
    label: "Marketing Studio · low · 2k",
    endpoint: "marketing-studio/image",
    maxImages: 16,
    aspectRatios: MARKETING_RATIOS,
    extra: { quality: "low", resolution: "2k", enhance_prompt: false }, // ~$0.032
  },
  "qwen-1k": {
    label: "Qwen Image 3 Edit · 1k",
    endpoint: "alibaba/qwen-image-3/edit",
    maxImages: 3,
    aspectRatios: QWEN_RATIOS,
    // Our prompt is precise; don't let the model rewrite it.
    extra: { resolution: "1k", prompt_extend: false, enable_thinking: false }, // ~$0.040 flat
  },
} as const satisfies Record<string, EditModel>;

export type EditModelId = keyof typeof EDIT_MODELS;

export function buildEditRequest(
  id: EditModelId,
  input: EditInput,
): { endpoint: string; body: Record<string, unknown> } {
  const model: EditModel = EDIT_MODELS[id];
  if (input.imageUrls.length === 0) throw new Error("An edit needs at least one image (the scene photo)");
  if (input.imageUrls.length > model.maxImages) {
    throw new Error(`${model.label} takes at most ${model.maxImages} images, got ${input.imageUrls.length}`);
  }

  return {
    endpoint: model.endpoint,
    body: {
      prompt: input.prompt,
      image_urls: [...input.imageUrls],
      aspect_ratio: nearestAspectRatio(input.width, input.height, model.aspectRatios),
      ...model.extra,
    },
  };
}
