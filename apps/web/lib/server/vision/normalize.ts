import { SceneAnalysisSchema, type DetectedPart, type SceneAnalysis } from "@retrofit/core";
import { z } from "zod";

/**
 * The shape we ask Claude for. Kept flat and simple (no records, no refinements)
 * so it maps cleanly onto structured outputs. Corners are 0..1000 on each axis.
 */
export const VisionOutputSchema = z.object({
  subject: z.string().describe("Short description of the photo, used as a sentence subject, e.g. 'a person standing in a hallway'"),
  has_person: z
    .boolean()
    .describe(
      "True if a real person is in the photo: a face, a head, or a clothed or unclothed body, even partly or in the background. False for only hands or arms holding something, and for people in artwork, posters or screens.",
    ),
  details: z
    .array(z.object({ key: z.string(), value: z.string() }))
    .describe("Facts the user will confirm, e.g. make/model/year for a car, estimated wall width for a room"),
  parts: z.array(
    z.object({
      part_id: z.string().describe("One of the allowed part ids"),
      label: z.string().describe("What the user sees on screen, e.g. 'Front wheel', 'Grey hoodie'"),
      current: z.string().describe("What is there now, specific enough to find it, e.g. 'grey hoodie', 'silver 5-spoke wheels'"),
      x0: z.number(),
      y0: z.number(),
      x1: z.number(),
      y1: z.number(),
    }),
  ),
});

export type VisionOutput = z.infer<typeof VisionOutputSchema>;

const clamp = (n: number) => Math.min(1, Math.max(0, n / 1000));
const round = (n: number) => Math.round(n * 10000) / 10000;

/** Converts Claude's answer into our strict SceneAnalysis, cleaning up boxes and unknown parts. */
export function toSceneAnalysis(output: VisionOutput, allowedPartIds: readonly string[]): SceneAnalysis {
  const parts: DetectedPart[] = [];
  for (const p of output.parts) {
    if (allowedPartIds.length > 0 && !allowedPartIds.includes(p.part_id)) continue;
    const left = clamp(Math.min(p.x0, p.x1));
    const right = clamp(Math.max(p.x0, p.x1));
    const top = clamp(Math.min(p.y0, p.y1));
    const bottom = clamp(Math.max(p.y0, p.y1));
    if (right - left <= 0 || bottom - top <= 0) continue;
    parts.push({
      partId: p.part_id,
      label: p.label,
      current: p.current,
      box: { x: round(left), y: round(top), w: round(right - left), h: round(bottom - top) },
    });
  }

  const details = Object.fromEntries(output.details.map((d) => [d.key, d.value]));
  return SceneAnalysisSchema.parse({
    subject: output.subject,
    ...(Object.keys(details).length ? { details } : {}),
    parts,
    hasPerson: output.has_person,
  });
}
