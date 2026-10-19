import { describe, expect, it, vi } from "vitest";
import { deleteAccount } from "./delete-account";
import { createMemoryRenderStore, type NewRender } from "./renders";
import { createMemoryShareStore } from "./shares";

const render = (jobId: string, owner: string): NewRender => ({
  jobId,
  owner,
  pack: "room",
  width: 10,
  height: 10,
  selections: [],
  labels: [],
  photoUrl: "https://cdn/p.jpg",
  scene: null,
});

async function setup() {
  const shares = createMemoryShareStore();
  const renders = createMemoryRenderStore();
  for (const [id, owner] of [["aaaaaaaaaa", "u1"], ["bbbbbbbbbb", "u1"], ["cccccccccc", "u2"]] as const) {
    await shares.insert({ id, owner, jobId: `job-${id}`, pack: "room", width: 10, height: 10, selections: [], labels: [] });
    await shares.upload(id, "after", Buffer.from("x"));
  }
  for (const [jobId, owner] of [["j1", "u1"], ["j2", "u2"]] as const) {
    await renders.record(render(jobId, owner));
    const saved = (await renders.get(jobId))!;
    await renders.upload(saved, "before", Buffer.from("b"));
    await renders.upload(saved, "after", Buffer.from("a"));
  }
  return { shares, renders };
}

/** Stopping billing works, unless a test says otherwise. */
const endBilling = async () => {};

describe("deleteAccount", () => {
  it("removes the person's share links, their photos and stored renders, then the account", async () => {
    const { shares, renders } = await setup();
    const deleteUser = vi.fn(async () => {});

    await deleteAccount("u1", { shares, renders, deleteUser, endBilling });

    expect(await shares.listByOwner("u1")).toEqual([]);
    expect([...shares.photos.keys()]).toEqual(["cccccccccc/after"]);
    expect([...renders.files.keys()].every((k) => k.startsWith("u2/"))).toBe(true);
    expect(deleteUser).toHaveBeenCalledWith("u1");
  });

  it("keeps the account when a file can't be removed, so it can be tried again", async () => {
    const { shares } = await setup();
    const deleteUser = vi.fn(async () => {});
    const failing = { removeFilesOf: vi.fn(async () => Promise.reject(new Error("storage down"))) };

    await expect(deleteAccount("u1", { shares, renders: failing, deleteUser, endBilling })).rejects.toThrow("storage down");
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("disconnects Sign in with Apple before anything is deleted", async () => {
    const { shares, renders } = await setup();
    const order: string[] = [];
    const disconnectApple = vi.fn(async () => void order.push("apple"));
    const deleteUser = vi.fn(async () => void order.push("user"));

    await deleteAccount("u1", { shares, renders, deleteUser, disconnectApple, endBilling });

    expect(order).toEqual(["apple", "user"]);
  });

  it("deletes nothing when Apple can't be disconnected", async () => {
    const { shares, renders } = await setup();
    const deleteUser = vi.fn(async () => {});
    const disconnectApple = vi.fn(async () => Promise.reject(new Error("apple down")));

    await expect(deleteAccount("u1", { shares, renders, deleteUser, disconnectApple, endBilling })).rejects.toThrow("apple down");
    expect(await shares.listByOwner("u1")).toHaveLength(2);
    expect([...renders.files.keys()].some((k) => k.startsWith("u1/"))).toBe(true);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("stops billing after Apple and before anything is deleted", async () => {
    const { shares, renders } = await setup();
    const order: string[] = [];
    await deleteAccount("u1", {
      shares,
      renders,
      deleteUser: async () => void order.push("user"),
      disconnectApple: async () => void order.push("apple"),
      endBilling: async () => void order.push("billing"),
    });
    expect(order).toEqual(["apple", "billing", "user"]);
  });

  it("deletes nothing when billing can't be stopped, so it can be tried again", async () => {
    const { shares, renders } = await setup();
    const deleteUser = vi.fn(async () => {});
    const failing = vi.fn(async () => Promise.reject(new Error("revenuecat down")));

    await expect(deleteAccount("u1", { shares, renders, deleteUser, endBilling: failing })).rejects.toThrow("revenuecat down");
    expect(await shares.listByOwner("u1")).toHaveLength(2);
    expect([...renders.files.keys()].some((k) => k.startsWith("u1/"))).toBe(true);
    expect(deleteUser).not.toHaveBeenCalled();
  });
});
