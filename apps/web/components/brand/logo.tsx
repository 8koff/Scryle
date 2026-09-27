import Link from "next/link";
import { BRAND } from "@retrofit/core";
import { SeamMark } from "@/lib/brand-mark";

/** The Seam mark and the wordmark. */
export function Logo() {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5" aria-label={`${BRAND.name} home`}>
      <SeamMark size={30} />
      <span className="display text-[26px] font-semibold !leading-none">{BRAND.name}</span>
    </Link>
  );
}
