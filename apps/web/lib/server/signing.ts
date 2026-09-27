import { createHmac, timingSafeEqual } from "node:crypto";
import type { PackId, SceneAnalysis } from "@retrofit/core";

/**
 * What the server vouches for after a scan: this photo, in this category, with this analysis.
 * Renders must present a matching token, so nobody can render an arbitrary photo (someone
 * else's picture) or inject their own text into the edit prompt through our API.
 */
export type PhotoClaim = {
  photoUrl: string;
  pack: PackId;
  width: number;
  height: number;
  scene: SceneAnalysis;
};

/** Matches the 24h photo retention promise. */
const TTL_MS = 24 * 60 * 60 * 1000;

/** JSON with object keys sorted, so the same data always signs the same way. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function mac(claim: PhotoClaim, expiresAt: number, secret: string): string {
  if (secret.length < 32) throw new Error("RENDER_SIGNING_SECRET must be at least 32 characters");
  const payload = canonical([claim.photoUrl, claim.pack, claim.width, claim.height, claim.scene, expiresAt]);
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function signPhoto(claim: PhotoClaim, secret: string, now = Date.now()): string {
  const expiresAt = now + TTL_MS;
  return `${expiresAt}.${mac(claim, expiresAt, secret)}`;
}

export function verifyPhoto(claim: PhotoClaim, token: string, secret: string, now = Date.now()): boolean {
  const [expires, signature] = token.split(".");
  const expiresAt = Number(expires);
  if (!signature || !Number.isFinite(expiresAt) || expiresAt < now) return false;
  const expected = Buffer.from(mac(claim, expiresAt, secret));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Ties a render job to the person who started it, so job ids can't be used to fetch others' results. */
export function signJob(requestId: string, secret: string): string {
  if (secret.length < 32) throw new Error("RENDER_SIGNING_SECRET must be at least 32 characters");
  return createHmac("sha256", secret).update(`job:${requestId}`).digest("base64url");
}

export function verifyJob(requestId: string, token: string, secret: string): boolean {
  const expected = Buffer.from(signJob(requestId, secret));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function signingSecretFromEnv(env: Record<string, string | undefined> = process.env): string {
  const secret = env.RENDER_SIGNING_SECRET?.trim();
  if (!secret) throw new Error("Missing RENDER_SIGNING_SECRET");
  return secret;
}
