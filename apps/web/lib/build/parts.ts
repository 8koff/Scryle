import type { Box, Pack, SceneAnalysis } from "@retrofit/core";

export type StudioPart = { id: string; label: string; boxes: Box[] };

/**
 * The parts the studio offers: everything the photo reader found (one entry per part, all its
 * boxes), then colour-only parts (paint, tint, wall colour) even if they weren't boxed.
 */
export function studioParts(pack: Pack, scene: SceneAnalysis): StudioPart[] {
  const byId = new Map<string, StudioPart>();
  for (const detected of scene.parts) {
    const existing = byId.get(detected.partId);
    if (existing) {
      existing.boxes.push(detected.box);
      continue;
    }
    const def = pack.parts.find((p) => p.id === detected.partId);
    byId.set(detected.partId, { id: detected.partId, label: def?.label ?? detected.label, boxes: [detected.box] });
  }
  for (const def of pack.parts) {
    if (def.textOnly && !byId.has(def.id)) byId.set(def.id, { id: def.id, label: def.label, boxes: [] });
  }
  return [...byId.values()];
}
