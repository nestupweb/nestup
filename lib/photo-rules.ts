import { photoRoomLabel } from "@/lib/constants";
import type { PhotoRoom } from "@/lib/types";

/**
 * What a listing photo actually shows, as judged by the vision check. The six
 * concrete rooms mirror the tags a member can pick; the last two are the
 * "some other part of a home" and "not a home at all" buckets.
 */
export const PHOTO_SUBJECTS = [
  "living_room", "bedroom", "bathroom", "kitchen", "balcony", "exterior",
  "other_apartment", "not_apartment",
] as const;
export type PhotoSubject = (typeof PHOTO_SUBJECTS)[number];

/** Tags that must match the photo exactly — the deck's photo story depends on them. */
export const STRICT_PHOTO_ROOMS: readonly PhotoRoom[] = ["living_room", "bedroom", "bathroom"];

export function isPhotoSubject(v: unknown): v is PhotoSubject {
  return typeof v === "string" && (PHOTO_SUBJECTS as readonly string[]).includes(v);
}

/** Wording for a subject inside a sentence ("this looks like a bedroom"). */
export function photoSubjectPhrase(subject: PhotoSubject): string {
  switch (subject) {
    case "living_room": return "a living room";
    case "bedroom": return "a bedroom";
    case "bathroom": return "a bathroom";
    case "kitchen": return "a kitchen";
    case "balcony": return "a balcony";
    case "exterior": return "the building from outside";
    case "other_apartment": return "another part of the home";
    case "not_apartment": return "something other than a home";
  }
}

/**
 * Does a photo showing `subject` belong under `label`? Living room, bedroom
 * and bathroom must match exactly; every other tag only needs the photo to be
 * of the apartment at all (a kitchen tagged "Other" is fine, a dog is not).
 */
export function photoFits(subject: PhotoSubject, label: PhotoRoom): boolean {
  if (subject === "not_apartment") return false;
  if (STRICT_PHOTO_ROOMS.includes(label)) return subject === label;
  return true;
}

/** Null when the photo fits its tag; otherwise a sentence for the uploader. */
export function photoProblem(subject: PhotoSubject, label: PhotoRoom): string | null {
  if (photoFits(subject, label)) return null;
  const tag = photoRoomLabel(label).toLowerCase();
  if (subject === "not_apartment") {
    return `This isn't a photo of the apartment — add a photo of the ${tag} instead.`;
  }
  if (subject === "other_apartment") {
    return `We couldn't see a ${tag} here — pick a photo that clearly shows the ${tag}, or tag this one as Other.`;
  }
  return `This looks like ${photoSubjectPhrase(subject)}, not a ${tag} — tag it as ${photoRoomLabel(subject)} or pick another photo.`;
}

/** The tag a checked photo should carry when its subject is one of the six rooms. */
export function suggestedRoom(subject: PhotoSubject): PhotoRoom | null {
  return subject === "other_apartment" || subject === "not_apartment" ? null : subject;
}
