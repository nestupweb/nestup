"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { uploadImage } from "@/lib/storage";
import { listingSchema, missingPhotoRooms, photoRoomSchema } from "@/lib/validation/listing";
import { buildListingTitle } from "@/lib/listing-title";
import { MAX_LISTING_PHOTOS, MIN_LISTING_PHOTOS, photoRoomLabel } from "@/lib/constants";
import { normalizeSlots, type ViewingSlot } from "@/lib/availability";

export type ListingFormState = { error?: string; saved?: boolean };

const FIELD_NAMES: Record<string, string> = {
  city: "City",
  street: "Street",
  house_number: "House number",
  rent: "Rent",
  available_from: "Available from",
  rooms: "Rooms",
  size_sqm: "Size",
  roommates_count: "Current roommates",
};

export async function saveListingAction(
  _prev: ListingFormState,
  formData: FormData
): Promise<ListingFormState> {
  const { supabase, user } = await requireUser();

  const parsed = listingSchema.safeParse({
    description: formData.get("description") ?? "",
    city: formData.get("city"),
    neighborhood: formData.get("neighborhood") ?? "",
    street: formData.get("street") ?? "",
    house_number: formData.get("house_number") ?? "",
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
    safe_room: formData.get("safe_room") ?? "none",
    food_restrictions: formData.get("food_restrictions") ?? "",
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (!issue) return { error: "Please check the form." };
    const field = issue.path.length ? String(issue.path[0]) : "";
    return { error: field ? `${FIELD_NAMES[field] ?? field}: ${issue.message}` : issue.message };
  }

  // Weekly viewing hours (JSON from the editor); every row must be well-formed.
  let viewing_slots: ViewingSlot[] = [];
  const slotsRaw = formData.get("viewing_slots");
  if (typeof slotsRaw === "string" && slotsRaw.trim()) {
    let arr: unknown = null;
    try {
      arr = JSON.parse(slotsRaw);
    } catch {
      arr = null;
    }
    if (!Array.isArray(arr)) return { error: "Viewing hours: could not read the hours — please re-add them." };
    viewing_slots = normalizeSlots(arr);
    if (viewing_slots.length !== arr.length) return { error: "Viewing hours: each range must end after it starts." };
  }

  if (formData.get("photos_uploading")) {
    return { error: "Your photos are still uploading — give it a moment and publish again." };
  }

  // Photos arrive as public URLs (uploaded from the browser) with a room label
  // each; `photos` files are still accepted for older clients.
  const keptUrls = formData.getAll("existing_photos").map(String).filter((u) => u.startsWith("https://"));
  const keptLabels = formData.getAll("existing_labels").map((l) => photoRoomSchema.parse(String(l)));
  const newFiles = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  const newLabels = formData.getAll("new_labels").map((l) => photoRoomSchema.parse(String(l)));

  const photoCount = keptUrls.length + newFiles.length;
  if (photoCount > MAX_LISTING_PHOTOS) return { error: `Up to ${MAX_LISTING_PHOTOS} photos.` };
  if (photoCount < MIN_LISTING_PHOTOS) {
    return { error: `Add at least ${MIN_LISTING_PHOTOS} photos — the living room, a bedroom and the bathroom.` };
  }
  const photo_labels = [
    ...keptUrls.map((_, i) => keptLabels[i] ?? "other"),
    ...newFiles.map((_, i) => newLabels[i] ?? "other"),
  ];
  const missing = missingPhotoRooms(photo_labels);
  if (missing.length > 0) {
    const names = missing.map((r) => photoRoomLabel(r).toLowerCase());
    return { error: `Add a photo of the ${names.join(", the ")} — and tag each photo with the room it shows.` };
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
  const address = `${parsed.data.street} ${parsed.data.house_number}`.trim();
  const title = buildListingTitle(parsed.data);
  const row = {
    ...parsed.data,
    title,
    address,
    photo_urls,
    photo_labels,
    viewing_slots,
    is_active,
    owner_id: user.id,
    updated_at: new Date().toISOString(),
  };

  const { error } = listingId
    ? await supabase.from("listings").update(row).eq("id", listingId).eq("owner_id", user.id)
    : await supabase.from("listings").insert(row);
  if (error) return { error: "Could not save the listing. Please try again." };

  revalidatePath("/listing");
  revalidatePath("/browse");
  revalidatePath("/profile");
  revalidatePath("/swipe");
  if (listingId) return { saved: true };
  // Freshly published: show it where it now lives (Listings, My Listings, seekers' decks).
  redirect("/profile?tab=listings&published=1");
}
