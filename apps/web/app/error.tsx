"use client";

import Link from "next/link";
import { useEffect } from "react";

/** When a page breaks: say so plainly and offer a way on. Details go to the server log only. */
export default function PageError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error("[page] crashed", error.digest ?? error.message);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="display text-[2.4rem] font-semibold">Something went wrong</h1>
      <p className="text-muted">That&apos;s on us. Your pictures are safe. Try again, or start from the home page.</p>
      <div className="mt-2 flex gap-3">
        <button type="button" onClick={() => retry()} className="inline-flex h-12 items-center rounded-full bg-accent px-7 font-semibold text-on-accent">
          Try again
        </button>
        <Link href="/" className="inline-flex h-12 items-center rounded-full px-5 font-semibold hover:bg-surface-2">
          Home
        </Link>
      </div>
    </main>
  );
}
