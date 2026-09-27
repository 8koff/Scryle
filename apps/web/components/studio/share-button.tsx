"use client";

import { BRAND } from "@retrofit/core";
import { useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { account } from "@/lib/account/use-account";
import type { ApiResponse } from "@/lib/api";
import type { Build, Version } from "@/lib/build/store";

interface ShareButtonProps {
  build: Build;
  version: Version;
}

type Phase = "idle" | "working" | "error";

const SHARE_TEXT = `AI edit made with ${BRAND.name} ${BRAND.shareHashtag}`;

const option =
  "flex w-full flex-col items-start rounded-2xl border border-line bg-bg px-5 py-4 text-left transition-[border-color,transform] hover:border-accent active:scale-[0.99] disabled:opacity-60";

/** What the server needs to prove this photo and this render are yours. */
function proof(build: Build, version: Version) {
  return {
    claim: { photoUrl: build.photoUrl, pack: build.pack, width: build.width, height: build.height, scene: build.scene },
    token: build.token,
    jobId: version.jobId,
    jobToken: version.jobToken,
  };
}

function download(file: File) {
  const url = URL.createObjectURL(file);
  Object.assign(document.createElement("a"), { href: url, download: file.name }).click();
  URL.revokeObjectURL(url);
}

/** "Share" under a finished render: send the picture (private), or make a public link. */
export function ShareButton({ build, version }: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [picture, setPicture] = useState<Phase>("idle");
  const [link, setLink] = useState<Phase>("idle");
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const sharePicture = async () => {
    setPicture("working");
    setError(null);
    try {
      const response = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(proof(build, version)),
      });
      if (!response.ok) throw new Error("card failed");
      const file = new File([await response.blob()], `${BRAND.name.toLowerCase()}-before-after.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text: SHARE_TEXT }).catch(() => {});
      else download(file);
      setPicture("idle");
    } catch {
      setPicture("error");
      setError("Couldn't make the picture. The photo may have expired.");
    }
  };

  const makeLink = async () => {
    setLink("working");
    setError(null);
    try {
      const response = await account.authFetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...proof(build, version), selections: version.selections }),
      });
      const body = (await response.json()) as ApiResponse<{ id: string }>;
      if (!body.success) throw new Error(body.error);
      const url = `${window.location.origin}/b/${body.data.id}`;
      setLinkUrl(url);
      setLink("idle");
      if (navigator.share) await navigator.share({ url, text: SHARE_TEXT }).catch(() => {});
    } catch (e) {
      setLink("error");
      setError(e instanceof Error && e.message ? e.message : "Couldn't make the link. Please try again.");
    }
  };

  const copy = async () => {
    if (!linkUrl) return;
    try {
      await navigator.clipboard.writeText(linkUrl);
      setIsCopied(true);
    } catch {
      setIsCopied(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mx-auto h-10 rounded-full bg-fg px-5 text-[14px] font-semibold text-bg transition-transform active:scale-[0.97]"
      >
        Share before &amp; after
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} label="Share your before and after">
        <h2 className="display text-[2rem] font-semibold">Share it</h2>
        <div className="mt-5 flex flex-col gap-2.5">
          <button type="button" onClick={sharePicture} disabled={picture === "working"} className={option}>
            <span className="text-[17px] font-semibold">{picture === "working" ? "Making your picture…" : "Share the picture"}</span>
            <span className="text-[14px] text-muted">One image with both photos. Only people you send it to see it.</span>
          </button>

          {linkUrl ? (
            <div className="rounded-2xl border border-accent bg-bg px-5 py-4">
              <p className="text-[17px] font-semibold">Your link is ready</p>
              <p className="mt-1 truncate text-[14px] text-muted">{linkUrl}</p>
              <div className="mt-3 flex gap-4 text-[14px] font-semibold">
                <button type="button" onClick={copy} className="text-accent-ink hover:text-accent-ink-2">
                  {isCopied ? "Copied" : "Copy link"}
                </button>
                <a href={linkUrl} target="_blank" rel="noopener noreferrer" className="text-fg hover:text-accent-ink">
                  Open it
                </a>
              </div>
            </div>
          ) : (
            <button type="button" onClick={makeLink} disabled={link === "working"} className={option}>
              <span className="text-[17px] font-semibold">{link === "working" ? "Making your link…" : "Make a link"}</span>
              <span className="text-[14px] text-muted">A page with a &ldquo;Try this on me&rdquo; button. Anyone with the link can see both photos.</span>
            </button>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-3 text-[14px] font-medium text-accent-ink">
            {error}
          </p>
        )}
        <p className="mt-5 text-[12px] text-muted">
          A link stays up until you delete it. You can delete it from the link&apos;s page.
        </p>
      </Sheet>
    </>
  );
}
