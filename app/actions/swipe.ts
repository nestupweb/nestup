"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import type { SwipeDirection } from "@/lib/types";

export async function swipeAction(listingId: string, direction: SwipeDirection): Promise<void> {
  const { supabase } = await requireUser();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase.from("swipes").upsert(
    { seeker_id: user!.id, listing_id: listingId, direction },
    { onConflict: "seeker_id,listing_id" }
  );
  redirect("/swipe");
}
