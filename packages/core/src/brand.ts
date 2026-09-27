/** The one place the product name lives. Rename the app here. */
export const BRAND = {
  name: "Scryle",
  tagline: "Scan anything. Tap any part. Swap it for something you can buy.",
  shareHashtag: "#HiggsfieldApp",
  /** Denim, chosen 2026-09-23. The lighter shade is the one used on the dark site. */
  accentColor: "#3d63a8",
  accentOnDarkColor: "#4a70b5",
  /** The site's page colour (dark theme, 2026-09-26). Tokens live in apps/web/app/globals.css. */
  backgroundColor: "#121110",
  /** Text and the logo's outline on that page. */
  inkColor: "#f2efe8",
  mutedColor: "#a39e93",
  /** Denim as text on the dark page (a fill can't also be readable text there). */
  accentInkColor: "#98b0dc",
} as const;

/**
 * Who runs the service, for the Terms and Privacy pages. Fill these in, then set `reviewed`
 * to true: until then both pages show a "draft" notice.
 */
export const LEGAL = {
  /** The company that runs the site, e.g. "Scryle LLC". Not named yet: the pages say "the Scryle team". */
  operator: "",
  /** Where people write about accounts and privacy. Needed before launch. */
  contactEmail: "",
  /** Shown at the top of both pages. */
  updated: "September 26, 2026",
  reviewed: false,
} as const;
