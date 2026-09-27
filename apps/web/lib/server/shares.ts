import { randomInt } from "node:crypto";
import { getPack, isPackId, type PackId } from "@retrofit/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { GalleryStatus } from "@/lib/api";
import { findProduct, fitsPart, type Product } from "@/lib/catalog/catalog";
import { cleanDescription } from "@/lib/catalog/describe";
import type { SelectionInput } from "@/lib/build/store";
import { handleShare, type ShareDeps } from "./share";
import { lookupProducts, type FindLive } from "./shop/lookup";

export type { GalleryStatus };

/** A public share link: /b/<id>. */
export type ShareRecord = {
  id: string;
  owner: string;
  jobId: string;
  pack: PackId;
  width: number;
  height: number;
  selections: SelectionInput[];
  labels: string[];
  gallery: GalleryStatus;
  galleryAt: string | null;
  /** Hidden after a serious report, until an admin decides. The page then answers "not found". */
  hidden: boolean;
  createdAt: string;
};

/**
 * What the owner may do with the gallery. Sending puts it in the queue (again, after a "no");
 * taking it out always works. Only an admin can approve or reject.
 */
export function ownerGalleryChange(current: GalleryStatus, action: "submit" | "withdraw"): GalleryStatus | null {
  if (action === "withdraw") return current === "none" ? null : "none";
  return current === "none" || current === "rejected" ? "pending" : null;
}

/** The files kept for a link: both photos, plus the card used as the link preview. */
export type ShareFile = "before" | "after" | "card";

const FILES: Record<ShareFile, { name: string; type: string }> = {
  before: { name: "before.jpg", type: "image/jpeg" },
  after: { name: "after.jpg", type: "image/jpeg" },
  card: { name: "card.png", type: "image/png" },
};
const allPaths = (id: string) => Object.values(FILES).map((f) => `${id}/${f.name}`);

export type ShareStore = {
  get(id: string): Promise<ShareRecord | null>;
  findByJob(jobId: string): Promise<ShareRecord | null>;
  insert(record: Omit<ShareRecord, "createdAt" | "gallery" | "galleryAt" | "hidden">): Promise<void>;
  /** Changes the gallery status. `owner` limits it to that owner's link. False if not found. */
  setGallery(id: string, status: GalleryStatus, owner?: string): Promise<boolean>;
  /** Links with this gallery status, newest decision first. Hidden links are left out. */
  listGallery(status: GalleryStatus, limit: number): Promise<ShareRecord[]>;
  /** Hides a link (or shows it again). False if not found. */
  setHidden(id: string, hidden: boolean): Promise<boolean>;
  /** Admin takedown: removes the photos, then the link, whoever owns it. False if not found. */
  takeDown(id: string): Promise<boolean>;
  /** Every link this person made (for closing an account). */
  listByOwner(owner: string): Promise<ShareRecord[]>;
  /**
   * Removes the photos, then the link. Only the owner can: returns false if not theirs.
   * Throws if the photos couldn't be removed, so a "deleted" link never leaves them behind.
   */
  remove(id: string, owner: string): Promise<boolean>;
  upload(id: string, file: ShareFile, bytes: Buffer): Promise<void>;
  fileUrl(id: string, file: ShareFile): string;
};

const BUCKET = "shares";
const ID_CHARS = "abcdefghijkmnpqrstuvwxyz23456789";
export const SHARE_ID = /^[a-z0-9]{10}$/;

/** 10 characters from 32 → about 10^15 ids, so links can't be guessed. */
export function newShareId(): string {
  return Array.from({ length: 10 }, () => ID_CHARS[randomInt(ID_CHARS.length)]).join("");
}

type Row = {
  id: string;
  owner: string;
  job_id: string;
  pack: string;
  width: number;
  height: number;
  selections: SelectionInput[];
  labels: string[];
  gallery?: GalleryStatus;
  gallery_at?: string | null;
  hidden_at?: string | null;
  created_at: string;
};

const fromRow = (r: Row): ShareRecord | null =>
  isPackId(r.pack)
    ? {
        id: r.id,
        owner: r.owner,
        jobId: r.job_id,
        pack: r.pack,
        width: r.width,
        height: r.height,
        selections: r.selections,
        labels: r.labels,
        gallery: r.gallery ?? "none",
        galleryAt: r.gallery_at ?? null,
        hidden: Boolean(r.hidden_at),
        createdAt: r.created_at,
      }
    : null;

export function createSupabaseShareStore(db: SupabaseClient): ShareStore {
  const one = async (column: "id" | "job_id", value: string) => {
    const { data, error } = await db.from("shares").select("*").eq(column, value).maybeSingle<Row>();
    if (error) throw new Error(`[shares] read failed: ${error.message}`);
    return data ? fromRow(data) : null;
  };

  /** Throws if the photos couldn't be removed, so a "deleted" link never leaves them behind. */
  const removeFiles = async (id: string) => {
    const removed = await db.storage.from(BUCKET).remove(allPaths(id));
    if (removed.error) throw new Error(`[shares] photo delete failed: ${removed.error.message}`);
  };

  return {
    get: (id) => one("id", id),
    findByJob: (jobId) => one("job_id", jobId),
    async insert(r) {
      const { error } = await db.from("shares").insert({
        id: r.id,
        owner: r.owner,
        job_id: r.jobId,
        pack: r.pack,
        width: r.width,
        height: r.height,
        selections: r.selections,
        labels: r.labels,
      });
      if (error) throw new Error(`[shares] insert failed: ${error.message}`);
    },
    async setGallery(id, status, owner) {
      let query = db.from("shares").update({ gallery: status, gallery_at: new Date().toISOString() }).eq("id", id);
      if (owner) query = query.eq("owner", owner);
      const { data, error } = await query.select("id");
      if (error) throw new Error(`[shares] gallery update failed: ${error.message}`);
      return (data?.length ?? 0) > 0;
    },
    async listGallery(status, limit) {
      const { data, error } = await db
        .from("shares")
        .select("*")
        .eq("gallery", status)
        .is("hidden_at", null)
        .order("gallery_at", { ascending: false })
        .limit(limit)
        .returns<Row[]>();
      if (error) throw new Error(`[shares] gallery list failed: ${error.message}`);
      return (data ?? []).map(fromRow).filter((r): r is ShareRecord => r !== null);
    },
    async remove(id, owner) {
      const share = await one("id", id);
      if (!share || share.owner !== owner) return false;
      await removeFiles(id);
      const { error } = await db.from("shares").delete().eq("id", id).eq("owner", owner);
      if (error) throw new Error(`[shares] delete failed: ${error.message}`);
      return true;
    },
    async setHidden(id, hidden) {
      const { data, error } = await db
        .from("shares")
        .update({ hidden_at: hidden ? new Date().toISOString() : null })
        .eq("id", id)
        .select("id");
      if (error) throw new Error(`[shares] hide failed: ${error.message}`);
      return (data?.length ?? 0) > 0;
    },
    async takeDown(id) {
      if (!(await one("id", id))) return false;
      await removeFiles(id);
      const { error } = await db.from("shares").delete().eq("id", id);
      if (error) throw new Error(`[shares] takedown failed: ${error.message}`);
      return true;
    },
    async listByOwner(owner) {
      const { data, error } = await db.from("shares").select("*").eq("owner", owner).returns<Row[]>();
      if (error) throw new Error(`[shares] owner list failed: ${error.message}`);
      return (data ?? []).map(fromRow).filter((r): r is ShareRecord => r !== null);
    },
    async upload(id, file, bytes) {
      const { name, type } = FILES[file];
      const { error } = await db.storage.from(BUCKET).upload(`${id}/${name}`, bytes, { contentType: type, upsert: false });
      if (error) throw new Error(`[shares] upload failed: ${error.message}`);
    },
    fileUrl: (id, file) => db.storage.from(BUCKET).getPublicUrl(`${id}/${FILES[file].name}`).data.publicUrl,
  };
}

/** Same rules, in memory (tests). */
export function createMemoryShareStore(): ShareStore & { photos: Map<string, Buffer> } {
  const rows = new Map<string, ShareRecord>();
  const photos = new Map<string, Buffer>();
  let clock = 0;
  return {
    photos,
    get: async (id) => rows.get(id) ?? null,
    findByJob: async (jobId) => [...rows.values()].find((r) => r.jobId === jobId) ?? null,
    async insert(r) {
      if (rows.has(r.id) || [...rows.values()].some((x) => x.jobId === r.jobId)) throw new Error("duplicate");
      rows.set(r.id, { ...r, gallery: "none", galleryAt: null, hidden: false, createdAt: new Date(0).toISOString() });
    },
    async setGallery(id, status, owner) {
      const row = rows.get(id);
      if (!row || (owner && row.owner !== owner)) return false;
      rows.set(id, { ...row, gallery: status, galleryAt: new Date(++clock * 1000).toISOString() });
      return true;
    },
    async listGallery(status, limit) {
      return [...rows.values()]
        .filter((r) => r.gallery === status && !r.hidden)
        .sort((a, b) => (b.galleryAt ?? "").localeCompare(a.galleryAt ?? ""))
        .slice(0, limit);
    },
    async remove(id, owner) {
      if (rows.get(id)?.owner !== owner) return false;
      for (const file of Object.keys(FILES)) photos.delete(`${id}/${file}`);
      rows.delete(id);
      return true;
    },
    async setHidden(id, hidden) {
      const row = rows.get(id);
      if (!row) return false;
      rows.set(id, { ...row, hidden });
      return true;
    },
    async takeDown(id) {
      const row = rows.get(id);
      return row ? this.remove(id, row.owner) : false;
    },
    listByOwner: async (owner) => [...rows.values()].filter((r) => r.owner === owner),
    async upload(id, file, bytes) {
      if (photos.has(`${id}/${file}`)) throw new Error("exists");
      photos.set(`${id}/${file}`, bytes);
    },
    fileUrl: (id, file) => `https://storage.test/${id}/${FILES[file].name}`,
  };
}

const SelectionsSchema = z
  .array(
    z.union([
      z.object({ partId: z.string().min(1).max(60), productId: z.string().min(1).max(120) }),
      z.object({ partId: z.string().min(1).max(60), text: z.string().max(200) }),
    ]),
  )
  .min(1)
  .max(6);

/** Keeps only swaps we recognise, and turns them into plain words for the page. */
export function checkSelections(
  pack: PackId,
  raw: SelectionInput[],
  lookup: (id: string) => Product | undefined = findProduct,
): { selections: SelectionInput[]; labels: string[] } {
  const partIds = new Set(getPack(pack).parts.map((p) => p.id));
  const selections: SelectionInput[] = [];
  const labels: string[] = [];
  for (const s of raw) {
    if ("productId" in s) {
      const product = lookup(s.productId);
      if (!product || !fitsPart(product, pack, s.partId)) continue;
      selections.push({ partId: s.partId, productId: product.id });
      labels.push(product.title);
    } else {
      const described = cleanDescription(s.text, pack);
      if (!described.ok || !partIds.has(s.partId)) continue;
      selections.push({ partId: s.partId, text: described.text });
      labels.push(described.text);
    }
  }
  return { selections, labels };
}

export type CreateShareDeps = ShareDeps & {
  userId: string | null;
  shares: ShareStore;
  /** Who paid for the render (from the credits ledger). Only they may publish it. */
  jobOwner: (jobId: string) => Promise<string | null>;
  /** Downloads an image. */
  fetchImage: (url: string) => Promise<Buffer>;
  /** Turns a downloaded image into the JPEG we keep. */
  keep: (bytes: Buffer) => Promise<Buffer>;
  /** Draws the before/after card used as the link preview. */
  card: (before: Buffer, after: Buffer, aspect: number) => Promise<Buffer>;
  newId?: () => string;
  /** Products found by store search, by id. */
  findLive?: FindLive;
};

type CreateResult = { status: number; body: { success: true; data: { id: string } } | { success: false; error: string; code?: "sign_in" } };

/** Makes (or finds) the public link for one finished render. Only the person who made it can. */
export async function handleCreateShare(input: unknown, deps: CreateShareDeps): Promise<CreateResult> {
  const fail = (status: number, error: string, code?: "sign_in"): CreateResult => ({ status, body: { success: false, error, ...(code ? { code } : {}) } });
  if (!deps.userId) return fail(401, "Sign in to make a link.", "sign_in");

  const parsedSelections = SelectionsSchema.safeParse((input as { selections?: unknown } | null)?.selections);
  if (!parsedSelections.success) return fail(400, "That request didn't look right.");

  const checked = await handleShare(input, deps);
  if (!checked.ok) return fail(checked.status, checked.error);
  const { claim, jobId } = input as { claim: { pack: PackId; width: number; height: number }; jobId: string };

  if ((await deps.jobOwner(jobId)) !== deps.userId) return fail(403, "Only the person who made this swap can share it.");

  const existing = await deps.shares.findByJob(jobId);
  if (existing) return { status: 200, body: { success: true, data: { id: existing.id } } };

  const { selections, labels } = checkSelections(claim.pack, parsedSelections.data, await lookupProducts(parsedSelections.data, deps.findLive));
  const id = (deps.newId ?? newShareId)();
  const record = { id, owner: deps.userId, jobId, pack: claim.pack, width: claim.width, height: claim.height, selections, labels };
  try {
    // The row goes in first: a second request for the same render fails here, before uploading.
    await deps.shares.insert(record);
  } catch (error) {
    const raced = await deps.shares.findByJob(jobId);
    if (raced) return { status: 200, body: { success: true, data: { id: raced.id } } };
    throw error;
  }

  try {
    const [before, after] = await Promise.all([deps.fetchImage(checked.beforeUrl), deps.fetchImage(checked.afterUrl)]);
    const [keptBefore, keptAfter, card] = await Promise.all([deps.keep(before), deps.keep(after), deps.card(before, after, checked.aspect)]);
    await Promise.all([
      deps.shares.upload(id, "before", keptBefore),
      deps.shares.upload(id, "after", keptAfter),
      deps.shares.upload(id, "card", card),
    ]);
  } catch (error) {
    // Don't leave a half-made link (or loose photos) behind.
    await deps.shares.remove(id, deps.userId).catch((e) => console.error("[shares] cleanup failed", id, e));
    throw error;
  }
  return { status: 200, body: { success: true, data: { id } } };
}
