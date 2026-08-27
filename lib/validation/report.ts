import { z } from "zod";

/**
 * Why one member reports another. The keys are the `public.report_reason`
 * enum in migration 0029 — adding one here without adding it there makes every
 * report of that kind fail at the database, so change both together.
 *
 * `inappropriate_images` is the one that suspends on its own: a single report
 * of it takes the account down without waiting for the threshold, because the
 * harm of leaving such a photo up for two more reports is worse than the harm
 * of suspending someone who can be reinstated.
 */
export const REPORT_REASONS = [
  { key: "harassment", label: "Harassment", hint: "Threats, abuse or unwanted contact." },
  { key: "spam", label: "Spam", hint: "Adverts, scams or repeated junk messages." },
  { key: "fake_profile", label: "Fake profile", hint: "Someone pretending to be a person they aren't." },
  { key: "inappropriate_behavior", label: "Inappropriate behaviour", hint: "Rude, discriminatory or unsafe conduct." },
  { key: "inappropriate_images", label: "Inappropriate images", hint: "Sexual, violent or otherwise unacceptable photos." },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["key"];

const reasonKeys = REPORT_REASONS.map((r) => r.key) as [ReportReason, ...ReportReason[]];

/** The reason that suspends immediately, named once so the UI and the tests agree. */
export const IMMEDIATE_SUSPEND_REASON: ReportReason = "inappropriate_images";

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Matches the `reports_details_len` check constraint in 0029. */
export const REPORT_DETAILS_MAX = 1000;

export const reportSchema = z.object({
  reported_id: z.string().regex(UUID_RE, "That member could not be identified."),
  reason: z.enum(reasonKeys, { message: "Choose a reason for the report." }),
  details: z.preprocess(
    (v) => (typeof v === "string" && v.trim() ? v.trim() : undefined),
    z.string().max(REPORT_DETAILS_MAX, `Keep the details under ${REPORT_DETAILS_MAX} characters.`).optional()
  ),
});

export type ReportInput = z.infer<typeof reportSchema>;
