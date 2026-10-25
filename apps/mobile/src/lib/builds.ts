import type { PackId, Reopened, ScanResult, SelectionInput } from "@retrofit/core";
import { getApi } from "./api";

/**
 * One scanned photo being edited. Kept in memory while the app is open; the server keeps the
 * photo and signs it for 24 hours. Saved swaps are on the server too (My swaps).
 */
export type Build = ScanResult & {
  id: string;
  pack: PackId;
  /** The photo for the "before" side: on this phone after a scan, or the server's copy when reopened. */
  localUri: string;
  /** "Swap more": the picks from the saved swap, put back on the parts. */
  preselect?: SelectionInput[];
};

const builds = new Map<string, Build>();
/** A few photos at most; older ones can be reopened from My swaps. */
const MAX_KEPT = 5;

const newId = () => Math.random().toString(36).slice(2, 10);

export function createBuild(pack: PackId, localUri: string, scan: ScanResult, preselect?: SelectionInput[]): Build {
  const build: Build = { ...scan, id: newId(), pack, localUri, ...(preselect?.length ? { preselect } : {}) };
  builds.set(build.id, build);
  // Oldest first: a Map keeps insertion order.
  while (builds.size > MAX_KEPT) builds.delete(builds.keys().next().value!);
  return build;
}

/**
 * "Swap more" on a saved swap: the server copies the photo back and signs it again (no new
 * scan). Returns the new build, or an error message.
 */
export async function reopenSaved(jobId: string): Promise<Build | { error: string }> {
  const result = await getApi<Reopened>(`/api/renders/${encodeURIComponent(jobId)}/reopen`, { method: "POST" });
  if (result.status === "error") return { error: result.message };
  const { pack, photoUrl, width, height, scene, token, selections } = result.data;
  return createBuild(pack, photoUrl, { photoUrl, width, height, scene, token }, selections);
}

export const getBuild =(id: string): Build | undefined => builds.get(id);

/** What the API needs to trust the photo: the signed claim and its token. */
export const claimOf = (build: Build) => ({
  claim: { photoUrl: build.photoUrl, pack: build.pack, width: build.width, height: build.height, scene: build.scene },
  token: build.token,
});
