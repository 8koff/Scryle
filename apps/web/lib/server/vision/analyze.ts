import type Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { Pack, SceneAnalysis } from "@retrofit/core";
import { toSceneAnalysis, VisionOutputSchema } from "./normalize";

/** Default vision model. Override with VISION_MODEL (e.g. to trade quality for speed). */
export const DEFAULT_VISION_MODEL = "claude-opus-5-5";

export type PhotoInput = { url: string } | { base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" };

/** Only what we use from the SDK client, so tests can pass a fake. */
export type VisionClient = Pick<Anthropic, "beta">;

export class VisionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VisionError";
  }
}

const SYSTEM = `You look at one photo and find the parts a shopper could swap for a product they can buy.
For each part, give a tight box around it using corner coordinates from 0 to 1000 on each axis:
(0,0) is the top-left of the photo, (1000,1000) is the bottom-right.
Only list parts you can actually see. Give one entry per visible instance when instances are far apart
(e.g. front and rear wheel), otherwise one box around the group.
Describe the current item plainly and specifically in "current" (colour, material, style), because an image editor uses it to find the item.`;

function partInstructions(pack: Pack): string {
  if (pack.parts.length === 0) {
    return "There is no fixed part list. Choose your own part ids: short lowercase slugs like 'bike-saddle' or 'desk-lamp'. List up to 8 of the most swappable items.";
  }
  const lines = pack.parts.map((p) => `- ${p.id}: ${p.label}`).join("\n");
  return `Allowed part ids (use only these):\n${lines}`;
}

function detailInstructions(pack: Pack): string {
  switch (pack.id) {
    case "car":
      return 'In "details", give your best guess for make, model, year and colour.';
    case "room":
      return 'In "details", estimate room_type and the width of the main wall in metres (key "wall_width_m"), using doors and furniture for scale.';
    case "clothing":
      return 'In "details", give "fit" as one of men, women or unisex based on the clothes shown. Never describe the person\'s body.';
    default:
      return 'In "details", name what the main object is (key "object").';
  }
}

export function buildAnalyzeRequest(pack: Pack, photo: PhotoInput, opts: { model?: string } = {}) {
  const source =
    "url" in photo
      ? ({ type: "url", url: photo.url } as const)
      : ({ type: "base64", media_type: photo.mediaType, data: photo.base64 } as const);

  return {
    model: opts.model ?? DEFAULT_VISION_MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default" as const,
    system: SYSTEM,
    output_config: { effort: "low" as const, format: betaZodOutputFormat(VisionOutputSchema) },
    messages: [
      {
        role: "user" as const,
        content: [
          { type: "image" as const, source },
          {
            type: "text" as const,
            text: `Category: ${pack.label}.\n${partInstructions(pack)}\n${detailInstructions(pack)}`,
          },
        ],
      },
    ],
  };
}

/** Reads a photo and returns what it shows plus a box for every swappable part. */
export async function analyzeScene(
  client: VisionClient,
  pack: Pack,
  photo: PhotoInput,
  opts: { model?: string } = {},
): Promise<SceneAnalysis> {
  const response = await client.beta.messages.parse(buildAnalyzeRequest(pack, photo, opts));

  if (response.stop_reason === "refusal") {
    throw new VisionError("The photo could not be analysed. Try a different photo.");
  }
  if (!response.parsed_output) {
    throw new VisionError(`Could not read the photo analysis (stop reason: ${response.stop_reason ?? "unknown"}).`);
  }
  return toSceneAnalysis(response.parsed_output, pack.parts.map((p) => p.id));
}
