import type { Pack } from "../packs/types";
import type { SceneAnalysis } from "../scene/schema";
import { buildEditPrompt, type Swap } from "./prompt";

export type Selection = {
  partId: string;
  product: { title: string; imageUrl?: string };
};

export type RenderPlan = {
  prompt: string;
  /** Product reference images, in the order the prompt numbers them (image 2, 3, ...). */
  productImageUrls: string[];
};

/**
 * Turns "these parts get these products" into one edit request.
 * Untouched parts are added to the locks so the model leaves them alone.
 */
export function buildRenderPlan(
  pack: Pack,
  scene: SceneAnalysis,
  selections: readonly Selection[],
  opts: { productsInOneImage?: boolean } = {},
): RenderPlan {
  const seen = new Set<string>();
  const swaps: Swap[] = [];
  const productImageUrls: string[] = [];

  for (const { partId, product } of selections) {
    if (seen.has(partId)) throw new Error(`Part "${partId}" was selected twice`);
    seen.add(partId);

    const detected = scene.parts.find((p) => p.partId === partId);
    const def = pack.parts.find((p) => p.id === partId);
    if (!detected && !def) throw new Error(`Unknown part "${partId}" for the ${pack.label} pack`);

    const hasImage = !def?.textOnly && Boolean(product.imageUrl);
    swaps.push({ part: detected?.current ?? def!.label.toLowerCase(), product: product.title, hasImage });
    if (hasImage) productImageUrls.push(product.imageUrl!);
  }

  const untouched = scene.parts.filter((p) => !seen.has(p.partId)).map((p) => p.current);
  const locks = [...new Set([...pack.locks, ...untouched])];

  return {
    prompt: buildEditPrompt({ subject: scene.subject, swaps, locks, productsInOneImage: opts.productsInOneImage }),
    productImageUrls,
  };
}
