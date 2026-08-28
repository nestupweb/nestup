"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { uploadImage } from "@/lib/storage";
import { listingSchema, missingPhotoRooms, photoRoomSchema } from "@/lib/validation/listing";
import { buildListingTitle } from "@/lib/listing-title";
import { MAX_LISTING_PHOTOS, MIN_LISTING_PHOTOS, photoRoomLabel } from "@/lib/constants";
import { defaultRemovedMessage } from "@/lib/listing-taken";
import { normalizeSlots, type ViewingSlot } from "@/lib/availability";
import { notifyNewListing } from "@/lib/notify";
import { auditPhotos, isPhotoCheckEnabled, photoCheckSecret } from "@/lib/photo-check";
import { geocodeAddress } from "@/lib/geocode";
import { shouldGeocode } from "@/lib/geo";
import type { CoordsSource, PhotoRoom } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ListingFormState = { error?: string };

/**
 * Where the room's pin goes.
 *
 * Order of authority: a pin the owner dragged wins outright; otherwise the
 * address is looked up, but only when it actually changed (or there is no
 * point yet) — so re-saving a listing to fix a typo in the description doesn't
 * make a network call. A failed lookup falls back to the city centre inside
 * `geocodeAddress`, and a total failure leaves the columns untouched, because a
 * listing that cannot be placed on a map must still save.
 */
async function resolveCoords(
  supabase: SupabaseClient,
  listingId: string,
  userId: string,
  data: { street: string; house_number: string; city: string },
  formData: FormData
): Promise<{ lat: number; lng: number; coords_source: CoordsSource } | Record<string, never>> {
  const pinLat = Number(formData.get("pin_lat"));
  const pinLng = Number(formData.get("pin_lng"));
  const pinned = formData.get("pin_moved") === "1" && Number.isFinite(pinLat) && Number.isFinite(pinLng);
  if (pinned) return { lat: pinLat, lng: pinLng, coords_source: "owner" };

  let current: CoordsSource = "none";
  let addressChanged = true;
  if (listingId) {
    const { data: row } = await supabase
      .from("listings")
      .select("street, house_number, city, coords_source, lat")
      .eq("id", listingId)
      .eq("owner_id", userId)
      .maybeSingle();
    const prev = row as
      | { street: string; house_number: string; city: string; coords_source: CoordsSource; lat: number | null }
      | null;
    if (prev) {
      current = prev.lat === null ? "none" : prev.coords_source;
      addressChanged =
        prev.street !== data.street || prev.house_number !== data.house_number || prev.city !== data.city;
    }
  }
  if (!shouldGeocode(current, addressChanged)) return {};

  const hit = await geocodeAddress(data);
  return hit ? { lat: hit.lat, lng: hit.lng, coords_source: hit.source } : {};
}

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
    lease_term: formData.get("lease_term") ?? undefined, // older forms: schema default
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
  if (formData.get("photos_flagged")) {
    return { error: "One of your photos doesn't match its tag — fix or remove the flagged photo first." };
  }

  // Photos arrive as public URLs (uploaded from the browser) with a room label
  // each; `photos` files are still accepted for older clients.
  const keptUrls = formData.getAll("existing_photos").map(String).filter((u) => u.startsWith("https://"));
  const keptLabels = formData.getAll("existing_labels").map((l) => photoRoomSchema.parse(String(l)));
  const keptTokens = formData.getAll("photo_tokens").map(String);
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

  // Every photo was looked at when it was uploaded; publish only accepts photos
  // whose signed verdict fits the tag (or pairs already saved on this listing).
  const listingId = String(formData.get("listing_id") ?? "");
  if (isPhotoCheckEnabled()) {
    if (newFiles.length > 0) return { error: "Please add photos through the photo picker so they can be checked." };
    const trusted = new Map<string, PhotoRoom>();
    if (listingId) {
      const { data } = await supabase
        .from("listings")
        .select("photo_urls, photo_labels")
        .eq("id", listingId)
        .eq("owner_id", user.id)
        .maybeSingle();
      const row = data as { photo_urls: string[]; photo_labels: string[] | null } | null;
      row?.photo_urls.forEach((u, i) => trusted.set(u, photoRoomSchema.parse(row.photo_labels?.[i] ?? "other")));
    }
    const bad = auditPhotos({
      urls: keptUrls,
      labels: keptUrls.map((_, i) => keptLabels[i] ?? "other"),
      tokens: keptTokens,
      trusted,
      secret: photoCheckSecret(),
    });
    if (bad) return { error: `Photo ${bad.index + 1}: ${bad.message}` };
  }

  const photo_urls = [...keptUrls];
  for (const file of newFiles) {
    try {
      photo_urls.push(await uploadImage(supabase, "listing-photos", user.id, file));
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Photo upload failed." };
    }
  }

  const is_active = formData.get("is_active") !== null ? formData.get("is_active") === "on" : true;
  const address = `${parsed.data.street} ${parsed.data.house_number}`.trim();
  const title = buildListingTitle(parsed.data);
  const coords = await resolveCoords(supabase, listingId, user.id, parsed.data, formData);
  const row = {
    ...parsed.data,
    title,
    address,
    ...coords,
    photo_urls,
    photo_labels,
    viewing_slots,
    is_active,
    owner_id: user.id,
    updated_at: new Date().toISOString(),
  };

  let publishedId = "";
  if (listingId) {
    const { error } = await supabase.from("listings").update(row).eq("id", listingId).eq("owner_id", user.id);
    if (error) return { error: "Could not save the listing. Please try again." };
  } else {
    const { data, error } = await supabase.from("listings").insert(row).select("id").single();
    if (error) return { error: "Could not save the listing. Please try again." };
    publishedId = (data as { id: string }).id;
  }

  // A brand-new room tells the seekers who asked to hear about matches. It runs
  // after the response so publishing stays fast, and `notifyNewListing` swallows
  // its own failures — mail must never turn a successful publish into an error.
  if (publishedId && is_active) after(() => notifyNewListing(publishedId));

  revalidatePath("/listing");
  revalidatePath("/browse");
  revalidatePath("/profile");
  revalidatePath("/swipe");
  // Saving is silent: no confirmation line — the form hands the member back to
  // their profile, on the My-listing tab, where the saved room is on screen.
  if (listingId) redirect("/profile?tab=listings");
  // Freshly published: show it where it now lives (Listings, My Listings, seekers' decks).
  redirect("/profile?tab=listings&published=1");
}

export type DeleteListingState = { error?: string };

/**
 * Deleting the member's own room. Scoped by `owner_id` as well as `id`, so a
 * forged `listing_id` can only ever match something the signed-in member
 * already owns; RLS enforces the same rule underneath.
 *
 * It does not delete the row. A real delete cascades to the conversations about
 * the room and every message in them (0001/0004) — so the people who wrote
 * those messages would lose them, and the notice sent on the way out would be
 * destroyed with the thread. Instead `remove_listing` (0028) stamps
 * `removed_at`, which takes the room out of Listings, Swipe, the owner's
 * profile and its own page for good, and sends everyone in a conversation about
 * it the same message "The room is taken" sends, minus the part about a deal —
 * a room can be pulled for any reason. Chats keep working; the room does not
 * come back.
 */
export async function deleteListingAction(
  _prev: DeleteListingState,
  formData: FormData
): Promise<DeleteListingState> {
  const listingId = String(formData.get("listing_id") ?? "").trim();
  if (!listingId) return { error: "Could not tell which listing to delete." };

  const { supabase, user } = await requireUser();
  // The notice names the room, so read the title before it goes.
  const { data: row } = await supabase
    .from("listings")
    .select("title")
    .eq("id", listingId)
    .eq("owner_id", user.id)
    .is("removed_at", null)
    .maybeSingle();
  if (!row) return { error: "That listing is already gone." };

  const { data, error } = await supabase.rpc("remove_listing", {
    p_listing: listingId,
    p_message: defaultRemovedMessage(String((row as { title: string }).title ?? "")),
  });
  if (error) return { error: "Could not delete the listing. Please try again." };
  if (data === -1) return { error: "That listing is already gone." };

  revalidatePath("/listing");
  revalidatePath("/browse");
  revalidatePath("/profile");
  revalidatePath("/swipe");
  revalidatePath("/chat");
  redirect("/profile?tab=listings");
}
