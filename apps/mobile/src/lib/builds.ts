import type { PackId, ScanResult } from "@retrofit/core";

/**
 * One scanned photo being edited. Kept in memory while the app is open; the server keeps the
 * photo and signs it for 24 hours. Saved swaps are on the server too (My swaps).
 */
export type Build = ScanResult & {
  id: string;
  pack: PackId;
  /** The photo on this phone, for the "before" side without a download. */
  localUri: string;
};

const builds = new Map<string, Build>();
/** A few photos at most; older ones can be reopened from My swaps. */
const MAX_KEPT = 5;

const newId = () => Math.random().toString(36).slice(2, 10);

export function createBuild(pack: PackId, localUri: string, scan: ScanResult): Build {
  const build: Build = { ...scan, id: newId(), pack, localUri };
  builds.set(build.id, build);
  // Oldest first: a Map keeps insertion order.
  while (builds.size > MAX_KEPT) builds.delete(builds.keys().next().value!);
  return build;
}

export const getBuild = (id: string): Build | undefined => builds.get(id);

/** What the API needs to trust the photo: the signed claim and its token. */
export const claimOf = (build: Build) => ({
  claim: { photoUrl: build.photoUrl, pack: build.pack, width: build.width, height: build.height, scene: build.scene },
  token: build.token,
});
