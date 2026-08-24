export type SleepSchedule = "early" | "late" | "flexible";
export type GuestsFreq = "rare" | "sometimes" | "often";
export type SwipeDirection = "like" | "skip";
export type ListerResponse = "pending" | "liked" | "skipped";

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
  rent: number;
  available_from: string; // ISO date
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

export interface Message {
  id: string;
  match_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}
