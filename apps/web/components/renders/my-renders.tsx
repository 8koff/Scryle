"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BRAND, getPack, PACKS, type PackId } from "@retrofit/core";
import { ShopLook } from "@/components/shop/shop-look";
import { CompareSlider } from "@/components/ui/compare-slider";
import type { ApiResponse, RenderCard, Reopened } from "@/lib/api";
import { browserBuildStore } from "@/lib/build/store";
import { account, useAccount } from "@/lib/account/use-account";

type Filter = PackId | "all";

type Loaded = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; renders: RenderCard[] };

const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const title = (r: RenderCard) => r.labels.join(", ") || `${getPack(r.pack).label} swap`;
/** Supabase sends the file as a download when the link asks for it. */
const downloadUrl = (r: RenderCard) => `${r.afterUrl}&download=${encodeURIComponent(`${BRAND.name.toLowerCase()}-ai-edit-${r.jobId.slice(0, 8)}.jpg`)}`;

const arrow = "grid size-9 place-items-center rounded-full border border-line text-[15px] transition-colors hover:border-fg active:scale-95";
const primary = "inline-flex h-12 items-center justify-center rounded-full bg-accent px-6 text-[16px] font-semibold text-on-accent transition-transform active:scale-[0.98]";

/** Every render the signed-in person paid for. Loaded fresh each visit, so the picture links are new. */
export function MyRenders() {
  const me = useAccount();
  const [loaded, setLoaded] = useState<Loaded>({ status: "loading" });
  const [openId, setOpenId] = useState<string | null>(null);
  const [reopening, setReopening] = useState<{ jobId: string; error?: string } | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const router = useRouter();
  const viewer = useRef<HTMLDivElement>(null);
  const signedIn = me.status === "signed-in";

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    void (async () => {
      try {
        const body = (await (await account.authFetch("/api/renders", { cache: "no-store" })).json()) as ApiResponse<{ renders: RenderCard[] }>;
        if (!live) return;
        setLoaded(body.success ? { status: "ready", renders: body.data.renders } : { status: "error", message: body.error });
      } catch {
        if (live) setLoaded({ status: "error", message: "No connection. Check your internet and try again." });
      }
    })();
    return () => {
      live = false;
    };
  }, [signedIn]);

  /** Opens the saved photo in the studio with the same swaps picked, ready to change. */
  const swapMore = async (jobId: string) => {
    setReopening({ jobId });
    try {
      const response = await account.authFetch(`/api/renders/${jobId}/reopen`, { method: "POST" });
      const body = (await response.json()) as ApiResponse<Reopened>;
      if (!body.success) return setReopening({ jobId, error: body.error });
      const { pack, photoUrl, width, height, scene, token, selections } = body.data;
      const build = browserBuildStore().create({ pack, photoUrl, width, height, scene, token, preselect: selections });
      router.push(`/app/build/${build.id}`);
    } catch {
      setReopening({ jobId, error: "No connection. Check your internet and try again." });
    }
  };

  const renders = loaded.status === "ready" ? loaded.renders : [];
  const visible = filter === "all" ? renders : renders.filter((r) => r.pack === filter);
  const index = visible.findIndex((r) => r.jobId === openId);

  const open = (jobId: string) => {
    setOpenId(jobId);
    requestAnimationFrame(() => viewer.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  /** Next or previous render in the viewer, wrapping round at the ends. */
  const step = (by: number) => {
    if (index < 0 || !visible.length) return;
    setOpenId(visible[(index + by + visible.length) % visible.length]!.jobId);
  };

  // ← → flip through renders while one is open, Escape closes it.
  useEffect(() => {
    if (index < 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "Escape") setOpenId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (me.status === "loading") return <Skeleton />;
  if (me.status === "unavailable") return <Message text="Accounts aren't set up yet." />;
  // The app only shows this page when signed in.
  if (me.status === "signed-out") return null;
  if (loaded.status === "loading") return <Skeleton />;
  if (loaded.status === "error") return <Message text={loaded.message} />;
  if (!loaded.renders.length) {
    return (
      <div className="flex flex-col items-start gap-5">
        <p className="max-w-md text-[17px] text-muted">No swaps yet. Take a photo, pick a swap, and it shows up here.</p>
        <Link href="/app" className={primary}>
          Take a photo
        </Link>
      </div>
    );
  }

  const shown = index >= 0 ? visible[index]! : null;
  const counts = PACKS.map((p) => ({ id: p.id, label: p.label, n: renders.filter((r) => r.pack === p.id).length })).filter((c) => c.n > 0);

  return (
    <div className="flex flex-col gap-8">
      {counts.length > 1 && (
        <div role="radiogroup" aria-label="Show" className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
          {[{ id: "all" as const, label: "All", n: renders.length }, ...counts].map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={filter === c.id}
              onClick={() => {
                setFilter(c.id);
                setOpenId(null);
              }}
              className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-4 text-[14px] font-semibold transition-colors ${
                filter === c.id ? "border-fg bg-fg text-bg" : "border-line text-muted hover:border-muted hover:text-fg"
              }`}
            >
              {c.label}
              <span className={`tabular-nums ${filter === c.id ? "text-bg/60" : "text-muted"}`}>{c.n}</span>
            </button>
          ))}
        </div>
      )}

      {shown && (
        <div ref={viewer} className="grid scroll-mt-20 gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
          <div className="mx-auto w-full" style={{ maxWidth: `min(100%, calc(70svh * ${shown.width / shown.height}))` }}>
            <CompareSlider
              key={shown.jobId}
              before={shown.beforeUrl}
              after={shown.afterUrl}
              beforeAlt="Your photo before"
              afterAlt={`Your photo with ${title(shown).toLowerCase()}`}
              aspect={shown.width / shown.height}
              intro
              unoptimized
              className="photo-edge rounded-[28px]"
            />
          </div>
          <div className="flex flex-col gap-4">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <button type="button" onClick={() => step(-1)} aria-label="Previous swap" className={arrow}>
                  ←
                </button>
                <button type="button" onClick={() => step(1)} aria-label="Next swap" className={arrow}>
                  →
                </button>
                <span className="ml-1 text-[13px] tabular-nums text-muted">
                  {index + 1} of {visible.length}
                </span>
              </div>
              <p className="text-[14px] font-medium text-muted">
                {getPack(shown.pack).label} · {dateFormat.format(new Date(shown.createdAt))}
              </p>
              <h2 className="display mt-1 text-[1.9rem] font-semibold">{title(shown)}</h2>
            </div>
            <div className="flex flex-wrap gap-3">
              {shown.canReopen && (
                <button type="button" onClick={() => swapMore(shown.jobId)} disabled={reopening?.jobId === shown.jobId && !reopening.error} className={`${primary} disabled:opacity-60`}>
                  {reopening?.jobId === shown.jobId && !reopening.error ? "Opening…" : "Swap more"}
                </button>
              )}
              <a
                href={downloadUrl(shown)}
                className="inline-flex h-12 items-center rounded-full bg-surface-2 px-6 text-[16px] font-semibold transition-colors hover:bg-line"
              >
                Download
              </a>
              <button
                type="button"
                onClick={() => setOpenId(null)}
                className="inline-flex h-12 items-center rounded-full px-5 text-[16px] font-semibold transition-colors hover:bg-surface-2"
              >
                Close
              </button>
            </div>
            {reopening?.jobId === shown.jobId && reopening.error && (
              <p role="alert" className="text-[14px] font-medium text-accent-ink">
                {reopening.error}
              </p>
            )}
            <ShopLook key={`shop-${shown.jobId}`} selections={shown.selections} />
          </div>
        </div>
      )}

      <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
        {visible.map((r) => (
          <li key={r.jobId}>
            <button type="button" onClick={() => open(r.jobId)} aria-pressed={r.jobId === openId} className="group block w-full text-left">
              <span className="relative block aspect-[4/5] overflow-hidden rounded-[20px] bg-surface-2 ring-accent ring-offset-2 ring-offset-bg group-aria-pressed:ring-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- signed, short-lived storage link */}
                <img
                  src={r.afterUrl}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover transition-transform duration-300 ease-(--ease-out) group-hover:scale-[1.02]"
                />
                {/* Hover (on a mouse) flips the card to the photo as it was. */}
                {/* eslint-disable-next-line @next/next/no-img-element -- signed, short-lived storage link */}
                <img
                  src={r.beforeUrl}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 hidden size-full object-cover opacity-0 transition-opacity duration-200 [@media(hover:hover)]:block [@media(hover:hover)]:group-hover:opacity-100"
                />
                <span className="absolute left-2.5 top-2.5 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white opacity-0 backdrop-blur-md transition-opacity duration-200 [@media(hover:hover)]:group-hover:opacity-100">
                  Before
                </span>
              </span>
              <span className="mt-2 block truncate text-[15px] font-semibold">{title(r)}</span>
              <span className="block text-[13px] text-muted">
                {getPack(r.pack).label} · {dateFormat.format(new Date(r.createdAt))}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Message({ text }: { text: string }) {
  return (
    <p role="alert" className="text-[17px] text-muted">
      {text}
    </p>
  );
}

function Skeleton() {
  return (
    <ul aria-hidden className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <li key={i} className="aspect-[4/5] animate-pulse rounded-[20px] bg-surface-2" />
      ))}
    </ul>
  );
}
