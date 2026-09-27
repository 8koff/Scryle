/**
 * P0 gate: can Higgsfield swap one item in a real photo without changing anything else?
 *
 *   npm run smoke                              # price the run, then run it if under the cap
 *   npm run smoke -- --models=qwen-1k          # some models
 *   npm run smoke -- --cases=car-wheels        # some cases
 *   npm run smoke -- --max-usd=2               # raise the spending cap (default $0.50)
 *   npm run smoke -- --dry-run                 # only print the price, spend nothing
 *   npm run smoke -- --fresh                   # re-make the stand-in test photos
 *   npm run smoke -- --combine                 # send all products as one combined image (cheaper)
 *
 * Every request is priced with Higgsfield's free estimate call first. The run stops
 * before spending anything if the total is over the cap.
 * Writes .smoke/report.html — open it and judge the results by eye.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildEditPrompt } from "@retrofit/core";
import { higgsfieldFromEnv, type HiggsfieldClient } from "../lib/server/higgsfield/client";
import { buildEditRequest, EDIT_MODELS, type EditModelId } from "../lib/server/higgsfield/models";
import { combineProducts } from "../lib/server/render/collage";
import { SMOKE_CASES, type ImageSource, type SmokeCase } from "./smoke/cases";
import { createFixtureResolver, download, generationBody, GENERATOR, type ResolvedImage } from "./smoke/fixtures";
import { renderReport, type RenderResult, type ReportCase } from "./smoke/report";

const OUT_DIR = ".smoke";
const IMG_DIR = path.join(OUT_DIR, "img");
const CONCURRENCY = 4;
const DEFAULT_MAX_USD = 0.5;
/** Stand-in URL for pricing images that don't exist yet; the estimate only counts them. */
const PLACEHOLDER = "https://example.com/placeholder.jpg";

function parseArgs(argv: string[]) {
  const get = (name: string) => argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
  const list = (name: string) => get(name)?.split(",").filter(Boolean);
  const models = (list("models") ?? Object.keys(EDIT_MODELS)) as EditModelId[];
  for (const m of models) if (!(m in EDIT_MODELS)) throw new Error(`Unknown model "${m}". Use: ${Object.keys(EDIT_MODELS).join(", ")}`);
  const caseIds = list("cases");
  const cases = caseIds ? SMOKE_CASES.filter((c) => caseIds.includes(c.id)) : SMOKE_CASES;
  if (cases.length === 0) throw new Error(`No matching cases. Use: ${SMOKE_CASES.map((c) => c.id).join(", ")}`);
  const maxUsd = get("max-usd") ? Number(get("max-usd")) : DEFAULT_MAX_USD;
  if (!Number.isFinite(maxUsd) || maxUsd < 0) throw new Error("--max-usd must be a number");
  return {
    models,
    cases,
    maxUsd,
    fresh: argv.includes("--fresh"),
    dryRun: argv.includes("--dry-run"),
    combine: argv.includes("--combine"),
  };
}

async function saveLocal(url: string, name: string): Promise<string> {
  const ext = path.extname(new URL(url).pathname) || ".png";
  const file = `${name}${ext}`;
  await writeFile(path.join(IMG_DIR, file), await download(url));
  return `img/${file}`;
}

type Task = { smokeCase: SmokeCase; model: EditModelId; costUsd: number };

async function runOne(
  client: HiggsfieldClient,
  { smokeCase, model, costUsd }: Task,
  prompt: string,
  scene: ResolvedImage,
  productUrls: string[],
  suffix: string,
): Promise<RenderResult> {
  const info = EDIT_MODELS[model];
  const base = { caseId: smokeCase.id, model, modelLabel: info.label };
  const started = Date.now();
  try {
    const { endpoint, body } = buildEditRequest(model, {
      prompt,
      imageUrls: [scene.url, ...productUrls],
      width: scene.width,
      height: scene.height,
    });
    const { requestId } = await client.submit(endpoint, body);
    const done = await client.waitFor(requestId, { intervalMs: 3000, timeoutMs: 6 * 60_000 });
    const seconds = (Date.now() - started) / 1000;
    const url = done.images?.[0];
    if (done.status !== "completed" || !url) return { ...base, status: done.status, seconds, note: done.error };
    const image = await saveLocal(url, `${smokeCase.id}--${model}${suffix}`);
    return { ...base, status: "completed", seconds, costUsd, image, remoteUrl: url };
  } catch (error) {
    return { ...base, status: "error", seconds: (Date.now() - started) / 1000, note: (error as Error).message };
  }
}

async function pool<T>(tasks: Array<() => Promise<T>>, size: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(size, tasks.length) }, async () => {
    while (next < tasks.length) {
      const index = next++;
      results[index] = await tasks[index]!();
    }
  });
  await Promise.all(workers);
  return results;
}

async function main() {
  const { models, cases, maxUsd, fresh, dryRun, combine } = parseArgs(process.argv.slice(2));
  const suffix = combine ? "-combined" : "";
  const client = higgsfieldFromEnv();
  await mkdir(IMG_DIR, { recursive: true });
  const fixtures = await createFixtureResolver(client, path.join(OUT_DIR, "fixtures.json"), fresh);

  // 1. Price everything before spending anything.
  const toGenerate = new Map<string, ImageSource>();
  for (const c of cases) {
    for (const source of [c.scene, ...c.swaps.flatMap((s) => (s.image ? [s.image] : []))]) {
      if (fixtures.needsGeneration(source)) toGenerate.set(source.key, source);
    }
  }
  const lines: Array<{ item: string; usd: number }> = [];
  for (const source of toGenerate.values()) {
    const { usd } = await client.estimate(GENERATOR, generationBody(source));
    lines.push({ item: `test photo: ${source.key}`, usd });
  }

  const tasks: Task[] = [];
  const skipped: RenderResult[] = [];
  for (const c of cases) {
    const productCount = c.swaps.filter((s) => s.image).length;
    const imageCount = 1 + (combine && productCount > 1 ? 1 : productCount);
    const size = fixtures.known(c.scene) ?? { width: 3, height: 4 };
    for (const model of models) {
      const info = EDIT_MODELS[model];
      if (imageCount > info.maxImages) {
        skipped.push({ caseId: c.id, model, modelLabel: info.label, status: "skipped", note: `needs ${imageCount} images, model takes ${info.maxImages}` });
        continue;
      }
      const { endpoint, body } = buildEditRequest(model, {
        prompt: "price check",
        imageUrls: Array.from({ length: imageCount }, () => PLACEHOLDER),
        ...size,
      });
      const { usd } = await client.estimate(endpoint, body);
      tasks.push({ smokeCase: c, model, costUsd: usd });
      lines.push({ item: `${c.id} × ${model}`, usd });
    }
  }

  const total = lines.reduce((sum, l) => sum + l.usd, 0);
  console.table(lines.map((l) => ({ item: l.item, price: `$${l.usd.toFixed(3)}` })));
  console.log(`\nThis run will cost about $${total.toFixed(2)} (cap: $${maxUsd.toFixed(2)}).`);
  if (dryRun) return console.log("Dry run: nothing was spent.");
  if (total > maxUsd) {
    console.log(`Stopped: over the cap. Nothing was spent. Rerun with --max-usd=${Math.ceil(total * 100) / 100} to allow it.`);
    process.exitCode = 1;
    return;
  }

  // 2. Make any missing test photos.
  console.log(`\nPreparing test photos for ${cases.length} cases...`);
  const prepared = await Promise.all(
    cases.map(async (c) => {
      const scene = await fixtures.resolve(c.scene);
      const products = await Promise.all(c.swaps.map((s) => (s.image ? fixtures.resolve(s.image) : null)));
      const withImages = products.filter((p): p is ResolvedImage => p !== null);
      const prompt = buildEditPrompt({ subject: c.subject, swaps: c.swaps, locks: c.locks, productsInOneImage: combine });
      let productUrls = withImages.map((p) => p.url);
      if (combine && withImages.length > 1) {
        const collage = await combineProducts(await Promise.all(withImages.map((p) => download(p.url))));
        productUrls = [await client.uploadBytes(collage, "image/jpeg")];
      }
      return { c, scene, products, prompt, productUrls };
    }),
  );
  const byCase = new Map(prepared.map((p) => [p.c.id, p]));

  const reportCases: ReportCase[] = await Promise.all(
    prepared.map(async ({ c, scene, products, prompt }) => ({
      id: c.id,
      title: c.title,
      prompt,
      scene: await saveLocal(scene.url, `input-${scene.key}`),
      products: await Promise.all(
        c.swaps.map(async (s, i) => ({
          label: s.product,
          image: products[i] ? await saveLocal(products[i]!.url, `input-${products[i]!.key}`) : null,
        })),
      ),
    })),
  );

  // 3. Run the renders.
  console.log(`Running ${tasks.length} renders, ${CONCURRENCY} at a time...`);
  const results = await pool(
    tasks.map((task) => () => {
      const { scene, prompt, productUrls } = byCase.get(task.smokeCase.id)!;
      console.log(`  → ${task.smokeCase.id} × ${task.model}`);
      return runOne(client, task, prompt, scene, productUrls, suffix);
    }),
    CONCURRENCY,
  );
  const all = [...results, ...skipped];

  await writeFile(path.join(OUT_DIR, `results${suffix}.json`), JSON.stringify(all, null, 2));
  const reportPath = path.join(OUT_DIR, `report${suffix}.html`);
  await writeFile(reportPath, renderReport(reportCases, all, new Date()));

  console.table(
    all.map((r) => ({
      case: r.caseId,
      model: r.model,
      status: r.status,
      seconds: r.seconds?.toFixed(0) ?? "",
      price: r.costUsd !== undefined ? `$${r.costUsd.toFixed(3)}` : "",
      note: r.note?.slice(0, 60) ?? "",
    })),
  );
  const spent = all.filter((r) => r.status === "completed").reduce((s, r) => s + (r.costUsd ?? 0), 0);
  console.log(`\nRenders cost about $${spent.toFixed(2)} (failed renders are refunded by Higgsfield).`);
  console.log(`Report: ${path.resolve(reportPath)}`);
}

main().catch((error: unknown) => {
  const message = (error as Error).message;
  console.error(`\nSmoke test failed: ${message}`);
  if (message.includes("not_enough_credits")) {
    console.error("Your Higgsfield balance is empty. Top up at https://console.higgsfield.ai (minimum $5), then run again.");
  }
  // Not process.exit(): on Windows it can crash while fetch sockets are still closing.
  process.exitCode = 1;
});
