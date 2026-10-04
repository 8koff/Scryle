/**
 * Waitlist-only mode (owner's choice, 2026-10-04): while the waitlist is up, the app is closed and
 * every page sends visitors to /waitlist. Set this to false to open the full site again.
 * API routes are not affected (the proxy doesn't run on them).
 */
export const WAITLIST_ONLY = true;

const WAITLIST = "/waitlist";

/** Pages that stay open: the waitlist and its link image, the legal pages, and the site icons. */
const OPEN = /^\/(?:waitlist(?:\/.*)?|privacy|terms|icon|apple-icon|opengraph-image|manifest\.webmanifest)$/;

/** Where to send a visitor instead, or null to let the page load. */
export function waitlistRedirect(pathname: string, isWaitlistOnly: boolean = WAITLIST_ONLY): string | null {
  if (!isWaitlistOnly || OPEN.test(pathname)) return null;
  return WAITLIST;
}
