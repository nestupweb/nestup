import type { PhotoRoom, PropertyType, SafeRoom } from "@/lib/types";

// Every city/town in Israel lives in lib/cities.ts (with the type-ahead helpers).
export { CITIES } from "@/lib/cities";

export const INTERESTS = [
  "Music", "Concerts", "Cooking", "Fitness", "Yoga", "Running", "Hiking",
  "Travel", "Gaming", "Movies & TV", "Reading", "Art", "Photography", "Tech",
  "Football", "Basketball", "Board games", "Nightlife", "Vegan food", "Volunteering",
] as const;

export const MIN_INTERESTS = 3;
export const MAX_INTERESTS = 10;
export const MIN_LISTING_PHOTOS = 3; // the swipe deck shows every room as a photo story
export const MAX_LISTING_PHOTOS = 10;

/** What a listing photo shows. `hints` pre-tag uploads from their file names. */
export const PHOTO_ROOMS = [
  { key: "living_room", label: "Living room", hints: ["living", "salon", "lounge"] },
  { key: "bedroom", label: "Bedroom", hints: ["bed", "room"] },
  { key: "bathroom", label: "Bathroom", hints: ["bath", "shower", "toilet", "wc"] },
  { key: "kitchen", label: "Kitchen", hints: ["kitchen"] },
  { key: "balcony", label: "Balcony", hints: ["balcony", "terrace", "garden", "yard"] },
  { key: "exterior", label: "Building / street", hints: ["building", "exterior", "street", "entrance"] },
  { key: "other", label: "Other", hints: [] },
] as const satisfies readonly { key: PhotoRoom; label: string; hints: readonly string[] }[];

export function photoRoomLabel(key: string): string {
  return PHOTO_ROOMS.find((r) => r.key === key)?.label ?? "Photo";
}

/** Mamad — the reinforced safe room. */
export const SAFE_ROOM_OPTIONS = [
  { key: "none", label: "None" },
  { key: "apartment", label: "In the apartment" },
  { key: "building", label: "In the building" },
] as const satisfies readonly { key: SafeRoom; label: string }[];

export function safeRoomLabel(key: SafeRoom): string {
  return SAFE_ROOM_OPTIONS.find((o) => o.key === key)?.label ?? "None";
}
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

export const PROPERTY_TYPES = [
  { key: "apartment", label: "Apartment" },
  { key: "garden_apartment", label: "Garden apartment" },
  { key: "penthouse", label: "Penthouse" },
  { key: "studio", label: "Studio" },
  { key: "duplex", label: "Duplex" },
  { key: "private_house", label: "Private house" },
] as const satisfies readonly { key: PropertyType; label: string }[];

export function propertyTypeLabel(key: PropertyType): string {
  return PROPERTY_TYPES.find((p) => p.key === key)?.label ?? key;
}

export const FEATURES = [
  { key: "balcony", label: "Balcony" },
  { key: "air_conditioning", label: "Air conditioning" },
  { key: "parking", label: "Parking" },
  { key: "elevator", label: "Elevator" },
  { key: "furnished", label: "Furnished" },
] as const;
