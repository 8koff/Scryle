import { describe, expect, it } from "vitest";
import { adminEmails, isAdmin } from "./admin";
import { toGalleryCard } from "./gallery";
import { createMemoryShareStore, ownerGalleryChange } from "./shares";

const share = (id: string, owner = "u1") => ({ id, owner, jobId: `job-${id}`, pack: "room" as const, width: 1200, height: 900, selections: [], labels: ["Green sofa"] });

describe("ownerGalleryChange", () => {
  it("lets the owner send a link, and send it again after a no", () => {
    expect(ownerGalleryChange("none", "submit")).toBe("pending");
    expect(ownerGalleryChange("rejected", "submit")).toBe("pending");
  });

  it("never lets the owner approve their own link", () => {
    expect(ownerGalleryChange("pending", "submit")).toBeNull();
    expect(ownerGalleryChange("approved", "submit")).toBeNull();
  });

  it("always lets the owner take it out", () => {
    expect(ownerGalleryChange("pending", "withdraw")).toBe("none");
    expect(ownerGalleryChange("approved", "withdraw")).toBe("none");
    expect(ownerGalleryChange("none", "withdraw")).toBeNull();
  });
});

describe("gallery store", () => {
  it("starts every new link outside the gallery", async () => {
    const shares = createMemoryShareStore();
    await shares.insert(share("aaaaaaaaaa"));
    expect((await shares.get("aaaaaaaaaa"))?.gallery).toBe("none");
  });

  it("only changes the owner's own link when an owner is given", async () => {
    const shares = createMemoryShareStore();
    await shares.insert(share("aaaaaaaaaa", "u1"));
    expect(await shares.setGallery("aaaaaaaaaa", "pending", "u2")).toBe(false);
    expect(await shares.setGallery("aaaaaaaaaa", "pending", "u1")).toBe(true);
    expect(await shares.setGallery("missing000", "approved")).toBe(false);
  });

  it("lists links by status, most recent decision first", async () => {
    const shares = createMemoryShareStore();
    for (const id of ["aaaaaaaaaa", "bbbbbbbbbb", "cccccccccc"]) await shares.insert(share(id));
    await shares.setGallery("aaaaaaaaaa", "approved");
    await shares.setGallery("bbbbbbbbbb", "pending");
    await shares.setGallery("cccccccccc", "approved");
    expect((await shares.listGallery("approved", 10)).map((s) => s.id)).toEqual(["cccccccccc", "aaaaaaaaaa"]);
    expect((await shares.listGallery("pending", 10)).map((s) => s.id)).toEqual(["bbbbbbbbbb"]);
  });

  it("builds a card from the link's own stored pictures", async () => {
    const shares = createMemoryShareStore();
    await shares.insert(share("aaaaaaaaaa"));
    const card = toGalleryCard((await shares.get("aaaaaaaaaa"))!, shares);
    expect(card).toMatchObject({ id: "aaaaaaaaaa", afterUrl: "https://storage.test/aaaaaaaaaa/after.jpg", labels: ["Green sofa"] });
  });
});

describe("admin", () => {
  const env = { ADMIN_EMAILS: " Owner@Example.com , second@example.com" };

  it("reads the list, ignoring case and spaces", () => {
    expect(adminEmails(env)).toEqual(new Set(["owner@example.com", "second@example.com"]));
  });

  it("lets in listed emails only", () => {
    expect(isAdmin({ id: "u1", email: "owner@example.com" }, env)).toBe(true);
    expect(isAdmin({ id: "u2", email: "someone@example.com" }, env)).toBe(false);
    expect(isAdmin({ id: "u3" }, env)).toBe(false);
    expect(isAdmin(null, env)).toBe(false);
    expect(isAdmin({ id: "u1", email: "owner@example.com" }, {})).toBe(false);
  });
});
