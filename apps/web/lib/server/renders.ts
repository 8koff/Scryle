import { isPackId, SceneAnalysisSchema, type PackId, type SceneAnalysis } from "@retrofit/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RenderCard } from "@/lib/api";
import type { SelectionInput } from "@/lib/build/store";
import { isTrustedResultUrl } from "./share";

/** One paid render, kept in the buyer's account. */
export type SavedRender = {
  jobId: string;
  owner: string;
  pack: PackId;
  width: number;
  height: number;
  selections: SelectionInput[];
  labels: string[];
  photoUrl: string;
  /** The photo reader's part map, so the photo can be opened in the studio again. */
  scene: SceneAnalysis | null;
  /** When both pictures were copied to our storage. null until then. */
  keptAt: string | null;
  createdAt: string;
};

export type NewRender = Omit<SavedRender, "keptAt" | "createdAt">;
export type RenderFile = "before" | "after";

export type RenderStore = {
  /** Notes a render as it starts. Safe to call twice. */
  record(render: NewRender): Promise<void>;
  get(jobId: string): Promise<SavedRender | null>;
  markKept(jobId: string): Promise<void>;
  /** The owner's kept renders, newest first. */
  listKept(owner: string, limit: number): Promise<SavedRender[]>;
  /** Stores one picture. Overwrites, so two copies at once are harmless. */
  upload(render: SavedRender, file: RenderFile, bytes: Buffer): Promise<void>;
  /** Reads one stored picture back (to reopen the photo in the studio). */
  download(render: SavedRender, file: RenderFile): Promise<Buffer>;
  /** Short-lived links to the pictures, in the same order as asked. */
  fileUrls(files: { render: SavedRender; file: RenderFile }[], seconds: number): Promise<string[]>;
  /** Deletes every stored picture of this owner (for closing an account). The rows go with the account. */
  removeFilesOf(owner: string): Promise<void>;
};

/** Storage deletes are sent in batches of this many paths. */
const REMOVE_BATCH = 500;

const BUCKET = "renders";
const path = (r: SavedRender, file: RenderFile) => `${r.owner}/${r.jobId}/${file}.jpg`;

type Row = {
  job_id: string;
  owner: string;
  pack: string;
  width: number;
  height: number;
  selections: SelectionInput[];
  labels: string[];
  photo_url: string;
  scene?: unknown;
  kept_at: string | null;
  created_at: string;
};

const fromRow = (r: Row): SavedRender | null =>
  isPackId(r.pack)
    ? {
        jobId: r.job_id,
        owner: r.owner,
        pack: r.pack,
        width: r.width,
        height: r.height,
        selections: r.selections,
        labels: r.labels,
        photoUrl: r.photo_url,
        scene: SceneAnalysisSchema.safeParse(r.scene).data ?? null,
        keptAt: r.kept_at,
        createdAt: r.created_at,
      }
    : null;

export function createSupabaseRenderStore(db: SupabaseClient): RenderStore {
  return {
    async record(r) {
      const { error } = await db.from("renders").upsert(
        {
          job_id: r.jobId,
          owner: r.owner,
          pack: r.pack,
          width: r.width,
          height: r.height,
          selections: r.selections,
          labels: r.labels,
          photo_url: r.photoUrl,
          scene: r.scene,
        },
        { onConflict: "job_id", ignoreDuplicates: true },
      );
      if (error) throw new Error(`[renders] record failed: ${error.message}`);
    },
    async get(jobId) {
      const { data, error } = await db.from("renders").select("*").eq("job_id", jobId).maybeSingle<Row>();
      if (error) throw new Error(`[renders] read failed: ${error.message}`);
      return data ? fromRow(data) : null;
    },
    async markKept(jobId) {
      const { error } = await db.from("renders").update({ kept_at: new Date().toISOString() }).eq("job_id", jobId).is("kept_at", null);
      if (error) throw new Error(`[renders] mark kept failed: ${error.message}`);
    },
    async listKept(owner, limit) {
      const { data, error } = await db
        .from("renders")
        .select("*")
        .eq("owner", owner)
        .not("kept_at", "is", null)
        .order("created_at", { ascending: false })
        .limit(limit)
        .returns<Row[]>();
      if (error) throw new Error(`[renders] list failed: ${error.message}`);
      return (data ?? []).map(fromRow).filter((r): r is SavedRender => r !== null);
    },
    async upload(r, file, bytes) {
      const { error } = await db.storage.from(BUCKET).upload(path(r, file), bytes, { contentType: "image/jpeg", upsert: true });
      if (error) throw new Error(`[renders] upload failed: ${error.message}`);
    },
    async download(r, file) {
      const { data, error } = await db.storage.from(BUCKET).download(path(r, file));
      if (error || !data) throw new Error(`[renders] download failed: ${error?.message}`);
      return Buffer.from(await data.arrayBuffer());
    },
    async removeFilesOf(owner) {
      const { data, error } = await db.from("renders").select("job_id").eq("owner", owner).returns<{ job_id: string }[]>();
      if (error) throw new Error(`[renders] owner list failed: ${error.message}`);
      const paths = (data ?? []).flatMap((r) => (["before", "after"] as const).map((f) => `${owner}/${r.job_id}/${f}.jpg`));
      for (let i = 0; i < paths.length; i += REMOVE_BATCH) {
        const removed = await db.storage.from(BUCKET).remove(paths.slice(i, i + REMOVE_BATCH));
        if (removed.error) throw new Error(`[renders] photo delete failed: ${removed.error.message}`);
      }
    },
    async fileUrls(files, seconds) {
      if (!files.length) return [];
      const { data, error } = await db.storage.from(BUCKET).createSignedUrls(
        files.map((f) => path(f.render, f.file)),
        seconds,
      );
      if (error || !data) throw new Error(`[renders] signed links failed: ${error?.message}`);
      return data.map((d) => d.signedUrl ?? "");
    },
  };
}

/** Same rules, in memory (tests). */
export function createMemoryRenderStore(): RenderStore & { files: Map<string, Buffer> } {
  const rows = new Map<string, SavedRender>();
  const files = new Map<string, Buffer>();
  let clock = 0;
  return {
    files,
    async record(r) {
      if (!rows.has(r.jobId)) rows.set(r.jobId, { ...r, keptAt: null, createdAt: new Date(++clock * 1000).toISOString() });
    },
    get: async (jobId) => rows.get(jobId) ?? null,
    async markKept(jobId) {
      const r = rows.get(jobId);
      if (r && !r.keptAt) rows.set(jobId, { ...r, keptAt: new Date(0).toISOString() });
    },
    async listKept(owner, limit) {
      return [...rows.values()]
        .filter((r) => r.owner === owner && r.keptAt)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit);
    },
    async upload(r, file, bytes) {
      files.set(path(r, file), bytes);
    },
    async download(r, file) {
      const bytes = files.get(path(r, file));
      if (!bytes) throw new Error("not stored");
      return bytes;
    },
    fileUrls: async (list) => list.map((f) => `https://storage.test/${path(f.render, f.file)}`),
    async removeFilesOf(owner) {
      for (const key of [...files.keys()]) if (key.startsWith(`${owner}/`)) files.delete(key);
    },
  };
}

export type KeepDeps = {
  renders: RenderStore;
  fetchImage: (url: string) => Promise<Buffer>;
  /** Turns a downloaded image into the JPEG we keep. */
  keep: (bytes: Buffer) => Promise<Buffer>;
};

export type KeepResult = "kept" | "already" | "unknown";

/**
 * Copies a finished render (and the photo it started from) into our storage, so the buyer
 * keeps it after Higgsfield's copy expires. Safe to run twice.
 */
export async function keepRender(jobId: string, resultUrl: string, deps: KeepDeps): Promise<KeepResult> {
  const render = await deps.renders.get(jobId);
  if (!render) return "unknown";
  if (render.keptAt) return "already";
  // Both come from Higgsfield (our signed upload and its own answer). Never fetch anything else.
  if (!isTrustedResultUrl(resultUrl) || !isTrustedResultUrl(render.photoUrl)) {
    throw new Error(`[renders] untrusted image host for ${jobId}`);
  }

  const [before, after] = await Promise.all([deps.fetchImage(render.photoUrl), deps.fetchImage(resultUrl)]);
  const [keptBefore, keptAfter] = await Promise.all([deps.keep(before), deps.keep(after)]);
  await Promise.all([deps.renders.upload(render, "before", keptBefore), deps.renders.upload(render, "after", keptAfter)]);
  await deps.renders.markKept(jobId);
  return "kept";
}

/** How long the picture links on "My renders" work. The page asks again when opened. */
export const LINK_SECONDS = 60 * 60;
const MAX_LISTED = 60;

export async function listRenderCards(owner: string, renders: RenderStore): Promise<RenderCard[]> {
  const kept = await renders.listKept(owner, MAX_LISTED);
  const urls = await renders.fileUrls(
    kept.flatMap((render) => [
      { render, file: "before" as const },
      { render, file: "after" as const },
    ]),
    LINK_SECONDS,
  );
  return kept.map((r, i) => ({
    jobId: r.jobId,
    pack: r.pack,
    width: r.width,
    height: r.height,
    labels: r.labels,
    selections: r.selections,
    canReopen: r.scene !== null,
    createdAt: r.createdAt,
    beforeUrl: urls[i * 2] ?? "",
    afterUrl: urls[i * 2 + 1] ?? "",
  }));
}
