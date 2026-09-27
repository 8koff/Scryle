import { EDIT_MODELS, type EditModelId } from "./models";

/**
 * Cheapest setting that keeps the subject unchanged: Marketing Studio at low quality, 1k.
 * Qwen 1k is the backup (flat price, but only 3 input images).
 * Grok was dropped on 2026-09-22 as too expensive (~$0.10 per render at 2k).
 */
export const DEFAULT_RENDER_MODEL: EditModelId = "marketing-low";
export const FALLBACK_RENDER_MODEL: EditModelId = "qwen-1k";

/** RENDER_MODEL env var overrides the default, e.g. RENDER_MODEL=qwen-1k. */
export function renderModelFromEnv(env: Record<string, string | undefined> = process.env): EditModelId {
  const chosen = env.RENDER_MODEL?.trim();
  if (!chosen) return DEFAULT_RENDER_MODEL;
  if (!(chosen in EDIT_MODELS)) {
    throw new Error(`RENDER_MODEL "${chosen}" is not one of: ${Object.keys(EDIT_MODELS).join(", ")}`);
  }
  return chosen as EditModelId;
}
