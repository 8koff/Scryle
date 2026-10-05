import { buildRenderPlan, getPack, isPackId, MAX_SWAPS_PER_PICTURE, SceneAnalysisSchema, type Selection } from "@retrofit/core";
import { z } from "zod";
import type { ApiErrorCode, ApiResponse, RenderStart } from "@/lib/api";
import { fitsPart, type Product } from "@/lib/catalog/catalog";
import { cleanDescription, withoutSteering } from "@/lib/catalog/describe";
import type { CreditStore } from "./credits";
import { buildEditRequest, type EditModelId } from "./higgsfield/models";
import type { NewRender } from "./renders";
import { renderPending, runRenderRequest, type RenderRequestStore } from "./render-requests";
import { lookupProducts, type FindLive } from "./shop/lookup";
import { signJob, verifyPhoto, type PhotoClaim } from "./signing";
import type { SpendGuard } from "./spend";

export type RenderDeps = {
  secret: string;
  model: EditModelId;
  /** Public URL for a product image path (uploads local files once). */
  productImageUrl: (path: string) => Promise<string>;
  /** Combines several product images side by side and returns one public URL. */
  combine: (urls: string[]) => Promise<string>;
  estimate: (endpoint: string, body: Record<string, unknown>) => Promise<number>;
  submit: (endpoint: string, body: Record<string, unknown>) => Promise<string>;
  spend: SpendGuard;
  /** The signed-in user, or null. Every render costs one credit. */
  userId: string | null;
  credits: CreditStore;
  /** Saves the render to the buyer's account (see renders.ts). */
  recordRender?: (render: NewRender) => Promise<void>;
  /** Products found by store search, by id (see shop/products.ts). */
  findLive?: FindLive;
  /** Required for clients that send a durable request ID. Never fall back to memory. */
  requests?: RenderRequestStore;
};


/** The scanned photo as the browser sends it back; checked against its signature before use. */
export const ClaimSchema = z.object({
  photoUrl: z.url(),
  pack: z.string(),
  width: z.number().int().positive().max(10_000),
  height: z.number().int().positive().max(10_000),
  scene: SceneAnalysisSchema,
});

const RequestSchema = z.object({
  requestId: z.uuid().optional(),
  claim: ClaimSchema,
  token: z.string().min(1).max(200),
  selections: z
    .array(
      z.union([
        z.object({ partId: z.string().min(1).max(60), productId: z.string().min(1).max(120) }),
        z.object({ partId: z.string().min(1).max(60), text: z.string().max(200) }),
      ]),
    )
    .min(1)
    .max(MAX_SWAPS_PER_PICTURE),
});

type Result = { status: number; body: ApiResponse<RenderStart> };
const fail = (status: number, error: string, code?: ApiErrorCode): Result => ({
  status,
  body: { success: false, error, ...(code ? { code } : {}) },
});

type Resolved = { selection: Selection; imagePath?: string };

const PROMPT_TITLE_MAX = 90;

/**
 * A store's product title, made safe for the edit prompt: plain words only, cut to length.
 * Store titles are written by strangers, so they get no say in the instructions.
 */
export function promptTitle(title: string): string {
  const plain = withoutSteering(title.replace(/[^\p{L}\p{N} ,.'&%()\-/+]/gu, " "));
  if (plain.length <= PROMPT_TITLE_MAX) return plain;
  return plain.slice(0, PROMPT_TITLE_MAX).replace(/\s+\S*$/, "");
}

/** Starts one render. Every input is re-checked here: the browser is never trusted. */
export async function handleRender(input: unknown, deps: RenderDeps): Promise<Result> {
  const parsed = RequestSchema.safeParse(input);
  if (!parsed.success) return fail(400, "That request didn't look right.");
  if (parsed.data.requestId) {
    if (!deps.userId) return fail(401, "Please sign in.", "sign_in");
    if (!deps.requests) return fail(503, "Swap recovery isn't ready yet. Please try again later.", "render_unavailable");
    return runRenderRequest(deps.userId, parsed.data.requestId, parsed.data, deps.requests, () => executeRender(parsed.data, deps));
  }
  return executeRender(parsed.data, deps);
}

async function executeRender(input: z.infer<typeof RequestSchema>, deps: RenderDeps): Promise<Result> {
  const { claim: rawClaim, token, selections, requestId } = input;
  if (!isPackId(rawClaim.pack)) return fail(400, "Unknown category.");
  const claim: PhotoClaim = { ...rawClaim, pack: rawClaim.pack };
  if (!verifyPhoto(claim, token, deps.secret)) return fail(403, "This photo has expired. Please take a new one.");

  const pack = getPack(claim.pack);
  let lookup: (id: string) => Product | undefined;
  try {
    lookup = await lookupProducts(selections, deps.findLive);
  } catch (error) {
    console.error("[render] product lookup failed", error);
    return fail(502, "The picture couldn't start. Please try again. You weren't charged.");
  }
  const resolved: Resolved[] = [];
  for (const s of selections) {
    if ("productId" in s) {
      const product = lookup(s.productId);
      if (!product || !fitsPart(product, pack.id, s.partId)) return fail(400, "That product isn't available.");
      const title = product.kind === "live" ? promptTitle(product.title) : product.title;
      resolved.push({ selection: { partId: s.partId, product: { title, imageUrl: product.image } }, imagePath: product.image });
    } else {
      const described = cleanDescription(s.text, pack.id);
      if (!described.ok) return fail(400, described.reason);
      resolved.push({ selection: { partId: s.partId, product: { title: described.text } } });
    }
  }

  let plan;
  try {
    plan = buildRenderPlan(pack, claim.scene, resolved.map((r) => r.selection), { productsInOneImage: true });
  } catch (error) {
    return fail(400, (error as Error).message.includes("twice") ? "Pick one item per part." : "That part isn't in this photo.");
  }

  // Checked only after the request is known to be good, so bad requests never cost a credit.
  if (!deps.userId) return fail(401, "Sign in to get your free picture.", "sign_in");
  const entry = await deps.credits.spend(deps.userId);
  if (entry === null) return fail(402, "You're out of pictures. Pick a pack to keep going.", "no_credits");

  let reserved = 0;
  let submitting = false;
  try {
    const paths = resolved.map((r) => r.imagePath).filter((p): p is string => Boolean(p));
    const imageUrls = await Promise.all(paths.map((p) => deps.productImageUrl(p)));
    const productUrls = imageUrls.length > 1 ? [await deps.combine(imageUrls)] : imageUrls;

    const { endpoint, body } = buildEditRequest(deps.model, {
      prompt: plan.prompt,
      imageUrls: [claim.photoUrl, ...productUrls],
      width: claim.width,
      height: claim.height,
    });

    const costUsd = await deps.estimate(endpoint, body);
    if (!(await deps.spend.tryReserve(costUsd))) {
      await deps.credits.refundEntry(entry);
      return fail(503, "We've hit today's picture limit. Please try again tomorrow. You weren't charged.");
    }
    reserved = costUsd;

    submitting = true;
    const jobId = await deps.submit(endpoint, body);
    submitting = false;
    // The job is already paid for, so never fail here. Retry once; without the link a failed
    // render can't be refunded automatically.
    await deps.credits
      .attachJob(entry, jobId)
      .catch(() => deps.credits.attachJob(entry, jobId))
      .catch((error) => console.error("[render] attach job failed", { entry, jobId }, error));
    const saved: NewRender = {
      jobId,
      owner: deps.userId,
      pack: pack.id,
      width: claim.width,
      height: claim.height,
      selections,
      labels: resolved.map((r) => r.selection.product.title),
      photoUrl: claim.photoUrl,
      scene: claim.scene,
    };
    await deps.recordRender?.(saved)
      .catch(() => deps.recordRender?.(saved))
      .catch((error) => console.error("[render] record failed", jobId, error));
    return { status: 200, body: { success: true, data: { jobId, jobToken: signJob(jobId, deps.secret), costUsd, ...(requestId ? { requestId } : {}) } } };
  } catch (error) {
    if (requestId && submitting) {
      // A rejected promise does not prove the provider rejected the paid job. Keep its claim,
      // credit and reserved budget until the outcome is known; a retry must not submit again.
      console.error("[render] provider acceptance is uncertain");
      return renderPending();
    }
    if (reserved) await deps.spend.release(reserved).catch((e) => console.error("[render] spend release failed", e));
    await deps.credits.refundEntry(entry).catch((e) => console.error("[render] refund failed", entry, e));
    console.error("[render] failed to start", error);
    return fail(502, "The picture couldn't start. Please try again. You weren't charged.");
  }
}
