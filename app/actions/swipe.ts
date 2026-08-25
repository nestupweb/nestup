"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import type { SwipeDirection } from "@/lib/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Persist one decision from the deck. Returns instead of redirecting so the
 * client can animate straight into the next room; a like also lands in
 * Profile › Liked (`saved_listings`) so the two hearts agree.
 */
export async function recordSwipeAction(
  listingId: string,
  direction: SwipeDirection
): Promise<{ ok: boolean }> {
  if (!UUID.test(listingId) || (direction !== "like" && direction !== "skip")) return { ok: false };
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("swipes")
    .upsert({ seeker_id: user.id, listing_id: listingId, direction }, { onConflict: "seeker_id,listing_id" });
  if (error) return { ok: false };
  if (direction === "like") {
    await supabase
      .from("saved_listings")
      .upsert({ user_id: user.id, listing_id: listingId }, { onConflict: "user_id,listing_id" });
    // No revalidatePath here: /profile is rendered on demand anyway, and a
    // revalidation would refresh /swipe's props mid-deck.
  }
  return { ok: true };
}

/** Form-action variant used by the listing page's "I'm interested" button. */
export async function swipeAction(listingId: string, direction: SwipeDirection): Promise<void> {
  await recordSwipeAction(listingId, direction);
  redirect("/swipe");
}
