import { createClient } from "@/lib/supabase/server";

/**
 * A confirmed roommate who could take the listing on when its creator closes
 * their account. `eligible` is false for someone who already has a live room of
 * their own — `one_active_listing_per_owner` would refuse the handover, and it
 * is better to say so in the picker than to fail at the last step.
 */
export interface ListingHeir {
  resident_id: string;
  full_name: string;
  avatar_url: string | null;
  eligible: boolean;
  listing_id: string;
  listing_title: string;
}

/**
 * Who is on the caller's own listing, for the delete-account flow.
 *
 * Empty when they have no listing, or when nobody else is confirmed on it —
 * both of which mean "closing the account takes the room with it", which is
 * what it has always done.
 */
export async function queryListingHeirs(): Promise<ListingHeir[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("listing_heirs");
  if (error) return [];
  return (data ?? []) as ListingHeir[];
}

/** The ones who can actually be handed the listing. */
export function eligibleHeirs(heirs: ListingHeir[]): ListingHeir[] {
  return heirs.filter((h) => h.eligible);
}
