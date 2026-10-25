import { CHUNK_SIZE, createChunkedStorage, type KeyValueStore } from "./secure-storage";

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItemAsync: async (key) => data.get(key) ?? null,
    setItemAsync: async (key, value) => {
      if (!/^[\w.-]+$/.test(key)) throw new Error(`bad key ${key}`);
      data.set(key, value);
    },
    deleteItemAsync: async (key) => {
      data.delete(key);
    },
  };
}

describe("createChunkedStorage", () => {
  test("reads the Keychain once, then from memory", async () => {
    const store = memoryStore();
    const writer = createChunkedStorage(store);
    await writer.setItem("k", "session");
    const reader = createChunkedStorage(store);
    const getItemAsync = jest.spyOn(store, "getItemAsync");

    expect(await reader.getItem("k")).toBe("session");
    const reads = getItemAsync.mock.calls.length;
    expect(await reader.getItem("k")).toBe("session");
    expect(getItemAsync.mock.calls.length).toBe(reads);
  });

  test("returns null for a key that was never set", async () => {
    const storage = createChunkedStorage(memoryStore());
    expect(await storage.getItem("sb-auth-token")).toBeNull();
  });

  test("round-trips a value larger than one chunk", async () => {
    const store = memoryStore();
    const storage = createChunkedStorage(store);
    const value = "x".repeat(CHUNK_SIZE * 2 + 5);

    await storage.setItem("sb-abc-auth-token", value);

    expect(await storage.getItem("sb-abc-auth-token")).toBe(value);
    expect(store.data.get("sb-abc-auth-token.meta")).toBe("0:3");
  });

  test("round-trips an empty value", async () => {
    const storage = createChunkedStorage(memoryStore());

    await storage.setItem("k", "");

    expect(await storage.getItem("k")).toBe("");
  });

  test("makes keys safe for the Keychain", async () => {
    const store = memoryStore();
    const storage = createChunkedStorage(store);

    await storage.setItem("sb:auth/token", "v");

    expect(await storage.getItem("sb:auth/token")).toBe("v");
    expect([...store.data.keys()].sort()).toEqual(["sb_auth_token.0.0", "sb_auth_token.meta"]);
  });

  test("a new value switches chunk sets and removes the old one", async () => {
    const store = memoryStore();
    const storage = createChunkedStorage(store);
    await storage.setItem("k", "y".repeat(CHUNK_SIZE * 3));

    await storage.setItem("k", "short");

    expect(await storage.getItem("k")).toBe("short");
    expect([...store.data.keys()].sort()).toEqual(["k.1.0", "k.meta"]);
  });

  test("a write that fails halfway keeps the old session readable", async () => {
    const store = memoryStore();
    const storage = createChunkedStorage(store);
    const old = "o".repeat(CHUNK_SIZE * 2);
    await storage.setItem("k", old);
    const setItemAsync = store.setItemAsync;
    let writes = 0;
    store.setItemAsync = async (key, value) => {
      if (++writes === 2) throw new Error("Keychain locked");
      return setItemAsync(key, value);
    };

    await expect(storage.setItem("k", "n".repeat(CHUNK_SIZE * 2))).rejects.toThrow("Keychain locked");

    expect(await storage.getItem("k")).toBe(old);
  });

  test("refuses a value too big to be a session", async () => {
    const storage = createChunkedStorage(memoryStore());

    await expect(storage.setItem("k", "z".repeat(CHUNK_SIZE * 65))).rejects.toThrow("Session too large");
  });

  test("removeItem deletes every chunk", async () => {
    const store = memoryStore();
    const storage = createChunkedStorage(store);
    await storage.setItem("k", "z".repeat(CHUNK_SIZE + 1));

    await storage.removeItem("k");

    expect(store.data.size).toBe(0);
    expect(await storage.getItem("k")).toBeNull();
  });

  test("a missing chunk reads as signed out, not a broken token", async () => {
    const store = memoryStore();
    const storage = createChunkedStorage(store);
    await storage.setItem("k", "z".repeat(CHUNK_SIZE + 1));
    store.data.delete("k.0.1");

    // A fresh start (no memory) reads the Keychain again.
    expect(await createChunkedStorage(store).getItem("k")).toBeNull();
  });

  test("ignores nonsense meta", async () => {
    const store = memoryStore();
    store.data.set("k.meta", "0:999999");
    store.data.set("j.meta", "garbage");
    const storage = createChunkedStorage(store);

    expect(await storage.getItem("k")).toBeNull();
    expect(await storage.getItem("j")).toBeNull();
  });
});
