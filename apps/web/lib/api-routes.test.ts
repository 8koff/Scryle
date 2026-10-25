import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const WEB = join(__dirname, "..");
const SOURCES = ["app", "components", "lib"];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

/**
 * Every "/api/<name>" the app calls must have a route folder. A text-only rename once turned
 * "/api/render" into "/api/swap" and nothing else noticed.
 */
describe("API addresses", () => {
  // Reads every source file: give it time when other checks run at the same time (CI, turbo).
  it("only calls routes that exist", { timeout: 30_000 }, () => {
    const missing = SOURCES.flatMap((dir) => sourceFiles(join(WEB, dir))).flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(/["'`]\/api\/([a-z0-9-]+)/g)]
        .map((m) => m[1]!)
        .filter((name) => !existsSync(join(WEB, "app", "api", name)))
        .map((name) => `${relative(WEB, file)} → /api/${name}`),
    );
    expect(missing).toEqual([]);
  });
});
