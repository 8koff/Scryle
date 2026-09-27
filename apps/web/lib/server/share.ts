import { isPackId, SceneAnalysisSchema } from "@retrofit/core";
import { z } from "zod";
import { verifyJob, verifyPhoto, type PhotoClaim } from "./signing";

/** Instagram portrait (4:5). */
export const SHARE_SIZE = { width: 1080, height: 1350 } as const;

const PAD = 48;
const GAP = 16;
const FOOTER = 136;
/** In the staggered layout the "before" photo is this much smaller than the "after". */
const BEFORE_SCALE = 0.72;

export type Box = { x: number; y: number; width: number; height: number };

export type ShareLayout = {
  /** Tall photos overlap, with "after" bigger and in front; wide ones (cars, rooms) stack. */
  mode: "stagger" | "stack";
  /** The photo area, inside the padding and above the footer. */
  area: { width: number; height: number };
  before: Box;
  after: Box;
  pad: number;
  footer: number;
};

const fit = (maxW: number, maxH: number, aspect: number) => {
  const width = Math.floor(Math.min(maxW, maxH * aspect));
  return { width, height: Math.floor(width / aspect) };
};

/** Where the two photos go on the 1080×1350 card. Both always fit inside the photo area. */
export function shareLayout(aspect: number): ShareLayout {
  const area = { width: SHARE_SIZE.width - PAD * 2, height: SHARE_SIZE.height - PAD * 2 - FOOTER };

  if (aspect >= 1) {
    const size = fit(area.width, (area.height - GAP) / 2, aspect);
    const x = Math.floor((area.width - size.width) / 2);
    return {
      mode: "stack",
      area,
      before: { x, y: 0, ...size },
      after: { x, y: size.height + GAP, ...size },
      pad: PAD,
      footer: FOOTER,
    };
  }

  // "After" fills most of the height at the bottom right; "before" tucks in at the top left.
  const after = fit(area.width * 0.64, area.height, aspect);
  const before = fit(after.width * BEFORE_SCALE, after.height * BEFORE_SCALE, aspect);
  return {
    mode: "stagger",
    area,
    before: { x: 0, y: 0, ...before },
    after: { x: area.width - after.width, y: area.height - after.height, ...after },
    pad: PAD,
    footer: FOOTER,
  };
}

export type ShareDeps = {
  secret: string;
  status: (jobId: string) => Promise<{ status: string; images?: string[] }>;
};

const RequestSchema = z.object({
  claim: z.object({
    photoUrl: z.url(),
    pack: z.string(),
    width: z.number().int().positive().max(10_000),
    height: z.number().int().positive().max(10_000),
    scene: SceneAnalysisSchema,
  }),
  token: z.string().min(1).max(200),
  jobId: z.string().regex(/^[a-zA-Z0-9-]{8,80}$/),
  jobToken: z.string().min(1).max(200),
});

/** Higgsfield serves results from CloudFront. Never fetch anything else on its behalf. */
const RESULT_HOSTS = [".cloudfront.net", ".higgsfield.ai"];

export function isTrustedResultUrl(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === "https:" && RESULT_HOSTS.some((h) => hostname.endsWith(h));
  } catch {
    return false;
  }
}

type Result = { ok: true; beforeUrl: string; afterUrl: string; aspect: number } | { ok: false; status: number; error: string };

/**
 * Checks a share request. Both images come from places the server vouches for (the signed
 * photo and Higgsfield's own answer), so this can't be used to put any picture on our card.
 */
export async function handleShare(input: unknown, deps: ShareDeps): Promise<Result> {
  const parsed = RequestSchema.safeParse(input);
  if (!parsed.success || !isPackId(parsed.data.claim.pack)) return { ok: false, status: 400, error: "That request didn't look right." };
  const { claim: raw, token, jobId, jobToken } = parsed.data;
  const claim: PhotoClaim = { ...raw, pack: raw.pack as PhotoClaim["pack"] };

  if (!verifyPhoto(claim, token, deps.secret) || !verifyJob(jobId, jobToken, deps.secret)) {
    return { ok: false, status: 403, error: "This photo has expired. Take a new one to share." };
  }

  const job = await deps.status(jobId);
  const afterUrl = job.images?.[0];
  if (job.status !== "completed" || !afterUrl) return { ok: false, status: 409, error: "That swap isn't finished." };
  if (!isTrustedResultUrl(afterUrl)) {
    console.error("[share] unexpected result host", afterUrl);
    return { ok: false, status: 502, error: "Couldn't load the swap." };
  }

  return { ok: true, beforeUrl: claim.photoUrl, afterUrl, aspect: claim.width / claim.height };
}

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15_000;
/** Longest side of the photos we keep for a share link. */
const STORED_MAX_PX = 1600;

/** Stops "decompression bombs": tiny files that expand to huge images. */
const MAX_INPUT_PIXELS = 50_000_000;

/** Downloads one of the trusted images (signed photo, Higgsfield result). */
export async function fetchImage(url: string, fetcher: typeof fetch = fetch): Promise<Buffer> {
  const response = await fetcher(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`[share] image fetch failed (${response.status})`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_IMAGE_BYTES) throw new Error("[share] image too large");
  return bytes;
}

const load = async (bytes: Buffer) => {
  const { default: sharp } = await import("sharp");
  return sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS }).rotate();
};

/**
 * An image as a JPEG data URL sized for its box on the card. The card renderer can't read
 * WebP, and smaller images draw faster.
 */
export async function jpegForBox(bytes: Buffer, box: { width: number; height: number }): Promise<string> {
  const jpeg = await (await load(bytes)).resize(box.width * 2, box.height * 2, { fit: "cover" }).jpeg({ quality: 86 }).toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}

/** An image as a JPEG to keep for a share link (no bigger than 1600 px on the long side). */
export async function jpegToKeep(bytes: Buffer): Promise<Buffer> {
  return (await load(bytes))
    .resize(STORED_MAX_PX, STORED_MAX_PX, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toBuffer();
}
