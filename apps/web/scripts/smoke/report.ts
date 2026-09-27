export type RenderResult = {
  caseId: string;
  model: string;
  modelLabel: string;
  status: "completed" | "failed" | "nsfw" | "skipped" | "error" | string;
  seconds?: number;
  costUsd?: number;
  /** Local path relative to the report, when downloaded. */
  image?: string;
  remoteUrl?: string;
  note?: string;
};

export type ReportCase = {
  id: string;
  title: string;
  prompt: string;
  scene: string;
  products: Array<{ label: string; image: string | null }>;
};

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

function resultCard(r: RenderResult): string {
  const ok = r.status === "completed" && r.image;
  const meta = [
    r.seconds !== undefined ? `${r.seconds.toFixed(0)}s` : "",
    r.costUsd !== undefined && r.status === "completed" ? `$${r.costUsd.toFixed(3)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return `<figure class="card ${ok ? "" : "bad"}">
    ${ok ? `<a href="${esc(r.image!)}" target="_blank"><img src="${esc(r.image!)}" loading="lazy"></a>` : `<div class="empty">${esc(r.status)}</div>`}
    <figcaption><b>${esc(r.modelLabel)}</b><span>${esc(meta)}</span>${r.note ? `<small>${esc(r.note)}</small>` : ""}</figcaption>
  </figure>`;
}

export function renderReport(cases: ReportCase[], results: RenderResult[], generatedAt: Date): string {
  const totalUsd = results.filter((r) => r.status === "completed").reduce((sum, r) => sum + (r.costUsd ?? 0), 0);
  const sections = cases
    .map((c) => {
      const inputs = [
        `<figure class="card input"><img src="${esc(c.scene)}"><figcaption><b>Original</b></figcaption></figure>`,
        ...c.products.map((p) =>
          p.image
            ? `<figure class="card input"><img src="${esc(p.image)}"><figcaption><b>Product</b><span>${esc(p.label)}</span></figcaption></figure>`
            : `<figure class="card input"><div class="empty">words only</div><figcaption><b>Change</b><span>${esc(p.label)}</span></figcaption></figure>`,
        ),
      ].join("");
      const outputs = results.filter((r) => r.caseId === c.id).map(resultCard).join("");
      return `<section>
        <h2>${esc(c.title)}</h2>
        <div class="row">${inputs}</div>
        <div class="row">${outputs}</div>
        <details><summary>Prompt sent</summary><pre>${esc(c.prompt)}</pre></details>
      </section>`;
    })
    .join("");

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Scryle P0 render test</title>
<style>
  :root { color-scheme: dark; --bg:#0b0b0c; --panel:#161618; --line:#2a2a2e; --text:#f2f2f2; --dim:#9a9aa2; --accent:#C6FF3D; --bad:#ff6b6b; }
  * { box-sizing: border-box; }
  body { margin:0; padding:24px 16px 64px; background:var(--bg); color:var(--text); font:15px/1.5 system-ui, sans-serif; }
  header { max-width:1400px; margin:0 auto 24px; }
  h1 { margin:0 0 4px; font-size:22px; } h1 span { color:var(--accent); }
  header p { margin:0; color:var(--dim); }
  section { max-width:1400px; margin:0 auto 40px; padding-top:16px; border-top:1px solid var(--line); }
  h2 { font-size:17px; margin:0 0 12px; }
  .row { display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:12px; margin-bottom:12px; }
  .card { margin:0; background:var(--panel); border:1px solid var(--line); border-radius:12px; overflow:hidden; }
  .card.input { opacity:.85; }
  .card.bad { border-color:var(--bad); }
  .card img { display:block; width:100%; aspect-ratio:3/4; object-fit:contain; background:#000; }
  .empty { aspect-ratio:3/4; display:grid; place-items:center; color:var(--dim); text-transform:uppercase; font-size:12px; letter-spacing:.08em; }
  figcaption { padding:8px 10px; display:flex; flex-direction:column; gap:2px; }
  figcaption span, figcaption small { color:var(--dim); font-size:13px; }
  details { color:var(--dim); } pre { white-space:pre-wrap; background:var(--panel); padding:12px; border-radius:8px; }
</style></head><body>
<header>
  <h1>Scryle · <span>P0 render test</span></h1>
  <p>${esc(generatedAt.toLocaleString())} · ${results.length} renders · total spend $${totalUsd.toFixed(2)}.
  Look for: same person / car / room, only the listed items changed. Tap an image to open it full size.</p>
</header>
${sections}
</body></html>`;
}
