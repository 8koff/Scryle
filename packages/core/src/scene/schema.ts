import { z } from "zod";

const unit = z.number().min(0).max(1);

/** A rectangle in photo-relative units: 0..1 from the top-left corner. */
export const BoxSchema = z
  .object({ x: unit, y: unit, w: unit.positive(), h: unit.positive() })
  .refine((b) => b.x + b.w <= 1.001 && b.y + b.h <= 1.001, "Box must stay inside the photo");

export const DetectedPartSchema = z.object({
  /** One of the pack's part ids, e.g. "outerwear", "wheels", "sofa". */
  partId: z.string().min(1),
  /** What the user sees: "Front wheel", "Grey hoodie". */
  label: z.string().min(1),
  box: BoxSchema,
  /** What is there now, used in the edit prompt: "grey hoodie", "silver 5-spoke wheels". */
  current: z.string().min(1),
});

/** What the vision model returns after a capture. */
export const SceneAnalysisSchema = z.object({
  /** Short description used as the prompt subject: "a person standing in a hallway". */
  subject: z.string().min(1),
  /** Pack-specific facts the user confirms: make/model/year, room width, etc. */
  details: z.record(z.string(), z.string()).optional(),
  parts: z.array(DetectedPartSchema),
  /** A real person is in the photo. Only packs that allow people accept it (see Pack.capture.allowsPeople). */
  hasPerson: z.boolean().optional(),
});

export type Box = z.infer<typeof BoxSchema>;
export type DetectedPart = z.infer<typeof DetectedPartSchema>;
export type SceneAnalysis = z.infer<typeof SceneAnalysisSchema>;
