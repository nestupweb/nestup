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
import { cleanIds, tagCapError } from "@/lib/co-posters";
import { inviteRoommates } from "@/lib/invites";
import { auditPhotos, isPhotoCheckEnabled, photoCheckSecret } from "@/lib/photo-check";
import { geocodeAddress } from "@/lib/geocode";
import { shouldGeocode } from "@/lib/geo";
import type { CoordsSource, PhotoRoom } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ListingFormState = {
  error?: string;
};

/** What the room's coordinates should become, or a request for the owner's help. */
type Coords =
  | { columns: { lat: number; lng: number; coords_source: CoordsSource } }
  | { columns: Record<string, never> }
  | { unknownAddress: "missing" | "unavailable" };

/**
 * Where the room's pin goes.
 *
 * Order of authority: a pin the owner dragged wins outright; otherwise the
 * address is looked up, but only when it actually changed (or there is no
 * point yet) — so re-saving a listing to fix a typo in the description doesn't
 * make a network call.
 *
 * Every published room has a real address and a pin (user decision,
 * 2026-08-29). The lookup runs on its own and its answer is final:
 *
 *   found        — the pin is stored, and the room is on the map. Nothing is
 *                  asked of the owner; this is the whole point.
 *   missing      — the address does not exist. The save is refused, the same
 *                  way a missing rent would be. It used to open the map and
 *                  ask the owner to place the room by hand.
 *   unavailable  — we could not check. Also refused, because saving here would
 *                  publish a room that is on no map and whose address nobody
 *                  verified. `geocodeAddress` already retried, so this is rare
 *                  and clears on its own.
 *
 * A pin the owner dragged still wins outright: that is a deliberate correction
 * of a lookup, not a demand made of them, and it is the way a real address
 * Nominatim happens not to know still gets published.
 */
async function resolveCoords(
  supabase: SupabaseClient,
  listingId: string,
  userId: string,
  data: { street: string; house_number: string; city: string },
  formData: FormData
): Promise<Coords> {
  const pinLat = Number(formData.get("pin_lat"));
  const pinLng = Number(formData.get("pin_lng"));
  const pinned = formData.get("pin_moved") === "1" && Number.isFinite(pinLat) && Number.isFinite(pinLng);
  if (pinned) return { columns: { lat: pinLat, lng: pinLng, coords_source: "owner" } };

  let current: CoordsSource = "none";
  let addressChanged = true;
  if (listingId) {
    const { data: row } = await supabase
      .from("listings")
      .select("street, house_number, city, coords_source, lat")
      .eq("id", listingId)
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
  if (!shouldGeocode(current, addressChanged)) return { columns: {} };

  const hit = await geocodeAddress(data);
  if (hit.status === "found") {
    return { columns: { lat: hit.lat, lng: hit.lng, coords_source: "geocoded" } };
  }
  return { unknownAddress: hit.status };
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
    // Empty when the "specific gender only" toggle is off — the schema reads
    // that as null, i.e. open to anyone.
    wanted_gender: formData.get("wanted_gender") ?? "",
    food_restrictions: formData.get("food_restrictions") ?? "",
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (!issue) return { error: "Please check the form." };
    const field = issue.path.length ? String(issue.path[0]) : "";
    return { error: field ? `${FIELD_NAMES[field] ?? field}: ${issue.message}` : issue.message };
  }

  // Co-posters: the roommates tagged in the form. Checked here so a listing is
  // never published only to have the tags bounce — `invite_listing_roommates`
  // enforces the same cap underneath and is what actually decides.
  const taggedIds = cleanIds(formData.getAll("tagged_roommates"));
  const capError = tagCapError(taggedIds.length, parsed.data.roommates_count);
  if (capError) return { error: capError };

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

  // Who is saving: the creator, or a confirmed roommate who co-owns this room
  // (0033)? They may change everything about the listing alike — the one thing
  // only the creator does is tag roommates. A brand-new room has no owner but
  // the person publishing it.
  let isOwner = true;
  if (listingId) {
    const { data: ownerRow } = await supabase
      .from("listings")
      .select("owner_id")
      .eq("id", listingId)
      .maybeSingle();
    isOwner = (ownerRow as { owner_id: string } | null)?.owner_id === user.id;
  }

  if (isPhotoCheckEnabled()) {
    if (newFiles.length > 0) return { error: "Please add photos through the photo picker so they can be checked." };
    const trusted = new Map<string, PhotoRoom>();
    if (listingId) {
      const { data } = await supabase
        .from("listings")
        .select("photo_urls, photo_labels")
        .eq("id", listingId)
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
  if ("unknownAddress" in coords) {
    // Not `placePin`: the map is no longer opened to demand work. It stays
    // where it always was, for an owner who wants to correct a pin.
    return {
      error:
        coords.unknownAddress === "missing"
          ? `We couldn't find ${address}, ${parsed.data.city}. Check the street name and house number — or place the pin yourself on the map below.`
          : "We couldn't check that address just now. Please save again in a moment.",
    };
  }
  // `owner_id` is deliberately absent: it is set once, on insert. Since 0033 a
  // confirmed roommate saves this same record, and re-writing owner_id would
  // both hand them the room and trip the listings_owner_is_permanent trigger.
  const row = {
    ...parsed.data,
    title,
    address,
    ...coords.columns,
    photo_urls,
    photo_labels,
    viewing_slots,
    is_active,
    updated_at: new Date().toISOString(),
  };

  let publishedId = "";
  if (listingId) {
    // No `owner_id` filter any more — "the household updates their listing"
    // (0033) decides. A row RLS refuses comes back as zero rows and no error,
    // which would otherwise look like a silent success.
    const { data, error } = await supabase.from("listings").update(row).eq("id", listingId).select("id");
    if (error) return { error: "Could not save the listing. Please try again." };
    if (!data || data.length === 0) {
      return { error: "You can no longer edit this listing." };
    }
  } else {
    const { data, error } = await supabase
      .from("listings")
      .insert({ ...row, owner_id: user.id })
      .select("id")
      .single();
    if (error) return { error: "Could not save the listing. Please try again." };
    publishedId = (data as { id: string }).id;
  }

  // The room is live for its creator either way — that is what "publish"
  // means, and it has already happened by this line. The tagged roommates are
  // only *asked*; each of them decides for themselves whether the room joins
  // their own My Listings. A failure here is reported without pretending the
  // listing didn't save, because it did.
  // Tagging is the creator's alone (0033 kept `invite_listing_roommates`
  // owner-only), so a co-owner saving the form skips it rather than being told
  // off by the database for a picker they were never shown.
  const savedId = listingId || publishedId;
  if (isOwner) {
    const invited = await inviteRoommates(supabase, savedId, taggedIds);
    if (invited.error) {
      return { error: `Your listing is saved, but your roommates weren’t added — ${invited.error}` };
    }
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
 * Taking down a room the member manages — since 0033 that is the creator OR any
 * confirmed roommate, who has the same buttons. There is no `owner_id` filter
 * left to scope it: `remove_listing` and the RLS policies behind it are what
 * decide, so a forged `listing_id` matches only a room the caller is really
 * part of, and the function answers -1 when it is not.
 *
 * It is a one-way door for the whole household: any co-owner can take the room
 * down for all of them, and nothing puts it back.
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

  const { supabase } = await requireUser();
  // The notice names the room, so read the title before it goes.
  const { data: row } = await supabase
    .from("listings")
    .select("title")
    .eq("id", listingId)
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
