/**
 * Live check of the photo reader: runs analyzeScene on the P0 test photos and
 * draws the boxes it finds. Needs ANTHROPIC_API_KEY and a prior `npm run smoke`
 * (it reuses the test photos listed in .smoke/fixtures.json).
 *
 *   npm run smoke:vision
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getPack, type PackId, type SceneAnalysis } from "@retrofit/core";
import { anthropicFromEnv } from "../lib/server/anthropic";
import { analyzeScene } from "../lib/server/vision/analyze";

const OUT_DIR = ".smoke";
const RUNS: Array<{ fixture: string; pack: PackId }> = [
  { fixture: "person", pack: "clothing" },
  { fixture: "car", pack: "car" },
  { fixture: "room", pack: "room" },
  { fixture: "room", pack: "anything" },
];

type Fixture = { url: string; width: number; height: number };

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);

function section(title: string, image: string, scene: SceneAnalysis | null, seconds: number, error?: string): string {
  const boxes = (scene?.parts ?? [])
    .map(
      (p) =>
        `<div class="box" style="left:${p.box.x * 100}%;top:${p.box.y * 100}%;width:${p.box.w * 100}%;height:${p.box.h * 100}%"><span>${esc(p.label)}</span></div>`,
    )
    .join("");
  const details = scene?.details
    ? Object.entries(scene.details)
        .map(([k, v]) => `${esc(k)}: <b>${esc(v)}</b>`)
        .join(" · ")
    : "";
  const list = (scene?.parts ?? []).map((p) => `<li><b>${esc(p.partId)}</b> — ${esc(p.current)}</li>`).join("");
  return `<section><h2>${esc(title)} <small>${seconds.toFixed(1)}s</small></h2>
    ${error ? `<p class="err">${esc(error)}</p>` : `<p>${esc(scene?.subject ?? "")}${details ? ` · ${details}` : ""}</p>`}
    <div class="wrap"><div class="stage"><img src="${esc(image)}">${boxes}</div><ul>${list}</ul></div></section>`;
}

async function main() {
  const fixtures = JSON.parse(await readFile(path.join(OUT_DIR, "fixtures.json"), "utf8")) as Record<string, Fixture>;
  const real = anthropicFromEnv();
  const usage = { input: 0, output: 0 };
  // Wrap the client so we can report the real token cost of this run.
  const client = {
    beta: {
      messages: {
        parse: async (...args: Parameters<typeof real.beta.messages.parse>) => {
          const response = await real.beta.messages.parse(...args);
          usage.input += response.usage.input_tokens;
          usage.output += response.usage.output_tokens;
          return response;
        },
      },
    },
  } as unknown as typeof real;
  const model = process.env.VISION_MODEL || undefined;

  const sections = await Promise.all(
    RUNS.map(async ({ fixture, pack }) => {
      const photo = fixtures[fixture];
      if (!photo) throw new Error(`No "${fixture}" test photo yet. Run npm run smoke first.`);
      const started = Date.now();
      try {
        const scene = await analyzeScene(client, getPack(pack), { url: photo.url }, { model });
        const seconds = (Date.now() - started) / 1000;
        console.log(`${pack.padEnd(9)} ${seconds.toFixed(1)}s  ${scene.parts.length} parts  ${scene.subject}`);
        return section(`${getPack(pack).label} pack on the ${fixture} photo`, photo.url, scene, seconds);
      } catch (error) {
        const seconds = (Date.now() - started) / 1000;
        console.log(`${pack.padEnd(9)} FAILED  ${(error as Error).message}`);
        return section(`${getPack(pack).label} pack on the ${fixture} photo`, photo.url, null, seconds, (error as Error).message);
      }
    }),
  );

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Scryle photo reader test</title><style>
  :root { color-scheme: dark; } body { margin:0; padding:24px 16px; background:#0b0b0c; color:#f2f2f2; font:15px/1.5 system-ui,sans-serif; }
  section { max-width:1200px; margin:0 auto 40px; } h2 small { color:#9a9aa2; font-weight:400; } .err { color:#ff6b6b; }
  .wrap { display:flex; gap:16px; flex-wrap:wrap; align-items:flex-start; }
  .stage { position:relative; flex:1 1 560px; max-width:760px; } .stage img { display:block; width:100%; border-radius:10px; }
  .box { position:absolute; border:2px solid #C6FF3D; border-radius:6px; background:rgba(198,255,61,.12); }
  .box span { position:absolute; left:-2px; top:-22px; background:#C6FF3D; color:#000; font-size:12px; padding:1px 6px; border-radius:4px; white-space:nowrap; }
  ul { flex:1 1 260px; margin:0; padding-left:18px; color:#c9c9cf; }
</style></head><body><h1>Scryle · photo reader test</h1>${sections.join("")}</body></html>`;
  const out = path.join(OUT_DIR, "vision.html");
  await writeFile(out, html);
  // Claude Opus 5.5 list price: $4 per million input tokens, $20 per million output tokens.
  const usd = (usage.input * 4 + usage.output * 20) / 1_000_000;
  console.log(`\nTokens: ${usage.input} in, ${usage.output} out. Cost about $${usd.toFixed(3)}.`);
  console.log(`Report: ${path.resolve(out)}`);
}

main().catch((error: unknown) => {
  console.error(`\nVision test failed: ${(error as Error).message}`);
  process.exitCode = 1;
});
