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

  /** What this app last read or wrote. Supabase reads the session every 30 s; only the first read goes to the Keychain. */
  const memory = new Map<string, string | null>();

  const readMeta = async (key: string): Promise<Meta | null> => {
    const match = /^([01]):(\d+)$/.exec((await store.getItemAsync(metaKey(key))) ?? "");
    const count = Number(match?.[2]);
    if (!match || count < 1 || count > MAX_CHUNKS) return null;
    return { gen: match[1] === "1" ? 1 : 0, count };
  };

  const deleteParts = (key: string, meta: Meta) =>
    Promise.all(Array.from({ length: meta.count }, (_, i) => store.deleteItemAsync(partKey(key, meta.gen, i))));

  const readFromKeychain = async (key: string): Promise<string | null> => {
    const meta = await readMeta(key);
    if (!meta) return null;
    const parts = await Promise.all(Array.from({ length: meta.count }, (_, i) => store.getItemAsync(partKey(key, meta.gen, i))));
    // A missing part means a broken session: better signed out than a bad token.
    return parts.every((p) => p !== null) ? parts.join("") : null;
  };

  /**
   * Writes the new chunks next to the old ones, then switches the meta key to them, then
   * deletes the old ones. If the app is killed halfway, one whole session is still readable
   * (Supabase's new refresh token lives only here, so losing it signs the person out).
   */
  const writeToKeychain = async (key: string, value: string): Promise<void> => {
    const parts: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) parts.push(value.slice(i, i + CHUNK_SIZE));
    if (!parts.length) parts.push("");
    if (parts.length > MAX_CHUNKS) throw new Error("Session too large to store.");
    const old = await readMeta(key);
    const gen = old?.gen === 0 ? 1 : 0;
    await Promise.all(parts.map((part, i) => store.setItemAsync(partKey(key, gen, i), part)));
    await store.setItemAsync(metaKey(key), `${gen}:${parts.length}`);
    if (old) await deleteParts(key, old);
  };

  return {
    async getItem(key: string): Promise<string | null> {
      if (memory.has(key)) return memory.get(key) ?? null;
      const value = await readFromKeychain(key);
      memory.set(key, value);
      return value;
    },

    async setItem(key: string, value: string): Promise<void> {
      // If the write fails halfway, the next read goes back to the Keychain.
      memory.delete(key);
      await writeToKeychain(key, value);
      memory.set(key, value);
    },

    async removeItem(key: string): Promise<void> {
      memory.set(key, null);
      const old = await readMeta(key);
      await store.deleteItemAsync(metaKey(key));
      if (old) await deleteParts(key, old);
    },
  };
}
