"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { uploadImage } from "@/lib/storage";
import { listingSchema } from "@/lib/validation/listing";
import { MAX_LISTING_PHOTOS } from "@/lib/constants";

export type ListingFormState = { error?: string; saved?: boolean };

export async function saveListingAction(
  _prev: ListingFormState,
  formData: FormData
): Promise<ListingFormState> {
  const { supabase, user } = await requireUser();

  const parsed = listingSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    city: formData.get("city"),
    neighborhood: formData.get("neighborhood") ?? "",
    rent: formData.get("rent"),
    available_from: formData.get("available_from"),
    property_type: formData.get("property_type"),
    rooms: formData.get("rooms"),
    size_sqm: formData.get("size_sqm"),
    roommates_count: formData.get("roommates_count"),
    pets_allowed: formData.get("pets_allowed") === "on",
    smoking_allowed: formData.get("smoking_allowed") === "on",
    balcony: formData.get("balcony") === "on",
    air_conditioning: formData.get("air_conditioning") === "on",
    parking: formData.get("parking") === "on",
    elevator: formData.get("elevator") === "on",
    furnished: formData.get("furnished") === "on",
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue ? (issue.path.length ? String(issue.path[0]) + ": " + issue.message : issue.message) : "Please check the form." };
  }

  const keptUrls = formData.getAll("existing_photos").map(String);
  const newFiles = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (keptUrls.length + newFiles.length > MAX_LISTING_PHOTOS) {
    return { error: `Up to ${MAX_LISTING_PHOTOS} photos.` };
  }
  const photo_urls = [...keptUrls];
  for (const file of newFiles) {
    try {
      photo_urls.push(await uploadImage(supabase, "listing-photos", user.id, file));
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Photo upload failed." };
    }
  }

  const listingId = String(formData.get("listing_id") ?? "");
  const is_active = formData.get("is_active") !== null ? formData.get("is_active") === "on" : true;
  const row = { ...parsed.data, photo_urls, is_active, owner_id: user.id, updated_at: new Date().toISOString() };

  const { error } = listingId
    ? await supabase.from("listings").update(row).eq("id", listingId).eq("owner_id", user.id)
    : await supabase.from("listings").insert(row);
  if (error) return { error: "Could not save the listing. Please try again." };

  revalidatePath("/listing");
  revalidatePath("/browse");
  return { saved: true };
}
