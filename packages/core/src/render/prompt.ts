export type Swap = {
  /** What is being replaced, in plain words: "jacket", "wheels", "wall colour". */
  part: string;
  /** What it becomes: a product title or a short description. */
  product: string;
  /** False when the swap is described in words only (e.g. a paint colour). Default true. */
  hasImage?: boolean;
};

export type EditPromptInput = {
  /** Short description of the original photo: "a person standing in a hallway". */
  subject: string;
  swaps: readonly Swap[];
  /** Things that must stay exactly as they are: "face", "body shape", "background". */
  locks: readonly string[];
  /**
   * All product photos are combined side by side into one image (image 2), left to right in
   * swap order. Each extra image costs money, so this keeps multi-item renders cheap.
   */
  productsInOneImage?: boolean;
};

const STYLE_RULES =
  "Keep the same camera angle, the same lighting, the same framing and the same background. " +
  "The result must be a photorealistic photo, not an illustration.";

/**
 * Builds the edit instruction for an image model that takes ordered reference images.
 * Image 1 is always the original photo. Product images follow in swap order,
 * skipping swaps that have no image.
 */
export function buildEditPrompt({ subject, swaps, locks, productsInOneImage = false }: EditPromptInput): string {
  if (swaps.length === 0) throw new Error("buildEditPrompt needs at least one swap");

  const imageCount = swaps.filter((s) => s.hasImage !== false).length;
  const combined = productsInOneImage && imageCount > 1;

  let next = combined ? 1 : 2;
  const instructions = swaps.map((swap) => {
    if (swap.hasImage === false) return `Change the ${swap.part} to ${swap.product}.`;
    const line = combined
      ? `Replace the ${swap.part} with product ${next} in image 2 (${swap.product}).`
      : `Replace the ${swap.part} with the ${swap.product} shown in image ${next}.`;
    next += 1;
    return line;
  });

  const lines = [
    `Image 1 is the original photo of ${subject}. Edit image 1.`,
    combined ? `Image 2 shows ${imageCount} products side by side, numbered 1 to ${imageCount} from left to right.` : "",
    ...instructions,
    "Match each product exactly: same shape, colour, material and details as its reference.",
    "Change only what is listed above. Everything else stays identical to image 1.",
    locks.length ? `Do not change: ${locks.join(", ")}.` : "",
    STYLE_RULES,
  ];

  return lines.filter(Boolean).join("\n");
}
