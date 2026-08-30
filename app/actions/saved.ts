"use server";

import { updateTag } from "next/cache";
import { requireUser } from "@/lib/auth";
import { profileTag, savedTag } from "@/lib/cache-tags";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Heart toggle for signed-in users — persisted in `saved_listings` (profile › Liked). */
export async function setSavedAction(listingId: string, saved: boolean): Promise<{ ok: boolean }> {
  if (!UUID_RE.test(listingId)) return { ok: false };
  const { supabase, user } = await requireUser();

  const { error } = saved
    ? await supabase
        .from("saved_listings")
        .upsert({ user_id: user.id, listing_id: listingId }, { onConflict: "user_id,listing_id" })
    : await supabase
        .from("saved_listings")
        .delete()
        .eq("user_id", user.id)
        .eq("listing_id", listingId);

  if (error) return { ok: false };
  // Only this member's own two caches: the hearts on Listings and their Liked
  // tab. The public room list is unchanged — a heart is not a change to the room.
  updateTag(savedTag(user.id));
  updateTag(profileTag(user.id));
  return { ok: true };
}
