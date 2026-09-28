"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getPack, type SceneAnalysis } from "@retrofit/core";
import { BuySheet } from "@/components/account/buy-sheet";
import { ShopLook } from "@/components/shop/shop-look";
import type { Account } from "@/lib/account/account-store";
import { account, useAccount } from "@/lib/account/use-account";
import type { ApiResponse, RenderStart, RenderStatus } from "@/lib/api";
import { studioParts } from "@/lib/build/parts";
import { browserBuildStore, type Version } from "@/lib/build/store";
import { useBuild } from "@/lib/build/use-build";
import { remixChoices, type Chosen } from "@/lib/build/remix";
import type { Product } from "@/lib/catalog/catalog";
import { FITS, type Fit, type LiveProduct } from "@/lib/shop/live";
import { seenProducts } from "@/lib/shop/seen";
import { styleWordsFrom } from "@/lib/shop/terms";
import { useLiveProducts } from "@/lib/shop/use-live-products";
import { LooksRow } from "./looks-row";
import { PartRow, partRowId } from "./part-row";
import { PicksTray } from "./picks-tray";
import { RenderProgress } from "./render-progress";
import { ShopSearch } from "./shop-search";
import { ShareButton } from "./share-button";
import { Stage } from "./stage";
import { VersionStrip } from "./version-strip";

const POLL_MS = 2500;
/** Give up after about six minutes; Higgsfield refunds renders that never finish. */
const MAX_POLLS = 150;
const DONE = new Set(["completed", "failed", "nsfw", "canceled"]);

const newId = () => Math.random().toString(36).slice(2, 10);
/** Parts whose store products load straight after the scan; the rest load when opened (each new search costs one). */
const AUTO_ROWS = 3;
/** A render takes at most this many swaps (the server checks the same). */
const MAX_PICKS = 6;
const FIT_LABELS: Record<Fit, string> = { women: "Women", men: "Men", any: "Any" };

/** The fit the photo reader saw, as the starting filter for clothing searches. */
const sceneFit = (scene: SceneAnalysis): Fit | undefined => {
  const fit = scene.details?.fit;
  return fit === "men" || fit === "women" ? fit : undefined;
};

export function Studio({ id }: { id: string }) {
  const build = useBuild(id);
  const [activePartId, setActivePartId] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Record<string, Chosen>>({});
  /** The look last applied, until a single pick changes it. */
  const [lookId, setLookId] = useState<string | null>(null);
  const [shownId, setShownId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isBuying, setIsBuying] = useState(false);
  /** Style words from the latest pick or search; parts with no pick yet search with them. */
  const [style, setStyle] = useState("");
  /** The search words that found each part's pick, so its row keeps showing it. */
  const [pickedWords, setPickedWords] = useState<Record<string, string>>({});
  /** Parts past the first few whose store products were asked for. */
  const [opened, setOpened] = useState<string[]>([]);
  const [fitChoice, setFitChoice] = useState<Fit | undefined>(undefined);
  const me = useAccount();

  const pack = build ? getPack(build.pack) : null;
  const parts = useMemo(() => (build && pack ? studioParts(pack, build.scene) : []), [build, pack]);

  // "Try this on me": pick the shared swaps once, as soon as the build and any store products in it have loaded.
  const [preselectedFor, setPreselectedFor] = useState<string | null>(null);
  const preselectReady = useLiveProducts(build?.preselect);
  if (build && preselectReady && preselectedFor !== build.id) {
    setPreselectedFor(build.id);
    if (build.preselect?.length && !build.versions.length) setChosen(remixChoices(build.pack, parts, build.preselect));
  }
  const rendering = build?.versions.find((v) => v.status === "rendering");

  const jobId = rendering?.jobId;
  const jobToken = rendering?.jobToken;
  const renderingId = rendering?.id;

  // Poll the in-flight render until it finishes, then show it.
  useEffect(() => {
    if (!jobId || !jobToken || !renderingId) return;
    const versionId = renderingId;
    let stopped = false;
    let polls = 0;
    const markFailed = (message: string) =>
      browserBuildStore().update(id, (b) => ({
        ...b,
        versions: b.versions.map((v): Version => (v.id === versionId ? { ...v, status: "failed", error: message } : v)),
      }));
    const poll = async () => {
      if (stopped) return;
      if (++polls > MAX_POLLS) {
        stopped = true;
        markFailed("The swap took too long. Please try again.");
        setNotice("The swap took too long. Please try again.");
        return;
      }
      try {
        const response = await fetch(`/api/swap/${jobId}?t=${encodeURIComponent(jobToken)}`, { cache: "no-store" });
        const body = (await response.json()) as ApiResponse<RenderStatus>;
        if (stopped || !body.success || !DONE.has(body.data.status)) return; // try again next tick
        stopped = true;
        const { status, imageUrl } = body.data;
        const ok = status === "completed" && Boolean(imageUrl);
        browserBuildStore().update(id, (b) => ({
          ...b,
          versions: b.versions.map((v): Version =>
            v.id === versionId
              ? {
                  ...v,
                  status: ok ? "done" : "failed",
                  imageUrl: ok ? imageUrl : undefined,
                  error: ok ? undefined : status === "nsfw" ? "That swap was blocked by the safety filter." : "The swap failed. You weren't charged.",
                }
              : v,
          ),
        }));
        if (ok) setShownId(versionId);
        else void account.refreshCredits(); // the credit came back
        if (!ok) setNotice(status === "nsfw" ? "That swap was blocked by the safety filter." : "The swap failed. Please try again.");
      } catch {
        // Network hiccup: the next tick retries.
      }
    };
    const timer = window.setInterval(poll, POLL_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [id, jobId, jobToken, renderingId]);

  if (build === undefined) return <div className="flex-1" />;
  if (build === null || !pack) {
    return (
      <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <h1 className="display text-[2.4rem] font-semibold">This photo is closed</h1>
        <p className="text-muted">A photo stays open for edits for one day. Your swaps are kept in My swaps, and you can open any of them again from there with Swap more.</p>
        <div className="mt-2 flex gap-3">
          <Link href="/app/renders" className="inline-flex h-12 items-center rounded-full bg-accent px-7 font-semibold text-on-accent">
            My swaps
          </Link>
          <Link href="/app" className="inline-flex h-12 items-center rounded-full px-5 font-semibold hover:bg-surface-2">
            New photo
          </Link>
        </div>
      </div>
    );
  }

  const shown = build.versions.find((v) => v.id === shownId) ?? null;
  const picks = Object.values(chosen);
  const aspect = build.width / build.height;
  const fit = fitChoice ?? sceneFit(build.scene);
  const isColourOnly = (partId: string) => Boolean(pack.parts.find((p) => p.id === partId)?.textOnly);
  const shoppable = parts.filter((p) => !isColourOnly(p.id));
  const autoOpen = new Set(shoppable.slice(0, AUTO_ROWS).map((p) => p.id));
  /**
   * The words each row searches with. A picked row keeps what found its pick. The style only
   * reaches the first rows and the part being looked at, so one pick costs at most a few searches.
   */
  const rowWords = (partId: string) => {
    if (chosen[partId]) return pickedWords[partId] ?? "";
    return autoOpen.has(partId) || activePartId === partId ? style : "";
  };
  const selectedId = (partId: string) => {
    const input = chosen[partId]?.input;
    return input && "productId" in input ? input.productId : undefined;
  };

  /** Puts one swap on a part. The style of what was picked steers the other parts' suggestions. */
  const choose = (partId: string, c: Chosen, words = "") => {
    if (!chosen[partId] && picks.length >= MAX_PICKS) {
      setNotice(`You can swap up to ${MAX_PICKS} parts at once. Take one out first.`);
      return;
    }
    setNotice(null);
    setChosen((prev) => ({ ...prev, [partId]: c }));
    setPickedWords((prev) => ({ ...prev, [partId]: words }));
    const picked = styleWordsFrom(`${words} ${c.label}`);
    if (picked) setStyle(picked);
    setLookId(null);
    setShownId(null);
  };
  const pickProduct = (partId: string, product: Product, words = rowWords(partId)) => {
    // Found products are kept in this browser, so the cart and "Shop this look" can show them later.
    if (product.kind === "live") seenProducts.remember([product as LiveProduct]);
    choose(partId, { input: { partId, productId: product.id }, label: product.title, image: product.image, swatch: product.swatch }, words);
  };
  const clear = (partId: string) => {
    const without = <T,>(record: Record<string, T>) => Object.fromEntries(Object.entries(record).filter(([k]) => k !== partId));
    setChosen(without);
    setPickedWords(without);
    setLookId(null);
  };
  const applyLook = (id: string, picks: Record<string, Chosen>) => {
    setChosen(picks);
    setPickedWords({});
    setStyle(styleWordsFrom(id.replace(/^[a-z]+-/, "")));
    setLookId(id);
    setShownId(null);
  };
  /** Tapping a part on the photo (or its chip) opens its row and scrolls to it. */
  const showPart = (partId: string) => {
    setActivePartId(partId);
    setOpened((prev) => (prev.includes(partId) ? prev : [...prev, partId]));
    window.requestAnimationFrame(() => document.getElementById(partRowId(partId))?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const render = async () => {
    if (!picks.length || rendering || me.status !== "signed-in") return;
    if (me.credits === 0) return setIsBuying(true);
    setNotice(null);
    setShownId(null);
    const versionId = newId();
    const store = browserBuildStore();
    store.update(id, (b) => ({
      ...b,
      versions: [...b.versions, { id: versionId, selections: picks.map((p) => p.input), labels: picks.map((p) => p.label), status: "rendering" }],
    }));

    let started: ApiResponse<RenderStart>;
    try {
      const response = await account.authFetch("/api/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claim: { photoUrl: build.photoUrl, pack: build.pack, width: build.width, height: build.height, scene: build.scene },
          token: build.token,
          selections: picks.map((p) => p.input),
        }),
      });
      started = (await response.json()) as ApiResponse<RenderStart>;
    } catch {
      started = { success: false, error: "No connection. Check your internet and try again." };
    }

    // Needs credits (or the sign-in ran out): not a failed render, so drop it and say what to do.
    if (!started.success && started.code) {
      store.update(id, (b) => ({ ...b, versions: b.versions.filter((v) => v.id !== versionId) }));
      if (started.code === "sign_in") setNotice("Please sign in again.");
      else setIsBuying(true);
      return;
    }
    void account.refreshCredits();

    store.update(id, (b) => ({
      ...b,
      versions: b.versions.map((v): Version =>
        v.id !== versionId
          ? v
          : started.success
            ? { ...v, jobId: started.data.jobId, jobToken: started.data.jobToken }
            : { ...v, status: "failed", error: started.error },
      ),
    }));
    if (!started.success) setNotice(started.error);
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto flex h-12 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link href={`/app?pack=${build.pack}`} className="text-[14px] font-medium text-muted hover:text-fg">
          ← New photo
        </Link>
        <span aria-hidden className="text-line">/</span>
        <p className="text-[14px] font-semibold">{pack.label}</p>
      </div>

      <div className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-6 px-4 pb-40 sm:px-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-10 lg:pb-10">
        <section className="flex flex-col gap-4">
          <div className="mx-auto w-full" style={{ maxWidth: `min(100%, calc(50svh * ${aspect}))` }}>
            <Stage
              build={build}
              parts={parts}
              activePartId={activePartId}
              onPickPart={showPart}
              shown={shown}
              isRendering={Boolean(rendering)}
              previews={picks.map((p) => ({ partId: p.input.partId, image: p.image, swatch: p.swatch }))}
            />
          </div>
          <VersionStrip build={build} shownId={shownId} onShow={setShownId} />
          {shown?.status === "done" && (
            <>
              <ShopLook key={`shop-${shown.id}`} selections={shown.selections} />
              <ShareButton key={shown.id} build={build} version={shown} />
              <p className="text-center text-[13px] text-muted">
                Saved to{" "}
                <Link href="/app/renders" className="font-semibold text-fg underline-offset-4 hover:underline">
                  My swaps
                </Link>
              </p>
            </>
          )}
          {rendering ? (
            <RenderProgress key={rendering.id} labels={rendering.labels} />
          ) : (
            <p aria-live="polite" className="min-h-5 text-center text-[14px] text-muted">
              {notice}
            </p>
          )}
        </section>

        <aside className="flex flex-col gap-5">
          <LooksRow pack={build.pack} parts={parts} activeId={lookId} onApply={applyLook} />
          <nav aria-label="Parts" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:px-0">
            {parts.map((part) => (
              <button
                key={part.id}
                type="button"
                onClick={() => showPart(part.id)}
                aria-pressed={activePartId === part.id}
                className={`h-10 shrink-0 rounded-full px-4 text-[14px] font-semibold transition-colors ${
                  activePartId === part.id ? "bg-fg text-bg" : chosen[part.id] ? "bg-accent/15 text-accent-ink" : "bg-surface-2 text-fg hover:bg-line"
                }`}
              >
                {part.label}
                {chosen[part.id] && <span className="ml-1.5">•</span>}
              </button>
            ))}
          </nav>

          <ShopSearch
            build={build}
            shoppable={shoppable}
            parts={parts}
            fit={fit}
            selectedId={selectedId}
            onPick={(partId, product, words) => {
              pickProduct(partId, product, words);
              showPart(partId);
            }}
            onDescribe={(partId, text) => choose(partId, { input: { partId, text }, label: text }, text)}
          />

          <section aria-labelledby="suggested-title" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="suggested-title" className="text-[13px] font-semibold text-muted">
                {style ? (
                  <>
                    Suggested to match <span className="text-fg">“{style}”</span>{" "}
                    <button type="button" onClick={() => setStyle("")} className="ml-1 font-medium underline-offset-4 hover:text-fg hover:underline">
                      Clear
                    </button>
                  </>
                ) : (
                  "Suggested for your photo"
                )}
              </h2>
              {build.pack === "clothing" && (
                <div role="group" aria-label="Fit" className="flex gap-1">
                  {FITS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      aria-pressed={(fit ?? "any") === f}
                      onClick={() => setFitChoice(f)}
                      className={`h-8 rounded-full px-3 text-[13px] font-semibold transition-colors ${
                        (fit ?? "any") === f ? "bg-fg text-bg" : "bg-surface-2 text-fg hover:bg-line"
                      }`}
                    >
                      {FIT_LABELS[f]}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {parts.map((part) => (
              <PartRow
                key={part.id}
                build={build}
                part={part}
                isColourOnly={isColourOnly(part.id)}
                words={rowWords(part.id)}
                fit={fit}
                isOpen={autoOpen.has(part.id) || opened.includes(part.id)}
                isActive={activePartId === part.id}
                chosen={chosen[part.id]}
                onOpen={showPart}
                onPick={(partId, product) => pickProduct(partId, product)}
                onClear={clear}
              />
            ))}
            <p className="text-[12px] text-muted">Prices as the stores listed them. We may earn a commission.</p>
          </section>

          <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/90 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl lg:static lg:border-0 lg:bg-transparent lg:p-0">
            <PicksTray parts={parts} chosen={chosen} onShow={showPart} onRemove={clear} />
            <button
              type="button"
              onClick={() => render()}
              disabled={!picks.length || Boolean(rendering)}
              className="h-12 w-full rounded-full bg-accent text-[16px] font-semibold text-on-accent transition-[transform,opacity] active:scale-[0.98] disabled:opacity-45"
            >
              {rendering
                ? "Swapping…"
                : picks.length > 1
                  ? `See all ${picks.length} on my photo`
                  : picks.length
                    ? "See it on my photo"
                    : "Pick something to swap"}
            </button>
            <p className="mt-2 text-center text-[13px] text-muted">{costLine(me)}</p>
          </div>
        </aside>
      </div>

      <BuySheet open={isBuying} onClose={() => setIsBuying(false)} returnTo={`/app/build/${id}`} />
    </div>
  );
}

/** The small line under the render button: what this render costs you. */
function costLine(me: Account): string {
  if (me.status === "signed-out") return "Your first swap is free.";
  if (me.status !== "signed-in" || me.credits === null) return " ";
  if (me.credits === 0) return "You're out of swaps.";
  return `Uses 1 of your ${me.credits} swap${me.credits === 1 ? "" : "s"}.`;
}
