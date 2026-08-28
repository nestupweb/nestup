import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ListingForm } from "@/components/listings/ListingForm";
import { getTaggedMembers } from "@/lib/invites";
import type { Listing } from "@/lib/types";

export default async function MyListingPage() {
  const { userId } = await requireProfile("/listing");
  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select("*")
    .eq("owner_id", userId)
    .is("removed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const listing = (data as Listing | null) ?? null;
  // Re-opening the form shows the picker exactly as it was left, with each
  // tagged roommate's answer beside their name.
  const taggedRoommates = listing ? await getTaggedMembers(supabase, listing.id) : [];

  return <ListingForm listing={listing} userId={userId} taggedRoommates={taggedRoommates} />;
}
