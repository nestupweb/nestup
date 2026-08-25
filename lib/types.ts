export type SleepSchedule = "early" | "late" | "flexible";
export type GuestsFreq = "rare" | "sometimes" | "often";
export type SwipeDirection = "like" | "skip";
export type ListerResponse = "pending" | "liked" | "skipped";
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
  smoker: boolean;
  has_pet: boolean;
  cleanliness: number; // 1..5
  sleep_schedule: SleepSchedule;
  guests_freq: GuestsFreq;
  interests: string[];
  ok_with_smoker: boolean;
  ok_with_pets: boolean;
  budget_min: number;
  budget_max: number; // 0 = not set
  preferred_cities: string[];
  earliest_move_in: string | null; // ISO date
  created_at: string;
  updated_at: string;
}

export interface Listing {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  city: string;
  neighborhood: string;
  address: string;
  rent: number;
  available_from: string; // ISO date
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
  photo_urls: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type ListingWithOwner = Listing & { owner: Profile };

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
