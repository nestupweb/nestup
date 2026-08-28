"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getBlockedIds } from "@/lib/moderation";
import { getBusyMemberIds, respondToInvite } from "@/lib/invites";
import { MEMBER_SEARCH_LIMIT, MIN_MEMBER_QUERY, UUID_RE, type TaggedMember } from "@/lib/co-posters";

/**
 * Shared listings — what the browser may call.
 *
 * Thin on purpose: the rules live in migration 0032 and the database calls in
 * `lib/invites.ts`, which the REST routes share. Only async functions belong
 * in a `"use server"` file, and every one of them is reachable by anyone
 * signed in, so each re-derives who is calling from `requireUser()` rather
 * than trusting anything in the FormData.
 */

/** Everywhere a co-poster changing their mind changes what is on screen. */
function refreshEverywhere(listingId?: string): void {
  revalidatePath("/profile");
  revalidatePath("/browse");
  if (listingId) revalidatePath(`/browse/${listingId}`);
  revalidatePath("/swipe");
  revalidatePath("/chat");
}

/**
 * Members whose name matches, for the tag picker.
 *
 * Blocked members are dropped in both directions. The database would refuse
 * them at publish time anyway (0032), but offering someone and failing later
 * is a worse way to find out — and `blocked_user_ids()` still never says which
 * way round the block runs.
 */
export async function searchMembersAction(
  query: string,
  listingId?: string
): Promise<{ members: TaggedMember[] }> {
  const q = String(query ?? "").trim();
  if (q.length < MIN_MEMBER_QUERY) return { members: [] };

  const { supabase, user } = await requireUser();
  // `%` and `_` are ILIKE wildcards; someone typing them means them literally.
  const pattern = `%${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;

  const [{ data }, blocked] = await Promise.all([
    supabase
      .from("profiles")
      .select("user_id, full_name, avatar_url, occupation")
      .ilike("full_name", pattern)
      .neq("user_id", user.id)
      .order("full_name")
      // Room to drop the unavailable before trimming to the visible few.
      .limit(MEMBER_SEARCH_LIMIT * 6),
    getBlockedIds(supabase),
  ]);

  const candidates = ((data as TaggedMember[] | null) ?? []).filter((m) => !blocked.has(m.user_id));
  // One person, one home (0033): someone who already has a listing cannot be
  // invited to another, so they are never offered.
  const busy = await getBusyMemberIds(
    supabase,
    candidates.map((m) => m.user_id),
    UUID_RE.test(String(listingId ?? "")) ? listingId : undefined
  );

  const members = candidates.filter((m) => !busy.has(m.user_id)).slice(0, MEMBER_SEARCH_LIMIT);
  return { members };
}

export type InviteAnswerState = { error?: string; answered?: "yes" | "no" };

/**
 * The pending card's two buttons. The answer and its consequence are one
 * database call, so a member never ends up listed as a co-poster of a room
 * whose household cannot see them — or the reverse.
 */
export async function respondToInviteAction(
  _prev: InviteAnswerState,
  formData: FormData
): Promise<InviteAnswerState> {
  const inviteId = String(formData.get("invite_id") ?? "").trim();
  const answer = String(formData.get("answer") ?? "");
  if (answer !== "yes" && answer !== "no") return { error: "Could not tell which answer that was." };

  const { supabase } = await requireUser();
  const { listingId, error } = await respondToInvite(supabase, inviteId, answer === "yes");
  if (error) return { error };

  refreshEverywhere(listingId);
  return { answered: answer };
}
