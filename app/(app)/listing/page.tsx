import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ListingForm } from "@/components/listings/ListingForm";
import { getManagedListing, getTaggedMembers } from "@/lib/invites";

export default async function MyListingPage() {
  const { userId } = await requireProfile("/listing");
  const supabase = await createClient();

  // The room this member manages: the one they posted, or — since 0033 — the
  // one they co-post, which they may edit exactly as its creator can.
  const listing = await getManagedListing(supabase, userId);
  const isOwner = listing ? listing.owner_id === userId : true;

  // Only the creator tags roommates, so only the creator is shown the picker
  // (and only their form needs the tags loaded).
  const taggedRoommates = listing && isOwner ? await getTaggedMembers(supabase, listing.id) : [];

  return (
    <ListingForm
      listing={listing}
      userId={userId}
      taggedRoommates={taggedRoommates}
      canTagRoommates={isOwner}
    />
  );
}
