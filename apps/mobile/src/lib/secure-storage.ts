/**
 * Supabase keeps its session through this. Values go in the iOS Keychain (SecureStore), split
 * into chunks because SecureStore warns above 2 KB and a session can be bigger.
 */
export type KeyValueStore = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

export const CHUNK_SIZE = 1800;
/** A session is a few KB; this is far above that and stops a bad count from looping for long. */
const MAX_CHUNKS = 64;

/** SecureStore keys allow only letters, numbers, ".", "-" and "_". */
const safeKey = (key: string) => key.replace(/[^\w.-]/g, "_");

/** Which of two chunk sets is live, and how many chunks it has. */
type Meta = { gen: 0 | 1; count: number };

export function createChunkedStorage(store: KeyValueStore) {
  const metaKey = (key: string) => `${safeKey(key)}.meta`;
  const partKey = (key: string, gen: number, i: number) => `${safeKey(key)}.${gen}.${i}`;

  const readMeta = async (key: string): Promise<Meta | null> => {
    const match = /^([01]):(\d+)$/.exec((await store.getItemAsync(metaKey(key))) ?? "");
    const count = Number(match?.[2]);
    if (!match || count < 1 || count > MAX_CHUNKS) return null;
    return { gen: match[1] === "1" ? 1 : 0, count };
  };

  const deleteParts = (key: string, meta: Meta) =>
    Promise.all(Array.from({ length: meta.count }, (_, i) => store.deleteItemAsync(partKey(key, meta.gen, i))));

  return {
    async getItem(key: string): Promise<string | null> {
      const meta = await readMeta(key);
      if (!meta) return null;
      const parts = await Promise.all(
        Array.from({ length: meta.count }, (_, i) => store.getItemAsync(partKey(key, meta.gen, i))),
      );
      // A missing part means a broken session: better signed out than a bad token.
      return parts.every((p) => p !== null) ? parts.join("") : null;
    },

    /**
     * Writes the new chunks next to the old ones, then switches the meta key to them, then
     * deletes the old ones. If the app is killed halfway, one whole session is still readable
     * (Supabase's new refresh token lives only here, so losing it signs the person out).
     */
    async setItem(key: string, value: string): Promise<void> {
      const parts: string[] = [];
      for (let i = 0; i < value.length; i += CHUNK_SIZE) parts.push(value.slice(i, i + CHUNK_SIZE));
      if (!parts.length) parts.push("");
      if (parts.length > MAX_CHUNKS) throw new Error("Session too large to store.");
      const old = await readMeta(key);
      const gen = old?.gen === 0 ? 1 : 0;
      await Promise.all(parts.map((part, i) => store.setItemAsync(partKey(key, gen, i), part)));
      await store.setItemAsync(metaKey(key), `${gen}:${parts.length}`);
      if (old) await deleteParts(key, old);
    },

    async removeItem(key: string): Promise<void> {
      const old = await readMeta(key);
      await store.deleteItemAsync(metaKey(key));
      if (old) await deleteParts(key, old);
    },
  };
}
