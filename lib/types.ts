import type { ViewingSlot } from "@/lib/availability";

export type SleepSchedule = "early" | "late" | "flexible";
export type GuestsFreq = "rare" | "sometimes" | "often";
export type NoiseLevel = "quiet" | "moderate" | "lively";
export type Diet = "none" | "kosher" | "vegetarian" | "vegan" | "halal" | "gluten_free" | "other";
/** "What I want in roommates" — `any` means no requirement. */
export type PrefSleep = "any" | "early" | "late";
export type PrefGuests = "any" | "rare" | "sometimes"; // the most guests I'm fine with
export type PrefNoise = "any" | "quiet" | "moderate"; // the most noise I'm fine with
export type PrefDiet = "any" | "kosher" | "vegetarian" | "vegan";
export type Shabbat = "" | "observant" | "traditional" | "not_observant"; // "" = prefer not to say
export type PrefShabbat = "any" | "observant" | "traditional" | "not_observant"; // traditional = traditional or observant
export type SwipeDirection = "like" | "skip";
export type ListerResponse = "pending" | "liked" | "skipped";
export type SafeRoom = "none" | "apartment" | "building";
/** The seeker's side of it: "any" = no preference, "has" = one anywhere in the building. */
export type PrefSafeRoom = "any" | "has" | "apartment";
/** Where a listing's map point came from; see migration 0026. */
export type CoordsSource = "none" | "city" | "geocoded" | "owner";
/** How long the room is offered for — a rough duration, never an end date. */
export type LeaseTerm = "flexible" | "month" | "two_months" | "three_months" | "half_year" | "year" | "two_years" | "long_term";
/** The same durations on the seeker side, plus "no preference". */
export type PrefLeaseTerm = "any" | LeaseTerm;
export type PhotoRoom = "living_room" | "bedroom" | "bathroom" | "kitchen" | "balcony" | "exterior" | "other";
export type PropertyType =
  | "apartment"
  | "garden_apartment"
  | "penthouse"
  | "studio"
  | "duplex"
  | "private_house";

export interface Profile {
  user_id: string;
  full_name: string;
  age: number;
  occupation: string;
  bio: string;
  avatar_url: string | null;
  // The Daily life table. `null` is "not answered yet" (migration 0035) — the
  // column used to be NOT NULL with a default, which put words in the member's
  // mouth. Read these through `withDailyLifeDefaults` (lib/daily-life.ts)
  // before scoring; `isDailyLifeComplete` is what /swipe requires.
  smoker: boolean | null;
  has_pet: boolean | null;
  cleanliness: number | null; // 1..5
  sleep_schedule: SleepSchedule | null;
  guests_freq: GuestsFreq | null;
  noise_level: NoiseLevel | null;
  diet: Diet | null;
  shabbat: Shabbat | null;
  interests: string[];
  chores: string[]; // household chores I'm happy to take on (CHORES)
  // What I want in roommates (the right-hand column of Daily life)
  ok_with_smoker: boolean | null;
  ok_with_pets: boolean | null;
  pref_cleanliness: number | null; // 1..5 — at least this tidy
  pref_sleep: PrefSleep | null;
  pref_guests: PrefGuests | null;
  pref_noise: PrefNoise | null;
  pref_diet: PrefDiet | null;
  pref_shabbat: PrefShabbat | null;
  budget_min: number;
  budget_max: number; // 0 = not set
  preferred_cities: string[];
  earliest_move_in: string | null; // ISO date
  pref_lease_term: PrefLeaseTerm; // for how long I want to rent; "any" = no preference
  pref_safe_room: PrefSafeRoom; // the mamad I want; "any" = no preference
  notify_new_matches: boolean; // e-mail me when a newly published room matches my preferences
  created_at: string;
  updated_at: string;
}

/** Private "About me" details — owner-only table `profile_details`. */
export interface ProfileDetails {
  user_id: string;
  about: string;
  languages: string[];
  diet: string;
  pet_details: string;
  lifestyle: string;
  wake_time: string; // "HH:MM" or ""
  bed_time: string;
  shabbat: "" | "observant" | "traditional" | "not_observant";
  cooking: string;
  phone: string;
  contact_email: string;
  show_phone: boolean; // other members may see my phone number
  show_contact_email: boolean; // …and my contact e-mail
  instagram: string;
  facebook: string;
  linkedin: string;
  /** Own default "hello" for Swipe likes; "" = the built-in text (no host name). */
  intro_template: string;
  updated_at: string;
}

export interface Listing {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  city: string;
  neighborhood: string;
  address: string; // display string: "{street} {house_number}"
  street: string;
  house_number: string;
  /** Map position; null until the address is geocoded. See `coords_source`. */
  lat: number | null;
  lng: number | null;
  /** How the point was obtained — an owner-placed pin outranks a later geocode. */
  coords_source: CoordsSource;
  rent: number;
  available_from: string; // ISO date — the entrance date
  lease_term: LeaseTerm; // for how long (rough duration)
  property_type: PropertyType;
  rooms: number; // halves allowed, e.g. 3.5
  size_sqm: number | null;
  roommates_count: number;
  pets_allowed: boolean;
  smoking_allowed: boolean;
  balcony: boolean;
  air_conditioning: boolean;
  parking: boolean;
  elevator: boolean;
  furnished: boolean;
  safe_room: SafeRoom;
  food_restrictions: string;
  photo_urls: string[];
  photo_labels: string[]; // PhotoRoom per photo, same order as photo_urls
  viewing_slots: ViewingSlot[]; // weekly viewing hours; empty = any time
  is_active: boolean;
  /** When the owner marked the room taken (deal done); null = still available. */
  taken_at: string | null;
  /** When the owner deleted the room; non-null = gone from every list, chats kept. */
  removed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ListingWithOwner = Listing & { owner: Profile };

/** Where a co-poster invitation stands. See migration 0032. */
export type ListingInviteStatus = "pending" | "accepted" | "declined";

/**
 * One "come and co-post this room with me" — the asking, not the membership.
 * Accepting writes a `listing_residents` row; declining never does, and the
 * row stays behind only so the creator's next save doesn't ask again.
 */
export interface ListingInvite {
  id: string;
  listing_id: string;
  invitee_id: string;
  inviter_id: string;
  status: ListingInviteStatus;
  created_at: string;
  responded_at: string | null;
}

export interface Swipe {
  id: string;
  seeker_id: string;
  listing_id: string;
  direction: SwipeDirection;
  lister_response: ListerResponse;
  created_at: string;
}

export interface Match {
  id: string;
  listing_id: string;
  seeker_id: string;
  lister_id: string;
  created_at: string;
}

/** One chat thread per (listing, seeker) — no match required to start. */
export interface Conversation {
  id: string;
  listing_id: string;
  seeker_id: string;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  image_path: string | null; // `chat-images` bucket, `<conversation>/<uuid>.<ext>`
  image_url?: string; // short-lived signed URL, filled in by the page
  client_id?: string | null; // browser-generated; makes sends idempotent (migration 0015)
  created_at: string;
}

/** Someone living in the room's home: the host first, then roommates. */
export interface HouseholdMember {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
}

/** One inbox row — the shape returned by the `my_conversations()` SQL function. */
export interface ConversationSummary {
  id: string;
  listing_id: string;
  listing_title: string;
  listing_city: string;
  listing_address: string;
  listing_rent: number;
  listing_photo: string | null;
  seeker_id: string;
  owner_id: string;
  other_user_id: string;
  other_name: string | null;
  other_avatar: string | null;
  last_message: string | null;
  last_message_at: string | null;
  last_sender_id: string | null;
  unread_count: number;
  created_at: string;
  household: HouseholdMember[];
  listing_viewing_slots: unknown; // jsonb → normalizeSlots()
  /** Next confirmed viewing that hasn't ended (null when none) — ring + "Viewing scheduled". */
  next_viewing_starts_at: string | null;
  next_viewing_ends_at: string | null;
  /**
   * When this member deleted the chat (null if never). Everything at or before
   * it is hidden from them alone; with no `last_message_at` past it the row is
   * left out of the inbox entirely — see `visibleConversations`.
   */
  cleared_at: string | null;
}

export type ViewingStatus = "proposed" | "confirmed" | "declined" | "cancelled";

/** A viewing proposed from inside a chat; optionally mirrored to Google Calendar. */
export interface Viewing {
  id: string;
  conversation_id: string;
  proposed_by: string;
  starts_at: string;
  ends_at: string;
  status: ViewingStatus;
  note: string;
  google_event_id: string | null;
  google_event_link: string | null;
  created_at: string;
}

export interface GoogleToken {
  user_id: string;
  refresh_token: string;
  access_token: string;
  expires_at: string;
  email: string;
  updated_at: string;
}
