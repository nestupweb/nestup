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

/**
 * Every tag a member can pick must match the photo exactly: a photo tagged
 * "Kitchen" has to show a kitchen, a photo tagged "Balcony" a balcony. Only
 * the legacy "Other" tag — no longer offered, but still stored on listings
 * published before it was retired — accepts any photo of the home.
 */
export const STRICT_PHOTO_ROOMS: readonly PhotoRoom[] = [
  "living_room", "bedroom", "bathroom", "kitchen", "balcony", "exterior",
];

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
 * Wording for a *tag* inside a sentence. The six real tags read the same as
 * their subject; "Other" is the one tag with no single thing to show.
 */
export function photoRoomPhrase(label: PhotoRoom): string {
  return label === "other" ? "another part of the home" : photoSubjectPhrase(label);
}

/**
 * Does a photo showing `subject` belong under `label`? Every tag a member can
 * pick has to match exactly; the retired "Other" tag only needs the photo to
 * be of the apartment at all.
 */
export function photoFits(subject: PhotoSubject, label: PhotoRoom): boolean {
  if (subject === "not_apartment") return false;
  if (STRICT_PHOTO_ROOMS.includes(label)) return subject === label;
  return true;
}

/**
 * Null when the photo fits its tag; otherwise the sentence the uploader reads.
 * Each one says what the photo shows and asks for the photo we actually want,
 * because the upload is refused outright — there is no half-accepted state.
 */
export function photoProblem(subject: PhotoSubject, label: PhotoRoom): string | null {
  if (photoFits(subject, label)) return null;
  const want = photoRoomPhrase(label);
  if (subject === "not_apartment") {
    return `This isn't a photo of the apartment — please upload a photo of ${want} instead.`;
  }
  if (subject === "other_apartment") {
    return `We couldn't see ${want} in this photo — please upload one that clearly shows ${want}.`;
  }
  return `This looks like ${photoSubjectPhrase(subject)}, not ${want} — tag it as ${photoRoomLabel(subject)} or upload a photo of ${want}.`;
}

/** The tag a checked photo should carry when its subject is one of the six rooms. */
export function suggestedRoom(subject: PhotoSubject): PhotoRoom | null {
  return subject === "other_apartment" || subject === "not_apartment" ? null : subject;
}
