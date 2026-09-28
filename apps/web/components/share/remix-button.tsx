"use client";

import type { PackId } from "@retrofit/core";
import { useRouter } from "next/navigation";
import { saveRemix } from "@/lib/build/remix";
import type { SelectionInput } from "@/lib/build/store";

interface RemixButtonProps {
  shareId: string;
  pack: PackId;
  selections: SelectionInput[];
}

/** "Try this on me": remember the swaps, then take your own photo. They are picked for you. */
export function RemixButton({ shareId, pack, selections }: RemixButtonProps) {
  const router = useRouter();
  const go = () => {
    saveRemix(window.sessionStorage, { pack, selections, from: shareId });
    router.push(`/app?pack=${pack}`);
  };
  return (
    <button
      type="button"
      onClick={go}
      className="h-13 w-full rounded-full bg-accent px-7 text-[17px] font-semibold text-on-accent transition-transform active:scale-[0.98] sm:w-auto"
    >
      Try this on me
    </button>
  );
}
