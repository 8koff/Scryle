"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BRAND, getPack } from "@retrofit/core";
import { SignInSheet } from "@/components/account/sign-in-sheet";
import { ShopLook } from "@/components/shop/shop-look";
import { CompareSlider } from "@/components/ui/compare-slider";
import type { ApiResponse, RenderCard, Reopened } from "@/lib/api";
import { browserBuildStore } from "@/lib/build/store";
import { account, useAccount } from "@/lib/account/use-account";

type Loaded = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; renders: RenderCard[] };

const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const title = (r: RenderCard) => r.labels.join(", ") || `${getPack(r.pack).label} swap`;
/** Supabase sends the file as a download when the link asks for it. */
const downloadUrl = (r: RenderCard) => `${r.afterUrl}&download=${encodeURIComponent(`${BRAND.name.toLowerCase()}-ai-edit-${r.jobId.slice(0, 8)}.jpg`)}`;

const primary = "inline-flex h-12 items-center justify-center rounded-full bg-accent px-6 text-[16px] font-semibold text-on-accent transition-transform active:scale-[0.98]";

/** Every render the signed-in person paid for. Loaded fresh each visit, so the picture links are new. */
export function MyRenders() {
  const me = useAccount();
  const [loaded, setLoaded] = useState<Loaded>({ status: "loading" });
  const [openId, setOpenId] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [reopening, setReopening] = useState<{ jobId: string; error?: string } | null>(null);
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
      router.push(`/build/${build.id}`);
    } catch {
      setReopening({ jobId, error: "No connection. Check your internet and try again." });
    }
  };

  const open = (jobId: string) => {
    setOpenId(jobId);
    requestAnimationFrame(() => viewer.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  if (me.status === "loading") return <Skeleton />;
  if (me.status === "unavailable") return <Message text="Accounts aren't set up yet." />;
  if (me.status === "signed-out") {
    return (
      <div className="flex flex-col items-start gap-5">
        <p className="max-w-md text-[17px] text-muted">Sign in to see every swap you have made. They stay in your account.</p>
        <button type="button" onClick={() => setSigningIn(true)} className={primary}>
          Sign in
        </button>
        <SignInSheet open={signingIn} onClose={() => setSigningIn(false)} onSignedIn={() => setSigningIn(false)} />
      </div>
    );
  }
  if (loaded.status === "loading") return <Skeleton />;
  if (loaded.status === "error") return <Message text={loaded.message} />;
  if (!loaded.renders.length) {
    return (
      <div className="flex flex-col items-start gap-5">
        <p className="max-w-md text-[17px] text-muted">No swaps yet. Take a photo, pick a swap, and it shows up here.</p>
        <Link href="/#categories" className={primary}>
          Take a photo
        </Link>
      </div>
    );
  }

  const shown = loaded.renders.find((r) => r.jobId === openId) ?? null;
  return (
    <div className="flex flex-col gap-10">
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
        {loaded.renders.map((r) => (
          <li key={r.jobId}>
            <button type="button" onClick={() => open(r.jobId)} aria-pressed={r.jobId === openId} className="group block w-full text-left">
              <span className="block aspect-[4/5] overflow-hidden rounded-[20px] bg-surface-2 ring-accent ring-offset-2 ring-offset-bg group-aria-pressed:ring-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- signed, short-lived storage link */}
                <img
                  src={r.afterUrl}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover transition-transform duration-300 ease-(--ease-out) group-hover:scale-[1.02]"
                />
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
