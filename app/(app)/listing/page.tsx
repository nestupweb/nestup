import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ListingForm } from "@/components/listings/ListingForm";
import { isPhotoCheckEnabled } from "@/lib/photo-check";
import type { Listing } from "@/lib/types";

export default async function MyListingPage() {
  const { userId } = await requireProfile("/listing");
  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <ListingForm
      listing={(data as Listing | null) ?? null}
      userId={userId}
      photoCheck={isPhotoCheckEnabled()}
    />
  );
}
