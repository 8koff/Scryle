"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ApiResponse, GalleryStatus } from "@/lib/api";
import { account, useAccount } from "@/lib/account/use-account";

type Owner = { isOwner: boolean; gallery?: GalleryStatus };

const GALLERY_TEXT: Record<GalleryStatus, { status: string; action: string; next: "submit" | "withdraw" }> = {
  none: { status: "Want it on the home page?", action: "Send to the gallery", next: "submit" },
  pending: { status: "Sent to the gallery. We check it first.", action: "Take it back", next: "withdraw" },
  approved: { status: "It's in the gallery on the home page.", action: "Take it out", next: "withdraw" },
  rejected: { status: "Not picked for the gallery this time.", action: "Send again", next: "submit" },
};

const link = "font-semibold text-fg hover:text-accent-ink disabled:opacity-50";

/** Shown only to the person who made the link: the gallery, and deleting the link for good. */
export function OwnerActions({ shareId }: { shareId: string }) {
  const me = useAccount();
  const router = useRouter();
  const [owner, setOwner] = useState<Owner>({ isOwner: false });
  const [phase, setPhase] = useState<"idle" | "confirm" | "deleting" | "error">("idle");
  const [galleryBusy, setGalleryBusy] = useState(false);
  const [galleryError, setGalleryError] = useState(false);
  const signedIn = me.status === "signed-in";

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    account
      .authFetch(`/api/shares/${shareId}`, { cache: "no-store" })
      .then((r) => r.json() as Promise<ApiResponse<Owner>>)
      .then((body) => !cancelled && body.success && setOwner(body.data))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [signedIn, shareId]);

  if (!signedIn || !owner.isOwner) return null;

  const remove = async () => {
    setPhase("deleting");
    try {
      const body = (await (await account.authFetch(`/api/shares/${shareId}`, { method: "DELETE" })).json()) as ApiResponse<{ id: string }>;
      if (!body.success) throw new Error(body.error);
      router.replace("/");
    } catch {
      setPhase("error");
    }
  };

  const gallery = GALLERY_TEXT[owner.gallery ?? "none"];
  const changeGallery = async () => {
    setGalleryBusy(true);
    setGalleryError(false);
    try {
      const response = await account.authFetch(`/api/shares/${shareId}/gallery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: gallery.next }),
      });
      const body = (await response.json()) as ApiResponse<{ gallery: GalleryStatus }>;
      if (!body.success) throw new Error(body.error);
      setOwner((o) => ({ ...o, gallery: body.data.gallery }));
    } catch {
      setGalleryError(true);
    } finally {
      setGalleryBusy(false);
    }
  };

  return (
    <div className="mt-8 flex flex-col gap-3 border-t border-line pt-5 text-[14px]">
      <p className="font-medium">You made this link.</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-muted">{galleryError ? "Couldn't update the gallery. Try again." : gallery.status}</span>
        <button type="button" onClick={changeGallery} disabled={galleryBusy} className={link}>
          {galleryBusy ? "Saving…" : gallery.action}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {phase === "confirm" ? (
          <>
            <button type="button" onClick={remove} className="font-semibold text-accent-ink hover:text-accent-ink-2">
              Yes, delete it and the photos
            </button>
            <button type="button" onClick={() => setPhase("idle")} className="font-medium text-muted hover:text-fg">
              Keep it
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setPhase("confirm")} disabled={phase === "deleting"} className={link}>
            {phase === "deleting" ? "Deleting…" : phase === "error" ? "Couldn't delete. Try again" : "Delete this link"}
          </button>
        )}
      </div>
    </div>
  );
}
