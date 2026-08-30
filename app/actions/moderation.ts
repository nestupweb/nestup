"use server";

import { refresh, updateTag } from "next/cache";
import { requireUser } from "@/lib/auth";
import { deckTag } from "@/lib/cache-tags";
import { reportSchema, UUID_RE } from "@/lib/validation/report";

/**
 * Reporting and blocking. Both are thin: migration 0029 holds the actual
 * rules — one report per reporter per subject, the suspension trigger, and the
 * RLS that stops blocked or suspended members writing — so these actions
 * validate, call, and turn database answers into sentences.
 */

export type ModerationState = { error?: string; done?: boolean };

/**
 * File a report. A second report of the same member by the same reporter hits
 * the `unique (reporter_id, reported_id)` constraint; that is reported back as
 * success, because from the member's point of view the report is on file and
 * because the count must not move.
 */
export async function reportUserAction(
  _prev: ModerationState,
  formData: FormData
): Promise<ModerationState> {
  const parsed = reportSchema.safeParse({
    reported_id: String(formData.get("reported_id") ?? ""),
    reason: String(formData.get("reason") ?? ""),
    details: formData.get("details"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please choose a reason." };
  }
  const { reported_id, reason, details } = parsed.data;

  const { supabase, user } = await requireUser();
  if (reported_id === user.id) return { error: "You can't report yourself." };

  const { error } = await supabase.from("reports").insert({
    reporter_id: user.id,
    reported_id,
    reason,
    details: details ?? null,
  });

  if (error) {
    // 23505: already reported. Nothing to add, nothing to count again.
    if (error.code === "23505") return { done: true };
    return { error: "Could not send the report. Please try again." };
  }
  // The member page is an uncached read, so rerunning the route in view is all
  // this needs — a report changes nothing on any other page.
  refresh();
  return { done: true };
}

/** Block someone. Idempotent: blocking twice is not an error. */
export async function blockUserAction(
  _prev: ModerationState,
  formData: FormData
): Promise<ModerationState> {
  const blocked = String(formData.get("blocked_id") ?? "");
  if (!UUID_RE.test(blocked)) return { error: "That member could not be identified." };

  const { supabase, user } = await requireUser();
  if (blocked === user.id) return { error: "You can't block yourself." };

  const { error } = await supabase.from("blocks").insert({ blocker_id: user.id, blocked_id: blocked });
  if (error && error.code !== "23505") {
    return { error: "Could not block this member. Please try again." };
  }
  // The deck is the one cached thing a block changes: it excludes rooms owned by
  // anyone this member has blocked, so a stale deck would keep offering them.
  // Settings, the member page and Chat are all uncached reads, so the rerun of
  // whichever of them is on screen covers those.
  updateTag(deckTag(user.id));
  refresh();
  return { done: true };
}

/** Undo a block. Only the blocker's own row can go (RLS, migration 0029). */
export async function unblockUserAction(
  _prev: ModerationState,
  formData: FormData
): Promise<ModerationState> {
  const blocked = String(formData.get("blocked_id") ?? "");
  if (!UUID_RE.test(blocked)) return { error: "That member could not be identified." };

  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("blocks")
    .delete()
    .eq("blocker_id", user.id)
    .eq("blocked_id", blocked);
  if (error) return { error: "Could not unblock this member. Please try again." };

  // Same pair as blocking, for the same reason in reverse: their rooms may come
  // back into the deck.
  updateTag(deckTag(user.id));
  refresh();
  return { done: true };
}
