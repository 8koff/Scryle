import { readFile } from "node:fs/promises";
import path from "node:path";
import { isTrustedImage } from "@/lib/shop/live";
import type { HiggsfieldClient } from "./higgsfield/client";
import { combineProducts } from "./render/collage";

const PUBLIC_DIR = path.join(process.cwd(), "public");
const CONTENT_TYPES: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
const IMAGE_TYPES = new Set(Object.values(CONTENT_TYPES));
const MAX_REMOTE_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15_000;

/**
 * Gets product images to a place Higgsfield can read. Local catalog images (/demo/...) and
 * store-search photos are uploaded once per server and the public URL is reused.
 */
export function createRenderAssets(client: HiggsfieldClient) {
  const uploaded = new Map<string, Promise<string>>();

  /** Copies a store-search photo to Higgsfield, so the render never depends on Google serving it. */
  async function copyRemote(url: string): Promise<string> {
    const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), redirect: "error" });
    const type = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
    if (!response.ok || !IMAGE_TYPES.has(type)) throw new Error(`Could not fetch product image (${response.status}, ${type || "no type"})`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_REMOTE_BYTES) throw new Error("Product image is too large");
    return client.uploadBytes(bytes, type);
  }

  /** Each image is uploaded once per server; a failed upload is tried again next time. */
  const once = (key: string, upload: () => Promise<string>): Promise<string> => {
    let url = uploaded.get(key);
    if (!url) {
      url = upload().catch((error: unknown) => {
        uploaded.delete(key);
        throw error;
      });
      uploaded.set(key, url);
    }
    return url;
  };

  async function uploadLocal(publicPath: string): Promise<string> {
    const resolved = path.resolve(PUBLIC_DIR, `.${publicPath}`);
    if (!resolved.startsWith(PUBLIC_DIR + path.sep)) throw new Error(`Refusing to read outside public/: ${publicPath}`);
    const type = CONTENT_TYPES[path.extname(resolved).toLowerCase()];
    if (!type) throw new Error(`Unsupported product image type: ${publicPath}`);
    return client.uploadBytes(await readFile(resolved), type);
  }

  return {
    productImageUrl(image: string): Promise<string> {
      if (isTrustedImage(image)) return once(image, () => copyRemote(image));
      if (/^https:\/\//.test(image)) return Promise.resolve(image);
      return once(image, () => uploadLocal(image));
    },

    async combine(urls: string[]): Promise<string> {
      const images = await Promise.all(
        urls.map(async (url) => {
          const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
          if (!response.ok) throw new Error(`Could not fetch product image (${response.status})`);
          return new Uint8Array(await response.arrayBuffer());
        }),
      );
      return client.uploadBytes(await combineProducts(images), "image/jpeg");
    },
  };
}
