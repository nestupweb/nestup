"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { respondToInvite, searchAvailableMembers } from "@/lib/invites";
import { MIN_MEMBER_QUERY, type TaggedMember } from "@/lib/co-posters";

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
 * Members who could actually be tagged: the name or the e-mail matches, they
 * are not blocked in either direction, and they have no home of their own
 * (0033). The address is returned as well as searched — it is what separates
 * two members with near-identical names (0036).
 *
 * All three rules live in `search_available_members` (0034) so that the limit
 * is applied *after* them. Filtering in TypeScript over a capped page was wrong
 * — with 815 of 842 members housed, almost every row fetched was then thrown
 * away and the picker showed two people where four matched.
 */
export async function searchMembersAction(
  query: string,
  listingId?: string
): Promise<{ members: TaggedMember[] }> {
  const q = String(query ?? "").trim();
  if (q.length < MIN_MEMBER_QUERY) return { members: [] };

  const { supabase } = await requireUser();
  return { members: await searchAvailableMembers(supabase, q, listingId) };
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
