"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";

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
  revalidatePath("/profile");
  return { ok: true };
}
