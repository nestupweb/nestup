"use server";

import { getAuthContext } from "@/lib/auth";
import { classifyListingPhoto, isPhotoCheckEnabled, listingPhotoPrefix, signPhotoVerdict } from "@/lib/photo-check";
import { photoRoomSchema } from "@/lib/validation/listing";
import type { PhotoSubject } from "@/lib/photo-rules";

export type PhotoCheckResult =
  | { ok: true; checked: false }
  | { ok: true; checked: true; subject: PhotoSubject; reason: string; token: string }
  | { ok: false; error: string };

/**
 * Looks at one uploaded listing photo and says what it shows. The browser
 * calls this the moment an upload lands (and again when a member re-tags a
 * photo that was never checked). The token that comes back is what
 * `saveListingAction` trusts at publish time.
 */
export async function checkListingPhotoAction(url: string, label: string): Promise<PhotoCheckResult> {
  if (!isPhotoCheckEnabled()) return { ok: true, checked: false };

  const { supabase, user } = await getAuthContext();
  if (!user) return { ok: false, error: "Please log in again to add photos." };
  if (typeof url !== "string" || !url.startsWith("https://")) return { ok: false, error: "That photo can't be checked." };

  // Only the member's own photos: their storage folder, or a photo already on one of their listings.
  const ownFolder = url.startsWith(`${listingPhotoPrefix()}${user.id}/`);
  if (!ownFolder) {
    const { data } = await supabase
      .from("listings")
      .select("id")
      .eq("owner_id", user.id)
      .contains("photo_urls", [url])
      .limit(1);
    if (!data || data.length === 0) return { ok: false, error: "That photo can't be checked." };
  }

  const room = photoRoomSchema.parse(label);
  try {
    const verdict = await classifyListingPhoto(url, room);
    return {
      ok: true,
      checked: true,
      subject: verdict.subject,
      reason: verdict.reason,
      token: signPhotoVerdict(process.env.ANTHROPIC_API_KEY!, url, verdict.subject),
    };
  } catch (e) {
    console.error("[photo-check]", e instanceof Error ? e.message : e);
    return { ok: false, error: "We couldn't check this photo right now — remove it and try again in a moment." };
  }
}
