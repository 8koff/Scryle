/** Why someone reports a share link. Shared by the report form and the server. */
export const REPORT_REASONS = ["intimate", "minor", "me", "copyright", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_LABELS: Record<ReportReason, string> = {
  intimate: "It's a sexual or nude picture of someone",
  minor: "It shows someone under 18",
  me: "It's me, and I didn't agree to this",
  copyright: "It uses my photo or work without permission",
  other: "Something else",
};

/** Reasons that hide the link at once, before anyone checks it. */
export const HIDE_AT_ONCE: ReadonlySet<ReportReason> = new Set<ReportReason>(["intimate", "minor"]);

/** How long we take to look at a report, in hours (the TAKE IT DOWN Act allows 48). */
export const REVIEW_HOURS = 48;
