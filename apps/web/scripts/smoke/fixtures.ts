import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { imageSize } from "image-size";
import type { HiggsfieldClient } from "../../lib/server/higgsfield/client";
import type { ImageSource } from "./cases";

export type ResolvedImage = { key: string; url: string; width: number; height: number; origin: "file" | "url" | "generated" };

/** Used only to make stand-in test photos. */
export const GENERATOR = "marketing-studio/image";

/**
 * Stand-in photos only need to look like a normal phone photo. Medium/1k is ~$0.065 each;
 * high/2k was ~$0.37 each and was most of the cost of the first P0 run.
 */
export function generationBody(source: ImageSource): Record<string, unknown> {
  return {
    prompt: source.generate.prompt,
    aspect_ratio: source.generate.aspect,
    resolution: "1k",
    quality: "medium",
    enhance_prompt: false,
  };
}

type Cache = Record<string, ResolvedImage>;

export async function createFixtureResolver(client: HiggsfieldClient, cacheFile: string, fresh: boolean) {
  const cache: Cache = !fresh && existsSync(cacheFile) ? (JSON.parse(await readFile(cacheFile, "utf8")) as Cache) : {};
  const pending = new Map<string, Promise<ResolvedImage>>();

  /** Size of an image we already have, without spending anything. Undefined if it must be generated. */
  function known(source: ImageSource): { width: number; height: number } | undefined {
    const cached = cache[source.key];
    if (cached && cached.origin !== "file") return cached;
    return undefined;
  }

  function needsGeneration(source: ImageSource): boolean {
    return !(source.file && existsSync(source.file)) && !source.url && !known(source);
  }

  async function resolveOnce(source: ImageSource): Promise<ResolvedImage> {
    if (source.file && existsSync(source.file)) {
      const bytes = await readFile(source.file);
      const url = await client.uploadBytes(bytes, contentTypeFor(source.file));
      return { key: source.key, url, ...size(bytes), origin: "file" };
    }

    const cached = cache[source.key];
    if (cached && cached.origin !== "file") return cached;

    if (source.url) {
      return { key: source.key, url: source.url, ...size(await download(source.url)), origin: "url" };
    }

    const { requestId } = await client.submit(GENERATOR, generationBody(source));
    const done = await client.waitFor(requestId);
    const url = done.images?.[0];
    if (done.status !== "completed" || !url) {
      throw new Error(`Could not generate test image "${source.key}": ${done.status} ${done.error ?? ""}`);
    }
    return { key: source.key, url, ...size(await download(url)), origin: "generated" };
  }

  return {
    needsGeneration,
    known,
    resolve(source: ImageSource): Promise<ResolvedImage> {
      const existing = pending.get(source.key);
      if (existing) return existing;
      const promise = resolveOnce(source).then(async (image) => {
        cache[source.key] = image;
        await writeFile(cacheFile, JSON.stringify(cache, null, 2));
        return image;
      });
      pending.set(source.key, promise);
      return promise;
    },
  };
}

export async function download(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed (${response.status}): ${url}`);
  return new Uint8Array(await response.arrayBuffer());
}

function size(bytes: Uint8Array): { width: number; height: number } {
  const { width, height } = imageSize(bytes);
  if (!width || !height) throw new Error("Could not read image size");
  return { width, height };
}

function contentTypeFor(file: string): string {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}
