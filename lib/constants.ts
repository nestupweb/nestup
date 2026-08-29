import type {
  Amenity,
  Diet,
  GuestsFreq,
  LeaseTerm,
  NoiseLevel,
  PhotoRoom,
  PrefDiet,
  PrefGuests,
  PrefLeaseTerm,
  PrefNoise,
  PrefSafeRoom,
  PrefShabbat,
  PrefSleep,
  PropertyType,
  SafeRoom,
  Shabbat,
  SleepSchedule,
} from "@/lib/types";

// Every city/town in Israel lives in lib/cities.ts (with the type-ahead helpers).
export { CITIES } from "@/lib/cities";

export const INTERESTS = [
  "Music", "Concerts", "Cooking", "Baking", "Coffee", "Foodie", "Wine & beer", "Vegan food",
  "Fitness", "Yoga", "Pilates", "Running", "Cycling", "Swimming", "Surfing", "Climbing", "Hiking", "Camping", "Beach",
  "Football", "Basketball", "Tennis", "Dancing", "Meditation",
  "Travel", "Languages", "Volunteering", "Politics", "Startups", "Tech", "Science",
  "Gaming", "Board games", "Chess", "Anime", "Movies & TV", "Podcasts", "Theatre", "Live music", "Nightlife",
  "Reading", "Writing", "Art", "Photography", "Crafts & DIY", "Fashion", "Design", "Plants", "Pets & animals",
] as const;

export const MIN_INTERESTS = 3;
export const MAX_INTERESTS = 12;

/** Budget slider on the profile: ₪0 … ₪15,000 in ₪100 steps; the top means "no max". */
export const BUDGET_CAP = 15000;
export const BUDGET_STEP = 100;

// --- Daily life: how I live (left column) vs. what I want in roommates (right) ---
export const SLEEP_SCHEDULES = [
  { key: "early", label: "Early riser" },
  { key: "late", label: "Night owl" },
  { key: "flexible", label: "Flexible" },
] as const satisfies readonly { key: SleepSchedule; label: string }[];
export const GUEST_FREQS = [
  { key: "rare", label: "Rarely" },
  { key: "sometimes", label: "Sometimes" },
  { key: "often", label: "Often" },
] as const satisfies readonly { key: GuestsFreq; label: string }[];
export const NOISE_LEVELS = [
  { key: "quiet", label: "Quiet" },
  { key: "moderate", label: "Moderate" },
  { key: "lively", label: "Lively" },
] as const satisfies readonly { key: NoiseLevel; label: string }[];
export const DIETS = [
  { key: "none", label: "No restrictions" },
  { key: "kosher", label: "Kosher" },
  { key: "vegetarian", label: "Vegetarian" },
  { key: "vegan", label: "Vegan" },
  { key: "halal", label: "Halal" },
  { key: "gluten_free", label: "Gluten-free" },
  { key: "other", label: "Other" },
] as const satisfies readonly { key: Diet; label: string }[];
export const CLEANLINESS_LEVELS = [
  { key: 1, label: "1 · Relaxed" },
  { key: 2, label: "2 · Easygoing" },
  { key: 3, label: "3 · Tidy enough" },
  { key: 4, label: "4 · Neat" },
  { key: 5, label: "5 · Spotless" },
] as const;
export const PREF_CLEANLINESS = [
  { key: 1, label: "Any level" },
  { key: 2, label: "At least 2 · Easygoing" },
  { key: 3, label: "At least 3 · Tidy enough" },
  { key: 4, label: "At least 4 · Neat" },
  { key: 5, label: "5 · Spotless only" },
] as const;
export const PREF_SLEEP = [
  { key: "any", label: "Any schedule" },
  { key: "early", label: "Early risers" },
  { key: "late", label: "Night owls" },
] as const satisfies readonly { key: PrefSleep; label: string }[];
export const PREF_GUESTS = [
  { key: "any", label: "Guests are fine" },
  { key: "sometimes", label: "Sometimes is fine" },
  { key: "rare", label: "Rarely, please" },
] as const satisfies readonly { key: PrefGuests; label: string }[];
export const PREF_NOISE = [
  { key: "any", label: "Any noise level" },
  { key: "moderate", label: "Moderate at most" },
  { key: "quiet", label: "Quiet, please" },
] as const satisfies readonly { key: PrefNoise; label: string }[];
export const PREF_DIET = [
  { key: "any", label: "No requirement" },
  { key: "kosher", label: "Keeps kosher" },
  { key: "vegetarian", label: "Vegetarian or vegan" },
  { key: "vegan", label: "Vegan" },
] as const satisfies readonly { key: PrefDiet; label: string }[];
export const SHABBAT_LEVELS = [
  { key: "", label: "Prefer not to say" },
  { key: "observant", label: "Observant" },
  { key: "traditional", label: "Traditional" },
  { key: "not_observant", label: "Not observant" },
] as const satisfies readonly { key: Shabbat; label: string }[];
export const PREF_SHABBAT = [
  { key: "any", label: "No preference" },
  { key: "traditional", label: "Traditional or observant" },
  { key: "observant", label: "Observant only" },
  { key: "not_observant", label: "Not observant" },
] as const satisfies readonly { key: PrefShabbat; label: string }[];

/** Household chores a member can offer to take on (profile `chores`). */
export const CHORES = [
  "Dishes", "Cooking", "Sweeping & vacuuming", "Mopping", "Bathroom cleaning", "Kitchen cleaning",
  "Laundry", "Taking out the trash", "Grocery shopping", "Tidying shared spaces", "Watering plants", "Recycling",
] as const;

/** Approximate, full-hour wake-up / bedtime choices (stored as HH:MM; "" = not set). */
export const WAKE_TIMES = ["05:00", "06:00", "07:00", "08:00", "09:00", "10:00", "11:00", "12:00"] as const;
export const BED_TIMES = ["20:00", "21:00", "22:00", "23:00", "00:00", "01:00", "02:00", "03:00"] as const;

export function optionLabel<K extends string | number>(options: readonly { key: K; label: string }[], key: K): string {
  return options.find((o) => o.key === key)?.label ?? String(key);
}
export const MIN_LISTING_PHOTOS = 3; // the swipe deck shows every room as a photo story
export const MAX_LISTING_PHOTOS = 10;

/** What a listing photo shows. `hints` pre-tag uploads from their file names. */
export const PHOTO_ROOMS = [
  { key: "living_room", label: "Living room", hints: ["living", "salon", "lounge"] },
  // No bare "room" hint: it also matches bathroom.jpg and living-room.jpg.
  { key: "bedroom", label: "Bedroom", hints: ["bed"] },
  { key: "bathroom", label: "Bathroom", hints: ["bath", "shower", "toilet", "wc"] },
  { key: "kitchen", label: "Kitchen", hints: ["kitchen"] },
  { key: "balcony", label: "Balcony", hints: ["balcony", "terrace", "garden", "yard"] },
  { key: "exterior", label: "Building / street", hints: ["building", "exterior", "street", "entrance"] },
  // Legacy: no longer offered when adding photos (a photo has to say which room
  // it shows), but still a valid stored label — listings published before the
  // change, and the seed set, carry it, and `photoRoomLabel` must keep reading it.
  { key: "other", label: "Other", hints: [] },
] as const satisfies readonly { key: PhotoRoom; label: string; hints: readonly string[] }[];

/** The rooms a member can actually tag a photo with — every real room, no "Other". */
export const PHOTO_ROOM_CHOICES = PHOTO_ROOMS.filter((r) => r.key !== "other");

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

/**
 * The same thing from the seeker's side, in a profile.
 *
 * Not a straight copy of `SAFE_ROOM_OPTIONS`: listing a room with no mamad at
 * all isn't something anyone searches for, so "none" has no seeker-side twin.
 * "In the building" replaced "In the apartment" on 2026-08-29 at the user's
 * request — Browse still offers both places, this asks only how far someone is
 * willing to walk to it.
 */
export const PREF_SAFE_ROOMS = [
  { key: "any", label: "No preference" },
  { key: "has", label: "Has one" },
  { key: "building", label: "In the building" },
] as const satisfies readonly { key: PrefSafeRoom; label: string }[];

export function prefSafeRoomLabel(key: PrefSafeRoom): string {
  return PREF_SAFE_ROOMS.find((o) => o.key === key)?.label ?? "No preference";
}

/** Browse's version, which can also ask for the building specifically. */
export const SAFE_ROOM_FILTERS = [
  { key: "has", label: "Has one" },
  { key: "apartment", label: "In the apartment" },
  { key: "building", label: "In the building" },
] as const;

/** For how long the room is offered — rough durations only, never an end date. */
export const LEASE_TERMS = [
  { key: "flexible", label: "Flexible" },
  { key: "month", label: "A month" },
  { key: "two_months", label: "2 months" },
  { key: "three_months", label: "3 months" },
  { key: "half_year", label: "Half a year" },
  { key: "year", label: "A year" },
  { key: "two_years", label: "2 years" },
  { key: "long_term", label: "Long-term" },
] as const satisfies readonly { key: LeaseTerm; label: string }[];

export function leaseTermLabel(key: LeaseTerm): string {
  return LEASE_TERMS.find((o) => o.key === key)?.label ?? "Flexible";
}

/** The seeker's side of LEASE_TERMS: the same durations, with "no preference" first. */
export const PREF_LEASE_TERMS = [
  { key: "any", label: "No preference" },
  ...LEASE_TERMS,
] as const satisfies readonly { key: PrefLeaseTerm; label: string }[];

export function prefLeaseTermLabel(key: PrefLeaseTerm): string {
  return PREF_LEASE_TERMS.find((o) => o.key === key)?.label ?? "No preference";
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
] as const satisfies readonly { key: Amenity; label: string }[];

/**
 * The same list from the seeker's side, for Profile › Amenities.
 *
 * The listing's own features, verbatim — a member asking for a balcony and an
 * owner ticking "balcony" have to mean the same thing or the two sides never
 * meet. Pets and smoking are deliberately absent: they're house rules rather
 * than amenities, and the profile already asks about both in Daily life.
 */
export const PREF_AMENITIES = FEATURES;

export function amenityLabel(key: Amenity): string {
  return FEATURES.find((f) => f.key === key)?.label ?? key;
}
