/**
 * The same tokens as apps/web/app/globals.css. One theme: dark. The accent (denim) marks the
 * brand and everything the user can act on; it is never decoration. Don't add colors here.
 */
export const colors = {
  bg: "#121110",
  surface: "#1b1a18",
  surface2: "#252320",
  fg: "#f2efe8",
  muted: "#a39e93",
  line: "#34312c",
  accent: "#4a70b5",
  accentPressed: "#3d63a8",
  onAccent: "#ffffff",
  /** Denim as text on the dark page (a fill can't also be readable text here). */
  accentInk: "#98b0dc",
  device: "#0c0c0b",
} as const;

export const fonts = {
  regular: "InstrumentSans_400Regular",
  medium: "InstrumentSans_500Medium",
  semibold: "InstrumentSans_600SemiBold",
  bold: "InstrumentSans_700Bold",
} as const;

export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

export const radius = { sm: 8, md: 14, lg: 20 } as const;

/** Headlines: the web's `.display` (tight tracking and leading). */
export const display = { fontFamily: fonts.semibold, letterSpacing: -0.6, color: colors.fg } as const;
