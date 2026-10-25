import type { PackId, SceneAnalysis, SelectionInput } from "@retrofit/core";

export type { SelectionInput };

export type Version = {
  id: string;
  selections: SelectionInput[];
  /** Human labels for the strip, e.g. ["Black leather bomber jacket"]. */
  labels: string[];
  status: "rendering" | "done" | "failed";
  jobId?: string;
  jobToken?: string;
  imageUrl?: string;
  error?: string;
};

export type Build = {
  id: string;
  pack: PackId;
  photoUrl: string;
  width: number;
  height: number;
  scene: SceneAnalysis;
  /** Server signature for this photo; sent with every render. */
  token: string;
  createdAt: number;
  versions: Version[];
  /** Swaps to pick straight away ("Try this on me" from a share link). */
  preselect?: SelectionInput[];
};

const PREFIX = "retrofit:build:";
/** Same as the server-side photo retention. */
const TTL_MS = 24 * 60 * 60 * 1000;

const randomId = () => Math.random().toString(36).slice(2, 10);

/**
 * Builds live in this browser (local storage) for 24 hours, the same as the photos. Local
 * storage is shared by every tab, so the sign-in link from the email (which opens a new tab)
 * still finds the build.
 */
export function createBuildStore(
  storage: Storage,
  now: () => number = Date.now,
  newId: () => string = randomId,
  onChange: (id: string) => void = () => {},
) {
  const read = (id: string): Build | undefined => {
    try {
      const raw = storage.getItem(PREFIX + id);
      if (!raw) return undefined;
      const build = JSON.parse(raw) as Build;
      if (now() - build.createdAt > TTL_MS) {
        storage.removeItem(PREFIX + id);
        return undefined;
      }
      return build;
    } catch {
      return undefined;
    }
  };

  const ids = (): string[] => {
    try {
      return Array.from({ length: storage.length }, (_, i) => storage.key(i))
        .filter((k): k is string => k?.startsWith(PREFIX) ?? false)
        .map((k) => k.slice(PREFIX.length));
    } catch {
      return []; // Storage blocked: no builds.
    }
  };

  /** Drops every build older than 24 hours, so old photos don't pile up in the browser. */
  const sweep = () => {
    for (const id of ids()) read(id);
  };

  const write = (build: Build) => {
    storage.setItem(PREFIX + build.id, JSON.stringify(build));
    onChange(build.id);
  };

  return {
    create(input: Omit<Build, "id" | "createdAt" | "versions">): Build {
      sweep();
      const build: Build = { ...input, id: newId(), createdAt: now(), versions: [] };
      write(build);
      return build;
    },
    get: read,
    /** The newest builds still kept, for "pick up where you left off". */
    recent(limit: number): Build[] {
      return ids()
        .map(read)
        .filter((b): b is Build => b !== undefined)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, limit);
    },
    update(id: string, change: (build: Build) => Build): Build | undefined {
      const current = read(id);
      if (!current) return undefined;
      const next = change(current);
      write(next);
      return next;
    },
  };
}

export const BUILD_EVENT = "retrofit:build-change";
export const buildKey = (id: string) => PREFIX + id;

export function browserBuildStore() {
  return createBuildStore(window.localStorage, Date.now, randomId, (id) =>
    window.dispatchEvent(new CustomEvent(BUILD_EVENT, { detail: id })),
  );
}
