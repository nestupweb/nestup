"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { checkTakenMessage, takenMessageError } from "@/lib/listing-taken";

export type TakenState = { error?: string; told?: number };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GENERIC = "Could not close the listing. Please try again.";

function refreshEverywhere(listingId: string): void {
  revalidatePath("/profile");
  revalidatePath("/settings");
  revalidatePath("/browse");
  revalidatePath(`/browse/${listingId}`);
  revalidatePath("/swipe");
  revalidatePath("/chat");
}

/**
 * How many members the owner is talking to about this room — shown before the
 * notice goes out, so "send" is never a shot in the dark. RLS answers for the
 * owner only: conversations are readable by their two participants.
 */
export async function listingChatCountAction(listingId: string): Promise<{ count: number }> {
  if (!UUID_RE.test(String(listingId ?? ""))) return { count: 0 };
  const { supabase, user } = await requireUser();

  const { data: listing } = await supabase
    .from("listings")
    .select("id")
    .eq("id", listingId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!listing) return { count: 0 };

  const { count } = await supabase
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", listingId);
  return { count: count ?? 0 };
}

/**
 * The deal is done: take the room down and tell everyone waiting on it, in one
 * transaction (`mark_listing_taken`, migration 0025). Runs under the owner's
 * own session, so the database — not this function — is what stops anyone
 * closing a room that isn't theirs.
 */
export async function markListingTakenAction(_prev: TakenState, formData: FormData): Promise<TakenState> {
  const listingId = String(formData.get("listing_id") ?? "");
  const message = String(formData.get("message") ?? "");
  if (!UUID_RE.test(listingId)) return { error: GENERIC };

  const problem = checkTakenMessage(message);
  if (problem) return { error: takenMessageError(problem) };

  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("mark_listing_taken", {
    p_listing: listingId,
    p_message: message.trim(),
  });
  if (error) return { error: GENERIC };
  // -1: not this member's listing, or it was already closed (a second tab, a
  // double tap) — either way nothing was sent a second time.
  if (typeof data !== "number" || data < 0) {
    return { error: "This room is already marked as taken." };
  }

  refreshEverywhere(listingId);
  return { told: data };
}

/** A deal that fell through: the room goes back up and stays out of the notice path. */
export async function reopenListingAction(listingId: string): Promise<TakenState> {
  if (!UUID_RE.test(String(listingId ?? ""))) return { error: GENERIC };
  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from("listings")
    .update({ is_active: true, taken_at: null, updated_at: new Date().toISOString() })
    .eq("id", listingId)
    .eq("owner_id", user.id);
  if (error) return { error: "Could not re-open the listing. Please try again." };

  refreshEverywhere(listingId);
  return {};
}
