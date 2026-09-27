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

describe("deleteAccount", () => {
  it("removes the person's share links, their photos and stored renders, then the account", async () => {
    const { shares, renders } = await setup();
    const deleteUser = vi.fn(async () => {});

    await deleteAccount("u1", { shares, renders, deleteUser });

    expect(await shares.listByOwner("u1")).toEqual([]);
    expect([...shares.photos.keys()]).toEqual(["cccccccccc/after"]);
    expect([...renders.files.keys()].every((k) => k.startsWith("u2/"))).toBe(true);
    expect(deleteUser).toHaveBeenCalledWith("u1");
  });

  it("keeps the account when a file can't be removed, so it can be tried again", async () => {
    const { shares } = await setup();
    const deleteUser = vi.fn(async () => {});
    const failing = { removeFilesOf: vi.fn(async () => Promise.reject(new Error("storage down"))) };

    await expect(deleteAccount("u1", { shares, renders: failing, deleteUser })).rejects.toThrow("storage down");
    expect(deleteUser).not.toHaveBeenCalled();
  });
});
