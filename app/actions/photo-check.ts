"use server";

import { getAuthContext } from "@/lib/auth";
import { MAX_IMAGE_BYTES } from "@/lib/constants";
import {
  classifyListingPhoto,
  fetchPhotoBytes,
  isPhotoCheckEnabled,
  listingPhotoPrefix,
  photoCheckSecret,
  signPhotoVerdict,
  type PhotoBytes,
} from "@/lib/photo-check";
import { photoProblem, type PhotoSubject } from "@/lib/photo-rules";
import { uploadImage } from "@/lib/storage";
import { photoRoomSchema } from "@/lib/validation/listing";
import type { PhotoRoom } from "@/lib/types";

/**
 * What happened to one photo the member picked.
 *
 * `rejected` is the case this whole feature exists for: Gemini looked at the
 * bytes and they do not show the room the member tagged, so **nothing was
 * stored** and `message` is the line they read.
 */
export type PhotoCheckResult =
  | { ok: true; url: string; checked: false }
  | { ok: true; url: string; checked: true; subject: PhotoSubject; reason: string; token: string }
  | { ok: false; rejected: true; subject: PhotoSubject; reason: string; message: string }
  | { ok: false; rejected: false; error: string };

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Check one photo and, only if it passes, store it.
 *
 * The browser sends the compressed bytes rather than a URL, so the photo is
 * judged before it exists anywhere: a dog tagged "Living room", or a kitchen
 * tagged "Balcony", never reaches the `listing-photos` bucket at all. The
 * upload is done here too, which is what makes that guarantee hold — the
 * browser has no way to put an unchecked file in the bucket and then claim a
 * verdict for it.
 *
 * The token that comes back is what `saveListingAction` trusts at publish time.
 */
export async function checkAndUploadPhotoAction(formData: FormData): Promise<PhotoCheckResult> {
  const { supabase, user } = await getAuthContext();
  if (!user) return { ok: false, rejected: false, error: "Please log in again to add photos." };

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, rejected: false, error: "That file couldn't be read — please pick another photo." };
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return { ok: false, rejected: false, error: "Only JPG, PNG or WebP images are allowed." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, rejected: false, error: "Images must be 5 MB or smaller." };
  }

  const label = photoRoomSchema.parse(formData.get("label"));

  // No key: the check is off, and the photo is stored the way it was before
  // any of this existed.
  if (!isPhotoCheckEnabled()) {
    try {
      return { ok: true, url: await uploadImage(supabase, "listing-photos", user.id, file), checked: false };
    } catch (e) {
      return { ok: false, rejected: false, error: e instanceof Error ? e.message : "Upload failed." };
    }
  }

  const bytes: PhotoBytes = {
    base64: Buffer.from(await file.arrayBuffer()).toString("base64"),
    mimeType: file.type,
  };

  const verdict = await look(bytes, label);
  if (!verdict.ok) return verdict;

  const problem = photoProblem(verdict.subject, label);
  if (problem) {
    return { ok: false, rejected: true, subject: verdict.subject, reason: verdict.reason, message: problem };
  }

  try {
    const url = await uploadImage(supabase, "listing-photos", user.id, file);
    return {
      ok: true,
      url,
      checked: true,
      subject: verdict.subject,
      reason: verdict.reason,
      token: signPhotoVerdict(photoCheckSecret(), url, verdict.subject),
    };
  } catch (e) {
    return { ok: false, rejected: false, error: e instanceof Error ? e.message : "Upload failed." };
  }
}

/**
 * Check a photo that is already in the bucket. Only reached when a member
 * re-tags a photo saved before the check existed — a fresh photo is always
 * checked before it is stored.
 */
export async function checkStoredPhotoAction(url: string, label: string): Promise<PhotoCheckResult> {
  if (!isPhotoCheckEnabled()) return { ok: true, url, checked: false };

  const { supabase, user } = await getAuthContext();
  if (!user) return { ok: false, rejected: false, error: "Please log in again to add photos." };
  if (typeof url !== "string" || !url.startsWith(listingPhotoPrefix())) {
    return { ok: false, rejected: false, error: "That photo can't be checked." };
  }

  // Only the member's own photos: their storage folder, or a photo already on one of their listings.
  if (!url.startsWith(`${listingPhotoPrefix()}${user.id}/`)) {
    const { data } = await supabase
      .from("listings")
      .select("id")
      .eq("owner_id", user.id)
      .contains("photo_urls", [url])
      .limit(1);
    if (!data || data.length === 0) return { ok: false, rejected: false, error: "That photo can't be checked." };
  }

  const room = photoRoomSchema.parse(label);
  let bytes: PhotoBytes;
  try {
    bytes = await fetchPhotoBytes(url);
  } catch (e) {
    return { ok: false, rejected: false, error: e instanceof Error ? e.message : "That photo can't be checked." };
  }

  const verdict = await look(bytes, room);
  if (!verdict.ok) return verdict;

  const problem = photoProblem(verdict.subject, room);
  if (problem) {
    return { ok: false, rejected: true, subject: verdict.subject, reason: verdict.reason, message: problem };
  }
  return {
    ok: true,
    url,
    checked: true,
    subject: verdict.subject,
    reason: verdict.reason,
    token: signPhotoVerdict(photoCheckSecret(), url, verdict.subject),
  };
}

/** One look, with the API failure turned into a line the member can act on. */
async function look(
  bytes: PhotoBytes,
  label: PhotoRoom
): Promise<{ ok: true; subject: PhotoSubject; reason: string } | { ok: false; rejected: false; error: string }> {
  try {
    const verdict = await classifyListingPhoto(bytes, label);
    return { ok: true, subject: verdict.subject, reason: verdict.reason };
  } catch (e) {
    console.error("[photo-check]", e instanceof Error ? e.message : e);
    return { ok: false, rejected: false, error: "We couldn't check this photo right now — please try again in a moment." };
  }
}
