import { describe, expect, it } from "vitest";
import { createBuildStore, type Build } from "./store";

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
}

const base = {
  pack: "car" as const,
  photoUrl: "https://cdn/car.jpg",
  width: 1600,
  height: 1200,
  scene: { subject: "a white sedan", parts: [] },
  token: "t",
};

describe("build store", () => {
  it("creates a build with an id and no versions, and loads it back", () => {
    const store = createBuildStore(memoryStorage(), () => 1000, () => "abc123");
    const build = store.create(base);

    expect(build).toMatchObject({ id: "abc123", createdAt: 1000, versions: [], ...base });
    expect(store.get("abc123")).toEqual(build);
  });

  it("returns undefined for unknown or corrupt entries", () => {
    const storage = memoryStorage();
    const store = createBuildStore(storage);
    expect(store.get("nope")).toBeUndefined();
    storage.setItem("retrofit:build:bad", "{not json");
    expect(store.get("bad")).toBeUndefined();
  });

  it("updates immutably and persists", () => {
    const store = createBuildStore(memoryStorage(), () => 0, () => "b1");
    const before = store.create(base);
    const after = store.update("b1", (b: Build) => ({
      ...b,
      versions: [...b.versions, { id: "v1", selections: [], labels: [], status: "rendering" as const }],
    }));

    expect(before.versions).toHaveLength(0);
    expect(after?.versions).toHaveLength(1);
    expect(store.get("b1")?.versions).toHaveLength(1);
  });

  it("treats builds older than 24 hours as gone", () => {
    let now = 0;
    const store = createBuildStore(memoryStorage(), () => now, () => "old");
    store.create(base);
    now = 24 * 60 * 60 * 1000 + 1;
    expect(store.get("old")).toBeUndefined();
  });
});

describe("build store cleanup", () => {
  it("removes builds older than 24 hours when a new one is made", () => {
    const storage = memoryStorage();
    let t = 0;
    let n = 0;
    const store = createBuildStore(storage, () => t, () => `b${++n}`);
    store.create(base);
    t = 25 * 60 * 60 * 1000;
    store.create(base);
    expect(storage.getItem("retrofit:build:b1")).toBeNull();
    expect(storage.getItem("retrofit:build:b2")).not.toBeNull();
  });

  it("lists recent builds, newest first, skipping expired ones", () => {
    const storage = memoryStorage();
    let t = 1000;
    let n = 0;
    const store = createBuildStore(storage, () => t, () => `b${++n}`);
    store.create(base);
    t = 2000;
    store.create(base);
    t = 3000;
    store.create(base);
    storage.setItem("retrofit:return-to", "not a build");
    expect(store.recent(2).map((b) => b.id)).toEqual(["b3", "b2"]);
    t = 1000 + 24 * 60 * 60 * 1000 + 1;
    expect(store.recent(5).map((b) => b.id)).toEqual(["b3", "b2"]);
  });
});

