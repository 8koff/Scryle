"use client";

import { getPack } from "@retrofit/core";
import { useEffect, useState } from "react";
import type { AdminStats, ApiResponse, GalleryCard, ReportCard } from "@/lib/api";
import { account, useAccount } from "@/lib/account/use-account";
import { REPORT_LABELS, REVIEW_HOURS } from "@/lib/reports";

type Data = { reports: ReportCard[]; pending: GalleryCard[]; approved: GalleryCard[]; stats: AdminStats };
/** `at` is when the data arrived: report deadlines count from it. */
type Loaded = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: Data; at: number };

const usd = (n: number) => `$${n.toFixed(2)}`;
const pill = "h-10 rounded-full px-4 text-[14px] font-semibold transition-colors disabled:opacity-50";
const HOUR_MS = 60 * 60 * 1000;

/** "Due in 31 h" or "4 h late", counted from when the report came in. */
function deadline(createdAt: string, now: number): string {
  const left = Math.round((new Date(createdAt).getTime() + REVIEW_HOURS * HOUR_MS - now) / HOUR_MS);
  return left >= 0 ? `Due in ${left} h` : `${-left} h late`;
}

/** Before and after side by side, labelled. */
function Pair({ beforeUrl, afterUrl }: { beforeUrl: string; afterUrl: string }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {[beforeUrl, afterUrl].map((src, i) => (
        <span key={src} className="relative block aspect-[4/5] overflow-hidden rounded-2xl bg-surface-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- stored share picture */}
          <img src={src} alt={i ? "After" : "Before"} className="size-full object-cover" />
          <span className="absolute bottom-1.5 left-1.5 rounded-full bg-fg/75 px-2 py-0.5 text-[10px] font-semibold text-bg">{i ? "After" : "Before"}</span>
        </span>
      ))}
    </div>
  );
}

/** The owner's view: a few numbers and the gallery queue. The server decides who may see it. */
export function AdminPanel() {
  const me = useAccount();
  const [loaded, setLoaded] = useState<Loaded>({ status: "loading" });
  const [tab, setTab] = useState<"pending" | "approved">("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const signedIn = me.status === "signed-in";

  /** Bumped after each decision to load the lists again. */
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    void (async () => {
      try {
        const response = await account.authFetch("/api/admin/gallery", { cache: "no-store" });
        const body = (await response.json()) as ApiResponse<Data>;
        if (!live) return;
        if (body.success) setLoaded({ status: "ready", data: body.data, at: Date.now() });
        else setLoaded({ status: "error", message: response.status === 404 ? "This page isn't for your account." : body.error });
      } catch {
        if (live) setLoaded({ status: "error", message: "No connection. Check your internet and try again." });
      }
    })();
    return () => {
      live = false;
    };
  }, [signedIn, version]);

  const decideReport = async (id: number, action: "remove" | "dismiss") => {
    setBusyId(`report-${id}`);
    try {
      const response = await account.authFetch(`/api/admin/reports/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = (await response.json()) as ApiResponse<{ id: number }>;
      if (body.success) setVersion((v) => v + 1);
    } finally {
      setBusyId(null);
    }
  };

  const decide = async (id: string, decision: "approved" | "rejected") => {
    setBusyId(id);
    try {
      const response = await account.authFetch(`/api/admin/gallery/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const body = (await response.json()) as ApiResponse<{ id: string }>;
      if (body.success) setVersion((v) => v + 1);
    } finally {
      setBusyId(null);
    }
  };

  if (me.status === "signed-out") return <p className="mt-6 text-[17px] text-muted">Sign in with an admin email.</p>;
  if (loaded.status === "loading") return <p className="mt-6 text-[17px] text-muted">Loading…</p>;
  if (loaded.status === "error") return <p role="alert" className="mt-6 text-[17px] text-muted">{loaded.message}</p>;

  const { stats, reports } = loaded.data;
  const now = loaded.at;
  const cards = loaded.data[tab];
  const numbers = [
    { label: "AI spend today", value: usd(stats.spentTodayUsd) },
    { label: "Swaps, 7 days", value: String(stats.renders7d) },
    { label: "Packs sold, 7 days", value: String(stats.purchases7d) },
    { label: "Swaps sold, 7 days", value: String(stats.creditsSold7d) },
  ];

  return (
    <div className="mt-8 flex flex-col gap-10">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-y border-line py-6 md:grid-cols-4">
        {numbers.map((n) => (
          <div key={n.label}>
            <dt className="text-[13px] text-muted">{n.label}</dt>
            <dd className="display mt-1 text-[2.2rem] font-semibold tabular-nums">{n.value}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="reports-title">
        <h2 id="reports-title" className="text-[20px] font-semibold">
          Reports ({reports.length})
        </h2>
        <p className="mt-1 text-[14px] text-muted">
          Decide within {REVIEW_HOURS} hours. Sexual pictures and pictures of children are hidden until you decide.
        </p>
        {reports.length === 0 ? (
          <p className="mt-4 text-[15px] text-muted">No open reports.</p>
        ) : (
          <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {reports.map((r) => {
              const busy = busyId === `report-${r.id}`;
              return (
                <li key={r.id} className="rounded-[24px] border border-line bg-surface p-3">
                  {r.link ? <Pair beforeUrl={r.link.beforeUrl} afterUrl={r.link.afterUrl} /> : <p className="p-3 text-[14px] text-muted">The link is already deleted.</p>}
                  <p className="mt-3 text-[15px] font-semibold">{REPORT_LABELS[r.reason]}</p>
                  {r.details && <p className="mt-1 whitespace-pre-line break-words text-[14px]">{r.details}</p>}
                  <p className="mt-1 text-[13px] text-muted">
                    {deadline(r.createdAt, now)}
                    {r.link?.hidden ? " · Hidden now" : ""}
                    {r.contact ? ` · Reply to ${r.contact}` : ""}
                    {r.link && (
                      <>
                        {" · "}
                        <a href={`/b/${r.shareId}`} target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-fg">
                          Open link
                        </a>
                      </>
                    )}
                  </p>
                  <div className="mt-3 flex gap-2">
                    {r.link && (
                      <button type="button" disabled={busy} onClick={() => decideReport(r.id, "remove")} className={`${pill} bg-accent text-on-accent`}>
                        Delete for good
                      </button>
                    )}
                    <button type="button" disabled={busy} onClick={() => decideReport(r.id, "dismiss")} className={`${pill} bg-surface-2 hover:bg-line`}>
                      {r.link ? "Keep it up" : "Close"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-label="Gallery">
        <div role="tablist" className="flex gap-2">
          {(["pending", "approved"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`${pill} ${tab === t ? "bg-fg text-bg" : "bg-surface-2 hover:bg-line"}`}
            >
              {t === "pending" ? `Waiting (${loaded.data.pending.length})` : `Live (${loaded.data.approved.length})`}
            </button>
          ))}
        </div>

        {cards.length === 0 ? (
          <p className="mt-6 text-[15px] text-muted">{tab === "pending" ? "Nothing waiting." : "Nothing in the gallery yet."}</p>
        ) : (
          <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => (
              <li key={card.id} className="rounded-[24px] border border-line bg-surface p-3">
                <Pair beforeUrl={card.beforeUrl} afterUrl={card.afterUrl} />
                <p className="mt-3 truncate text-[15px] font-semibold">{card.labels.join(" + ") || "A new look"}</p>
                <p className="text-[13px] text-muted">
                  {getPack(card.pack).label} ·{" "}
                  <a href={`/b/${card.id}`} target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-fg">
                    Open link
                  </a>
                </p>
                <div className="mt-3 flex gap-2">
                  {tab === "pending" && (
                    <button type="button" disabled={busyId === card.id} onClick={() => decide(card.id, "approved")} className={`${pill} bg-accent text-on-accent`}>
                      Approve
                    </button>
                  )}
                  <button type="button" disabled={busyId === card.id} onClick={() => decide(card.id, "rejected")} className={`${pill} bg-surface-2 hover:bg-line`}>
                    {tab === "pending" ? "Reject" : "Take down"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
