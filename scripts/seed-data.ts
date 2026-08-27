/**
 * Demo data for `scripts/seed.ts`: 12 handcrafted owners, 80 generated ones
 * (first wave), 62 more (second wave) and a third wave covering every
 * remaining city in the country — each with a portrait and one active listing. Pure module — no env,
 * no I/O — so `tests/unit/seed-data.test.ts` can check it against the DB
 * constraints. Generation is deterministic (fixed PRNG seed): running the
 * seed twice produces the same people and rooms.
 *
 * Cities and interests are duplicated from `lib/constants.ts` on purpose:
 * this file runs under Node's native TS loader (`npm run seed`), which can't
 * resolve the `@/` alias, and the unit test asserts the two lists agree.
 * (Relative `../lib/*.ts` imports do work, and the third wave uses them.)
 */
import { CITIES as ALL_CITIES } from "../lib/cities.ts";
import { CITY_CENTRES } from "../lib/city-centres.ts";
import { distanceM } from "../lib/geo.ts";

export type SleepSchedule = "early" | "late" | "flexible";
export type GuestsFreq = "rare" | "sometimes" | "often";
export type LeaseTerm = "flexible" | "month" | "two_months" | "three_months" | "half_year" | "year" | "two_years" | "long_term";
export type PropertyType =
  | "apartment"
  | "garden_apartment"
  | "penthouse"
  | "studio"
  | "duplex"
  | "private_house";

export interface SeedProfile {
  full_name: string;
  age: number;
  occupation: string;
  bio: string;
  avatar_url: string | null;
  smoker: boolean;
  has_pet: boolean;
  cleanliness: number;
  sleep_schedule: SleepSchedule;
  guests_freq: GuestsFreq;
  interests: string[];
  ok_with_smoker: boolean;
  ok_with_pets: boolean;
  // Daily life (optional — the database defaults are neutral)
  noise_level?: "quiet" | "moderate" | "lively";
  diet?: "none" | "kosher" | "vegetarian" | "vegan" | "halal" | "gluten_free" | "other";
  pref_cleanliness?: number;
  pref_sleep?: "any" | "early" | "late";
  pref_guests?: "any" | "rare" | "sometimes";
  pref_noise?: "any" | "quiet" | "moderate";
  pref_diet?: "any" | "kosher" | "vegetarian" | "vegan";
  shabbat?: "" | "observant" | "traditional" | "not_observant";
  pref_shabbat?: "any" | "observant" | "traditional" | "not_observant";
  chores?: string[];
  budget_min: number;
  budget_max: number;
  preferred_cities: string[];
  earliest_move_in: string | null;
}

/** Mirrors PhotoRoom in lib/types.ts (this file can't use the @/ alias). */
export type PhotoRoom = "living_room" | "bedroom" | "bathroom" | "kitchen" | "balcony" | "exterior" | "other";

export interface SeedListing {
  title: string;
  description: string;
  city: string;
  neighborhood: string;
  address: string;
  rent: number;
  available_from: string;
  lease_term?: LeaseTerm; // for how long (DB default: flexible)
  property_type: PropertyType;
  rooms: number;
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
  photo_labels: PhotoRoom[]; // same order as photo_urls
  is_active: boolean;
}

export interface Seed {
  email: string;
  profile: SeedProfile;
  listing: SeedListing;
}

export const SEED_EMAIL_DOMAIN = "nestup.dev";
export const seedEmail = (n: number) => `seed.user${n}@${SEED_EMAIL_DOMAIN}`;

export const CITIES = [
  "Tel Aviv", "Jerusalem", "Haifa", "Ramat Gan", "Givatayim", "Herzliya",
  "Beer Sheva", "Rishon LeZion", "Petah Tikva", "Netanya", "Rehovot", "Raanana",
] as const;

/** Mirrors CHORES in lib/constants.ts. */
export const CHORES = [
  "Dishes", "Cooking", "Sweeping & vacuuming", "Mopping", "Bathroom cleaning", "Kitchen cleaning",
  "Laundry", "Taking out the trash", "Grocery shopping", "Tidying shared spaces", "Watering plants", "Recycling",
] as const;

export const INTERESTS = [
  "Music", "Concerts", "Cooking", "Baking", "Coffee", "Foodie", "Wine & beer", "Vegan food",
  "Fitness", "Yoga", "Pilates", "Running", "Cycling", "Swimming", "Surfing", "Climbing", "Hiking", "Camping", "Beach",
  "Football", "Basketball", "Tennis", "Dancing", "Meditation",
  "Travel", "Languages", "Volunteering", "Politics", "Startups", "Tech", "Science",
  "Gaming", "Board games", "Chess", "Anime", "Movies & TV", "Podcasts", "Theatre", "Live music", "Nightlife",
  "Reading", "Writing", "Art", "Photography", "Crafts & DIY", "Fashion", "Design", "Plants", "Pets & animals",
] as const;

const photo = (id: string) => `https://images.unsplash.com/photo-${id}?w=1200&q=80`;
const portrait = (id: string) =>
  `https://images.unsplash.com/photo-${id}?w=256&h=256&fit=crop&crop=faces&q=80`;

// ---------------------------------------------------------------------------
// The original twelve — one per city, written by hand.
// ---------------------------------------------------------------------------

type HandcraftedSeed = Omit<Seed, "listing"> & { listing: Omit<SeedListing, "photo_urls" | "photo_labels"> };

const HANDCRAFTED_BASE: HandcraftedSeed[] = [
  {
    email: seedEmail(1),
    profile: {
      full_name: "Noa Peretz", age: 26, occupation: "Product designer",
      bio: "Early riser, plant person, cooks a mean shakshuka.",
      avatar_url: portrait("1494790108377-be9c29b29330"),
      smoker: false, has_pet: false, cleanliness: 4, sleep_schedule: "early", guests_freq: "sometimes",
      interests: ["Cooking", "Yoga", "Art", "Travel", "Reading"],
      ok_with_smoker: false, ok_with_pets: true, budget_min: 0, budget_max: 0,
      preferred_cities: ["Tel Aviv"], earliest_move_in: null,
    },
    listing: {
      title: "Sunlit room in a Florentin loft",
      description: "Bright corner room in a renovated loft above the workshops. We're two easygoing designers; balcony dinners on Fridays, quiet weekday mornings.",
      city: "Tel Aviv", neighborhood: "Florentin", address: "Florentin 12", rent: 5400, available_from: "2026-10-01", lease_term: "year",
      property_type: "apartment", rooms: 3, size_sqm: 78, roommates_count: 2,
      pets_allowed: true, smoking_allowed: false,
      balcony: true, air_conditioning: true, parking: false, elevator: false, furnished: true,
      is_active: true,
    },
  },
  {
    email: seedEmail(2),
    profile: {
      full_name: "Avi Mizrahi", age: 29, occupation: "High-school teacher",
      bio: "Quiet reader, Friday hikes, shuk runs on Thursdays.",
      avatar_url: portrait("1472099645785-5658abf4ff4e"),
      smoker: false, has_pet: false, cleanliness: 3, sleep_schedule: "flexible", guests_freq: "rare",
      interests: ["Reading", "Hiking", "Volunteering", "Music"],
      ok_with_smoker: false, ok_with_pets: true, budget_min: 0, budget_max: 0,
      preferred_cities: ["Jerusalem"], earliest_move_in: null,
    },
    listing: {
      title: "Stone-house room near Machane Yehuda",
      description: "High ceilings and thick Jerusalem stone walls, two minutes from the shuk. Flat of three — calm on weekdays, hosting on Fridays.",
      city: "Jerusalem", neighborhood: "Nachlaot", address: "Agripas 88", rent: 3600, available_from: "2026-09-15", lease_term: "half_year",
      property_type: "apartment", rooms: 4, size_sqm: 95, roommates_count: 3,
      pets_allowed: false, smoking_allowed: false,
      balcony: false, air_conditioning: true, parking: false, elevator: false, furnished: true,
      is_active: true,
    },
  },
  {
    email: seedEmail(3),
    profile: {
      full_name: "Tamar Cohen", age: 27, occupation: "Marine biology MSc",
      bio: "Sea swims before work, vegan kitchen, tidy but not obsessive.",
      avatar_url: portrait("1544005313-94ddf0286df2"),
      smoker: false, has_pet: false, cleanliness: 5, sleep_schedule: "early", guests_freq: "sometimes",
      interests: ["Hiking", "Photography", "Vegan food", "Yoga", "Travel"],
      ok_with_smoker: false, ok_with_pets: false, budget_min: 0, budget_max: 0,
      preferred_cities: ["Haifa"], earliest_move_in: null,
    },
    listing: {
      title: "Bay-view room on the Carmel slope",
      description: "Wake up to the bay from your window. Big shared kitchen, plants everywhere, ten minutes downhill to the beach.",
      city: "Haifa", neighborhood: "Hadar", address: "Masada 21", rent: 2800, available_from: "2026-09-01", lease_term: "flexible",
      property_type: "apartment", rooms: 3.5, size_sqm: 88, roommates_count: 2,
      pets_allowed: false, smoking_allowed: false,
      balcony: true, air_conditioning: false, parking: false, elevator: false, furnished: true,
      is_active: true,
    },
  },
  {
    email: seedEmail(4),
    profile: {
      full_name: "Omer Katz", age: 28, occupation: "Backend engineer",
      bio: "Night owl, board-game host, quiet on weekdays.",
      avatar_url: portrait("1506794778202-cad84cf45f1d"),
      smoker: false, has_pet: true, cleanliness: 3, sleep_schedule: "late", guests_freq: "often",
      interests: ["Gaming", "Board games", "Tech", "Movies & TV"],
      ok_with_smoker: true, ok_with_pets: true, budget_min: 0, budget_max: 0,
      preferred_cities: ["Ramat Gan", "Givatayim"], earliest_move_in: null,
    },
    listing: {
      title: "Quiet room steps from the Bursa",
      description: "Spacious flat with a friendly cat and a serious coffee corner. Looking for someone chill about occasional game nights.",
      city: "Ramat Gan", neighborhood: "Diamond District", address: "Tuval 9", rent: 4200, available_from: "2026-09-15", lease_term: "year",
      property_type: "apartment", rooms: 3, size_sqm: 70, roommates_count: 1,
      pets_allowed: true, smoking_allowed: false,
      balcony: false, air_conditioning: true, parking: true, elevator: true, furnished: false,
      is_active: true,
    },
  },
  {
    email: seedEmail(5),
    profile: {
      full_name: "Shira Levi", age: 30, occupation: "Physiotherapist",
      bio: "Morning runs in the park, early nights, everything in its place.",
      avatar_url: portrait("1534528741775-53994a69daeb"),
      smoker: false, has_pet: true, cleanliness: 5, sleep_schedule: "early", guests_freq: "rare",
      interests: ["Running", "Fitness", "Cooking", "Reading"],
      ok_with_smoker: false, ok_with_pets: true, budget_min: 0, budget_max: 0,
      preferred_cities: ["Givatayim"], earliest_move_in: null,
    },
    listing: {
      title: "Garden room on a leafy Borochov street",
      description: "Ground-floor garden apartment with a real garden — herbs, lemon tree, a hammock. My golden retriever approves of tidy, calm roommates.",
      city: "Givatayim", neighborhood: "Borochov", address: "Borochov 34", rent: 4800, available_from: "2026-10-15", lease_term: "two_years",
      property_type: "garden_apartment", rooms: 3.5, size_sqm: 85, roommates_count: 2,
      pets_allowed: true, smoking_allowed: false,
      balcony: false, air_conditioning: true, parking: false, elevator: false, furnished: true,
      is_active: true,
    },
  },
  {
    email: seedEmail(6),
    profile: {
      full_name: "Daniel Rosen", age: 32, occupation: "Startup founder",
      bio: "Gym at 7, office till late, marina runs on weekends.",
      avatar_url: portrait("1517841905240-472988babdf9"),
      smoker: false, has_pet: false, cleanliness: 4, sleep_schedule: "late", guests_freq: "sometimes",
      interests: ["Tech", "Fitness", "Nightlife", "Travel", "Basketball"],
      ok_with_smoker: false, ok_with_pets: false, budget_min: 0, budget_max: 0,
      preferred_cities: ["Herzliya"], earliest_move_in: null,
    },
    listing: {
      title: "Penthouse room near the marina",
      description: "Top-floor penthouse with a wraparound terrace and sea air. Two of us, both busy professionals — the flat stays quiet and spotless.",
      city: "Herzliya", neighborhood: "Marina", address: "HaShunit 5", rent: 9500, available_from: "2026-11-01", lease_term: "three_months",
      property_type: "penthouse", rooms: 5, size_sqm: 140, roommates_count: 2,
      pets_allowed: false, smoking_allowed: false,
      balcony: true, air_conditioning: true, parking: true, elevator: true, furnished: true,
      is_active: true,
    },
  },
  {
    email: seedEmail(7),
    profile: {
      full_name: "Yuval Baruch", age: 24, occupation: "BGU engineering student",
      bio: "FIFA tournaments, midnight falafel, exams-week silence guaranteed.",
      avatar_url: portrait("1539571696357-5a69c17a67c6"),
      smoker: false, has_pet: false, cleanliness: 2, sleep_schedule: "late", guests_freq: "often",
      interests: ["Gaming", "Football", "Music", "Nightlife"],
      ok_with_smoker: true, ok_with_pets: true, budget_min: 0, budget_max: 0,
      preferred_cities: ["Beer Sheva"], earliest_move_in: null,
    },
    listing: {
      title: "Student room five minutes from BGU",
      description: "Classic student flat in the Old City — big living room, projector wall, cheap rent. Third roommate just graduated.",
      city: "Beer Sheva", neighborhood: "Old City", address: "HaAvot 17", rent: 2900, available_from: "2026-09-01", lease_term: "year",
      property_type: "apartment", rooms: 4, size_sqm: 100, roommates_count: 3,
      pets_allowed: true, smoking_allowed: true,
      balcony: true, air_conditioning: true, parking: false, elevator: false, furnished: true,
      is_active: true,
    },
  },
  {
    email: seedEmail(8),
    profile: {
      full_name: "Lior Adler", age: 27, occupation: "ER nurse",
      bio: "Shift worker — sometimes home by day, always low-drama.",
      avatar_url: portrait("1524504388940-b1c1722653e1"),
      smoker: false, has_pet: false, cleanliness: 4, sleep_schedule: "flexible", guests_freq: "sometimes",
      interests: ["Cooking", "Movies & TV", "Volunteering", "Travel"],
      ok_with_smoker: false, ok_with_pets: true, budget_min: 0, budget_max: 0,
      preferred_cities: ["Rishon LeZion"], earliest_move_in: null,
    },
    listing: {
      title: "Renovated room near the West station",
      description: "Freshly renovated flat, two sane roommates, direct train to Tel Aviv. Kitchen is the heart of the house.",
      city: "Rishon LeZion", neighborhood: "HaRakevet", address: "Sderot Nim 3", rent: 3400, available_from: "2026-10-01", lease_term: "half_year",
      property_type: "apartment", rooms: 4, size_sqm: 105, roommates_count: 2,
      pets_allowed: false, smoking_allowed: false,
      balcony: false, air_conditioning: true, parking: true, elevator: true, furnished: false,
      is_active: true,
    },
  },
  {
    email: seedEmail(9),
    profile: {
      full_name: "Rotem Friedman", age: 29, occupation: "Accountant",
      bio: "Board games on Thursdays, park runs on Saturdays.",
      avatar_url: portrait("1552058544-f2b08422138a"),
      smoker: false, has_pet: false, cleanliness: 4, sleep_schedule: "early", guests_freq: "rare",
      interests: ["Board games", "Reading", "Basketball", "Hiking"],
      ok_with_smoker: false, ok_with_pets: false, budget_min: 0, budget_max: 0,
      preferred_cities: ["Petah Tikva"], earliest_move_in: null,
    },
    listing: {
      title: "Bright duplex room by Em HaMoshavot park",
      description: "Upper floor of a duplex — your room has a slanted ceiling and a park view. Three of us keep it neat and friendly.",
      city: "Petah Tikva", neighborhood: "Em HaMoshavot", address: "HaShoshanim 12", rent: 3200, available_from: "2026-11-15", lease_term: "long_term",
      property_type: "duplex", rooms: 4.5, size_sqm: 120, roommates_count: 3,
      pets_allowed: false, smoking_allowed: false,
      balcony: true, air_conditioning: true, parking: true, elevator: false, furnished: false,
      is_active: true,
    },
  },
  {
    email: seedEmail(10),
    profile: {
      full_name: "Alona Berg", age: 31, occupation: "Freelance translator",
      bio: "Works from cafes, paints on weekends, keeps things serene.",
      avatar_url: portrait("1507003211169-0a1dd7228f2d"),
      smoker: false, has_pet: false, cleanliness: 4, sleep_schedule: "flexible", guests_freq: "rare",
      interests: ["Art", "Photography", "Reading", "Yoga", "Travel"],
      ok_with_smoker: false, ok_with_pets: false, budget_min: 0, budget_max: 0,
      preferred_cities: ["Netanya"], earliest_move_in: null,
    },
    listing: {
      title: "Sea-breeze studio near Ir Yamim",
      description: "Compact, quiet studio with a sliver of sea from the balcony. Fully furnished — bring a suitcase and you're home.",
      city: "Netanya", neighborhood: "Ir Yamim", address: "Bnei Berman 8", rent: 3800, available_from: "2026-09-15", lease_term: "year",
      property_type: "studio", rooms: 1.5, size_sqm: 42, roommates_count: 0,
      pets_allowed: false, smoking_allowed: false,
      balcony: true, air_conditioning: true, parking: false, elevator: true, furnished: true,
      is_active: true,
    },
  },
  {
    email: seedEmail(11),
    profile: {
      full_name: "Michal Stern", age: 28, occupation: "PhD candidate, Weizmann",
      bio: "Lab by day, sourdough by night. Values quiet evenings.",
      avatar_url: portrait("1500648767791-00dcc994a43e"),
      smoker: false, has_pet: false, cleanliness: 5, sleep_schedule: "early", guests_freq: "sometimes",
      interests: ["Reading", "Vegan food", "Hiking", "Volunteering", "Music"],
      ok_with_smoker: false, ok_with_pets: true, budget_min: 0, budget_max: 0,
      preferred_cities: ["Rehovot"], earliest_move_in: null,
    },
    listing: {
      title: "Garden flat room near the Institute",
      description: "Green, quiet garden apartment ten minutes from Weizmann. We cook together most nights; the garden hosts our herb empire.",
      city: "Rehovot", neighborhood: "Weizmann", address: "Herzl 210", rent: 3100, available_from: "2026-10-01", lease_term: "two_months",
      property_type: "garden_apartment", rooms: 4, size_sqm: 110, roommates_count: 2,
      pets_allowed: true, smoking_allowed: false,
      balcony: false, air_conditioning: true, parking: true, elevator: false, furnished: true,
      is_active: true,
    },
  },
  {
    email: seedEmail(12),
    profile: {
      full_name: "Eitan Gold", age: 34, occupation: "Architect",
      bio: "Sketches houses for a living, hosts long Friday lunches.",
      avatar_url: portrait("1438761681033-6461ffad8d80"),
      smoker: false, has_pet: true, cleanliness: 3, sleep_schedule: "flexible", guests_freq: "often",
      interests: ["Art", "Cooking", "Football", "Travel", "Photography"],
      ok_with_smoker: false, ok_with_pets: true, budget_min: 0, budget_max: 0,
      preferred_cities: ["Raanana"], earliest_move_in: null,
    },
    listing: {
      title: "House room with a garden off Ahuza",
      description: "Room in a proper house — garden, grill, a lazy dog named Biscuit. Two of us, both settled professionals who like hosting.",
      city: "Raanana", neighborhood: "Ahuza", address: "Ahuza 156", rent: 5200, available_from: "2026-12-01", lease_term: "flexible",
      property_type: "private_house", rooms: 6, size_sqm: 210, roommates_count: 1,
      pets_allowed: true, smoking_allowed: false,
      balcony: true, air_conditioning: true, parking: true, elevator: false, furnished: false,
      is_active: true,
    },
  },
];

// ---------------------------------------------------------------------------
// Generated owners + rooms. Every Unsplash id below was checked to resolve
// (HTTP 200) when it was added — keep it that way when extending the pools.
// ---------------------------------------------------------------------------

export const GENERATED_COUNT = 80;
const PRNG_SEED = 20260825;

/** Small deterministic PRNG (mulberry32) so the generated seed set is stable. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Room photos sorted by what they actually show — each one checked by eye
 * (2026-08-26), so every seed listing opens with an honest living room,
 * bedroom and bathroom, in that order, the way the Swipe story presents them.
 */
const LIVING_ROOM_PHOTOS = [
  "1502672260266-1c1ef2d93688", "1493809842364-78817add7ffb", "1554995207-c18c203602cb", "1560448204-e02f11c3d0e2",
  "1586023492125-27b2c045efd7", "1493663284031-b7e3aefcae8e", "1484101403633-562f891dc89a", "1598928506311-c55ded91a20c",
  "1501183638710-841dd1904471", "1600607687939-ce8a6c25118c", "1616486338812-3dadae4b4ace", "1536376072261-38c75010e6c9",
  "1513694203232-719a280e022f", "1556228453-efd6c1ff04f6", "1524758631624-e2822e304c36", "1505691938895-1758d7feb511",
  "1567767292278-a4f21aa2d36e", "1600566753086-00f18fb6b3ea", "1600210492486-724fe5c67fb0", "1583847268964-b28dc8f51f92",
  "1615873968403-89e068629265", "1501876725168-00c445821c9e", "1560185009-5bf9f2849488", "1560185127-6ed189bf02f4",
  "1600121848594-d8644e57abab", "1600210491892-03d54c0aaf87", "1616137466211-f939a420be84", "1618221195710-dd6b41faaea6",
  "1631679706909-1844bbd07221", "1585412727339-54e4bae3bbf9", "1615874694520-474822394e73", "1600210492493-0946911123ea",
];
const BEDROOM_PHOTOS = [
  "1512918728675-ed5a9ecdebfd", "1595526114035-0d45ed16cfbf", "1505693416388-ac5ce068fe85", "1540518614846-7eded433c457",
  "1522771739844-6a9f6d5f14af", "1560185893-a55cbc8c57e8", "1616594039964-ae9021a400a0", "1586105251261-72a756497a11",
  "1615874959474-d609969a20ed", "1505693314120-0d443867891c", "1571508601891-ca5e7a713859", "1618773928121-c32242e63f39",
  "1617325247661-675ab4b64ae2", "1616627561839-074385245ff6", "1611892440504-42a792e24d32", "1616486029423-aaa4789e8c9a",
  "1598928636135-d146006ff4be", "1617098474202-0d0d7f60c56b",
];
const BATHROOM_PHOTOS = [
  "1560448075-bb485b067938", "1600566752355-35792bedcfea", "1552321554-5fefe8c9ef14", "1584622650111-993a426fbf0a",
  "1507652313519-d4e9174996dd", "1564540583246-934409427776", "1620626011761-996317b8d101", "1604709177225-055f99402ea3",
  "1595515106969-1ce29566ff1c", "1631889993959-41b4e9c6e3c5", "1609946860441-a51ffcf22208", "1613849925594-415a32298f54",
];
/** Optional fourth photo — kitchens, balconies, facades, dining corners — with its room tag. */
const EXTRA_PHOTOS: { id: string; room: PhotoRoom }[] = [
  { id: "1556912167-f556f1f39fdf", room: "kitchen" }, { id: "1484154218962-a197022b5858", room: "kitchen" },
  { id: "1556911220-bff31c812dba", room: "kitchen" }, { id: "1560440021-33f9b867899d", room: "kitchen" },
  { id: "1600585152220-90363fe7e115", room: "kitchen" }, { id: "1600607686527-6fb886090705", room: "kitchen" },
  { id: "1600585154340-be6161a56a0c", room: "exterior" }, { id: "1512917774080-9991f1c4c750", room: "exterior" },
  { id: "1513584684374-8bab748fbf90", room: "exterior" }, { id: "1571939228382-b2f2b585ce15", room: "exterior" },
  { id: "1580587771525-78b9dba3b914", room: "exterior" }, { id: "1583608205776-bfd35f0d9f83", room: "exterior" },
  { id: "1600047509807-ba8f99d2cdde", room: "exterior" }, { id: "1600566753190-17f0baa2a6c3", room: "exterior" },
  { id: "1600585153490-76fb20a32601", room: "exterior" }, { id: "1613490493576-7fde63acd811", room: "exterior" },
  { id: "1560184897-ae75f418493e", room: "balcony" }, { id: "1600573472550-8090b5e0745e", room: "balcony" },
  { id: "1522708323590-d24dbb6b0267", room: "other" }, { id: "1502672023488-70e25813eb80", room: "other" },
  { id: "1560185007-cde436f6a4d0", room: "other" }, { id: "1617806118233-18e1de247200", room: "other" },
  { id: "1519710164239-da123dc03ef4", room: "other" }, { id: "1560185008-b033106af5c3", room: "other" },
  { id: "1502005229762-cf1b2da7c5d6", room: "other" }, { id: "1600494603989-9650cf6ddd3d", room: "other" },
];

export interface PhotoPools {
  living: readonly string[];
  bedroom: readonly string[];
  bathroom: readonly string[];
  extra: readonly { id: string; room: PhotoRoom }[];
}
const WAVE1_POOLS: PhotoPools = { living: LIVING_ROOM_PHOTOS, bedroom: BEDROOM_PHOTOS, bathroom: BATHROOM_PHOTOS, extra: EXTRA_PHOTOS };

/**
 * The photo story for seed listing number `i`: living room, bedroom, bathroom,
 * and for some a fourth room. Pools have different lengths, so neighbouring
 * listings never share a full set.
 */
export function photoStory(pools: PhotoPools, i: number, withExtra: boolean): { photo_urls: string[]; photo_labels: PhotoRoom[] } {
  const photo_urls = [
    photo(pools.living[i % pools.living.length]),
    photo(pools.bedroom[i % pools.bedroom.length]),
    photo(pools.bathroom[i % pools.bathroom.length]),
  ];
  const photo_labels: PhotoRoom[] = ["living_room", "bedroom", "bathroom"];
  if (withExtra) {
    const extra = pools.extra[i % pools.extra.length];
    photo_urls.push(photo(extra.id));
    photo_labels.push(extra.room);
  }
  return { photo_urls, photo_labels };
}

/** First-wave photo story (the handcrafted twelve and the first 80 generated rooms). */
export function roomPhotos(i: number, withExtra: boolean): { photo_urls: string[]; photo_labels: PhotoRoom[] } {
  return photoStory(WAVE1_POOLS, i, withExtra);
}

const HANDCRAFTED_SHABBAT = ["not_observant", "traditional", "observant", "not_observant", "traditional", "not_observant"] as const;

export const HANDCRAFTED: Seed[] = HANDCRAFTED_BASE.map((s, i) => ({
  ...s,
  profile: {
    ...s.profile,
    shabbat: HANDCRAFTED_SHABBAT[i % HANDCRAFTED_SHABBAT.length],
    pref_shabbat: i % 4 === 2 ? "traditional" : "any",
    // A stable spread of chores per member: every other one, offset by index.
    chores: CHORES.filter((_, k) => (k + i) % 3 !== 0).slice(0, 4 + (i % 3)),
  },
  listing: { ...s.listing, ...roomPhotos(i, i % 3 === 0) },
}));

/** Portraits not already used by the handcrafted twelve. */
const PORTRAITS = [
  "1463453091185-61582044d556", "1488426862026-3ee34a7d66df", "1489424731084-a5d8b219a5bb",
  "1492562080023-ab3db95bfbce", "1499996860823-5214fcc65f8f", "1500048993953-d23a436266cf",
  "1502823403499-6ccfcf4fb453", "1503443207922-dff7d543fd0e", "1508214751196-bcfd4ca60f91",
  "1519085360753-af0119f7cbe7", "1519345182560-3f2917c472ef", "1520813792240-56fc4a3765a7",
  "1521119989659-a83eee488004", "1521572267360-ee0c2909d518", "1526080652727-5b77f74eacd2",
  "1527980965255-d3b416303d12", "1531427186611-ecfd6d936c79", "1541823709867-1b206113eafd",
  "1542909168-82c3e7fdca5c", "1543610892-0b1f7e6d8ac1", "1546961329-78bef0414d7c",
  "1547425260-76bcadfb4f2c", "1548142813-c348350df52b", "1552374196-c4e7ffc6e126",
  "1554151228-14d9def656e4", "1560250097-0b93528c311a", "1562788869-4ed32648eb72",
  "1564564321837-a57b7070ac4f", "1567532939604-b6b5b0db2604", "1573496359142-b8d87734a5a2",
  "1573497019940-1c28c88b4f3e", "1580489944761-15a19d654956", "1580852300654-03c803a14e24",
  "1584999734482-0361aecad844", "1590086782957-93c06ef21604", "1595152772835-219674b2a8a6",
  "1600180758890-6b94519a8ba6", "1601412436009-d964bd02edbc", "1607746882042-944635dfe10e",
  "1618077360395-f3068be8e001", "1618835962148-cf177563c6c0",
  "1544723795-3fb6469f5b39", "1535713875002-d1d0cf377fde", "1529626455594-4ff0802cfb7e",
  "1524250502761-1ac6f2e30d43", "1522556189639-b150ed9c4330", "1531123897727-8f129e1688ce",
  "1517365830460-955ce3ccd263", "1507591064344-4c6ce005b128", "1511367461989-f85a21fda167",
  "1513956589380-bad6acb9b9d4", "1516726817505-f5ed825624d8", "1518020382113-a7e8fc38eac9",
  "1520295187453-cd239786490c", "1521146764736-56c929d59c83", "1525134479668-1bee5c7c6845",
  "1528892952291-009c663ce843", "1532074205216-d0e1f4b87368", "1533227268428-f9ed0900fb3b",
  "1536766820879-059fec98ec0a", "1537511446984-935f663eb1f4", "1542206395-9feb3edaa68d",
  "1545167622-3a6ac756afa4", "1548544149-4835e62ee5b3", "1550525811-e5869dd03032",
  "1554080353-a576cf803bda", "1556157382-97eda2d62296", "1557862921-37829c790f19",
  "1558203728-00f45181dd84", "1559526324-4b87b5e36e44", "1566492031773-4f4e44671857",
  "1568602471122-7832951cc4c5", "1570295999919-56ceb5ecca61", "1574701148212-8518049c7b2c",
  "1580518324671-c2f0833a3af3", "1582750433449-648ed127bb54", "1583195764036-6dc248ac07d9",
  "1586297135537-94bc9ba060aa", "1587397845856-e6cf49176c70", "1589156280159-27698a70f29e",
  "1592334873219-42ca023e48ce", "1594744803329-e58b31de8bf5", "1598550874175-4d0ef436c909",
  "1610088441520-4352457e7095", "1611432579699-484f7990b127", "1614289371518-722f2615943d",
  "1619895862022-09114b41f16f", "1621784563330-caee0b138a00",
];

type City = (typeof CITIES)[number];

/** How many generated rooms per city — weighted toward where seekers look. */
const CITY_PLAN: [City, number][] = [
  ["Tel Aviv", 30], ["Ramat Gan", 8], ["Givatayim", 8], ["Jerusalem", 7], ["Haifa", 6],
  ["Herzliya", 5], ["Raanana", 4], ["Petah Tikva", 3], ["Rishon LeZion", 3],
  ["Netanya", 2], ["Rehovot", 2], ["Beer Sheva", 2],
];

const NEIGHBORHOODS: Record<City, string[]> = {
  "Tel Aviv": ["Florentin", "Neve Tzedek", "Lev HaIr", "Old North", "Kerem HaTeimanim", "Yad Eliyahu", "Ramat Aviv", "Shapira", "Bavli", "Montefiore"],
  Jerusalem: ["Nachlaot", "Rehavia", "Baka", "German Colony", "Katamon", "Musrara", "Kiryat HaYovel"],
  Haifa: ["Hadar", "Carmel Center", "Neve Sha'anan", "Bat Galim", "Ahuza", "Wadi Nisnas"],
  "Ramat Gan": ["Diamond District", "Tel Binyamin", "Marom Naveh", "Shikun Vatikim", "Ramat Chen"],
  Givatayim: ["Borochov", "Givat Rambam", "Sheinkin", "Katzenelson"],
  Herzliya: ["Marina", "Neve Amirim", "Herzliya Pituach", "Nof Yam"],
  "Beer Sheva": ["Old City", "Neve Noy", "Ramot", "Daled"],
  "Rishon LeZion": ["HaRakevet", "Neve Hadarim", "Kiryat Ganim", "Ramat Eliyahu"],
  "Petah Tikva": ["Em HaMoshavot", "Kfar Ganim", "Kiryat Alon", "Ein Ganim"],
  Netanya: ["Ir Yamim", "Kiryat HaSharon", "Ramat Poleg", "City Center"],
  Rehovot: ["Weizmann", "Kiryat Moshe", "Neve Yehuda", "Ushiot"],
  Raanana: ["Ahuza", "Kiryat Ganim", "Lev HaPark", "Neve Zemer"],
};

const STREETS: Record<City, string[]> = {
  "Tel Aviv": ["Rothschild", "Dizengoff", "Allenby", "Ben Yehuda", "Sheinkin", "Levinsky", "Ibn Gabirol", "Bograshov"],
  Jerusalem: ["Jaffa", "Bezalel", "Emek Refaim", "Ussishkin", "Derech Beit Lechem", "HaPalmach"],
  Haifa: ["Herzl", "Hanassi", "Moriah", "Allenby", "Ben Gurion", "Horev"],
  "Ramat Gan": ["Bialik", "Jabotinsky", "Arlozorov", "Krinitzi", "Ben Gurion"],
  Givatayim: ["Katzenelson", "Weizmann", "Sirkin", "Ben Gurion", "HaShalom"],
  Herzliya: ["Sokolov", "Ben Gurion", "HaNasi", "Wingate", "Keren HaYesod"],
  "Beer Sheva": ["Rager", "HaAvot", "Ben Gurion", "Herzl", "Yitzhak Rager"],
  "Rishon LeZion": ["Rothschild", "Herzl", "Jabotinsky", "Sderot Nim", "HaCarmel"],
  "Petah Tikva": ["Hovevei Zion", "Rothschild", "Jabotinsky", "HaShoshanim", "Bar Kochva"],
  Netanya: ["Herzl", "Smilansky", "Dizengoff", "Ben Gurion", "Weizmann"],
  Rehovot: ["Herzl", "Yaakov", "Weizmann", "Pinchas Sapir", "Bilu"],
  Raanana: ["Ahuza", "Weizmann", "HaSharon", "Keren HaYesod", "Eliezer Yaffe"],
};

/** Rent bands in ILS. `skew` > 1 pulls the draw toward the low end. */
const RENT: Record<City, { min: number; max: number; skew: number }> = {
  "Tel Aviv": { min: 2900, max: 6800, skew: 2.4 },
  Jerusalem: { min: 2300, max: 4300, skew: 1.5 },
  Haifa: { min: 1900, max: 3500, skew: 1.3 },
  "Ramat Gan": { min: 2700, max: 5200, skew: 1.8 },
  Givatayim: { min: 2800, max: 5200, skew: 1.8 },
  Herzliya: { min: 3300, max: 7200, skew: 1.6 },
  "Beer Sheva": { min: 1600, max: 2800, skew: 1.2 },
  "Rishon LeZion": { min: 2400, max: 4100, skew: 1.4 },
  "Petah Tikva": { min: 2400, max: 4000, skew: 1.4 },
  Netanya: { min: 2500, max: 4300, skew: 1.4 },
  Rehovot: { min: 2300, max: 3700, skew: 1.3 },
  Raanana: { min: 3000, max: 5600, skew: 1.6 },
};

const FIRST_NAMES = [
  "Maya", "Yael", "Roni", "Dana", "Hila", "Adi", "Lihi", "Gal", "Or", "Inbar", "Shani", "Neta",
  "Efrat", "Liat", "Keren", "Talia", "Amit", "Ella", "Ofir", "Yuli", "Tal", "Sivan", "Hadar",
  "Ayelet", "Noga", "Yonatan", "Itai", "Nadav", "Ido", "Ori", "Guy", "Roee", "Tomer", "Amir",
  "Eyal", "Nir", "Alon", "Ben", "Dor", "Erez", "Matan", "Uri", "Asaf", "Shai", "Yoav", "Elad",
  "Ran", "Idan", "Oren", "Barak", "Gilad", "Ariel", "Dean", "Noam", "Yarden", "Shaked",
  "Eden", "Romi", "Lian", "Nitzan", "Ronen", "Lidor", "Sahar", "Maayan", "Yotam", "Netta",
  "Mika", "Omri", "Adva", "Tzlil", "Yaniv", "Kfir", "Yahav", "Aviv", "Shirel", "Nofar", "Ohad",
  "Hodaya", "Stav", "Almog",
];

const LAST_NAMES = [
  "Cohen", "Levi", "Mizrahi", "Biton", "Dahan", "Avraham", "Malka", "Azulay", "Yosef", "David",
  "Amar", "Ben David", "Chen", "Gabay", "Ohayon", "Shapira", "Weiss", "Hadad", "Golan", "Segal",
  "Bar", "Sharabi", "Nahum", "Elbaz", "Harel", "Lavi", "Mor", "Regev", "Rosenberg", "Zohar",
  "Yaakov", "Ashkenazi", "Sasson", "Kaplan", "Fischer", "Peled", "Doron", "Navon", "Tzur", "Klein",
  "Gross", "Halevi", "Marciano", "Alfasi", "Ziv", "Barkai", "Shalev", "Raz", "Oz", "Geffen",
  "Sela", "Hazan", "Vaknin", "Tamir", "Levin", "Adam", "Mualem", "Ronen", "Paz", "Eshel",
  "Avital", "Nissim", "Ben Ami", "Shamir", "Eliyahu", "Perez", "Turgeman", "Kadosh", "Simhon",
  "Gilboa", "Carmel", "Yehuda", "Salomon", "Herzog", "Livne", "Ofek", "Meir", "Amsalem",
  "Dayan", "Shavit",
];

const OCCUPATIONS = [
  "Frontend developer", "UX researcher", "Data analyst", "Nurse", "Primary-school teacher",
  "Graphic designer", "Law clerk", "Physio student", "Barista and photographer", "Sound engineer",
  "Medical student", "Civil engineer", "Copywriter", "Pastry chef", "QA engineer",
  "Social worker", "Yoga instructor", "Video editor", "Architecture student", "Pharmacist",
  "Product manager", "Personal trainer", "Museum guide", "Dental hygienist", "Tour guide",
  "Master's student, TAU", "Kindergarten teacher", "Electrician", "Interior designer",
  "Journalist", "Occupational therapist", "Game developer", "Chef", "Librarian", "Paramedic",
];

const BIOS = [
  "Coffee first, conversation second. Tidy kitchen, relaxed everything else.",
  "Home most evenings with a book or a series; out most weekends.",
  "Cooks too much and shares it. Quiet mornings are sacred.",
  "Runs before work, hosts a small dinner most Fridays.",
  "Plant parent, podcast listener, always up for a beach walk.",
  "Works long hours, so the flat is calm on weekdays.",
  "Board games, big salads, a very organised fridge.",
  "Music always on, never too loud. Loves a balcony evening.",
  "New to the city and looking for roommates who feel like friends.",
  "Studio-to-gym-to-couch kind of routine. Easy to live with.",
  "Sunday-night cleaner, Friday-morning shuk shopper.",
  "Early to bed, early to swim. Vegetarian kitchen.",
  "Gamer by night, remote worker by day — headphones always on.",
  "Hikes most Saturdays and comes back with too many photos.",
  "Loves hosting but respects a quiet flat. Cat person.",
];

const ROOM_LINES = [
  "The room gets morning light and fits a double bed plus a desk.",
  "Big window, built-in closet, and a door that actually closes.",
  "Corner room with two windows and a small work nook.",
  "Freshly painted room with a new mattress and a wall of shelves.",
  "The room faces the quiet side of the building, away from the street.",
  "A calm, airy room with wooden floors and a ceiling fan.",
  "Room is unfurnished, so bring your own bed and make it yours.",
  "Largest room in the flat, with its own little balcony.",
];

const FLAT_LINES = [
  "The living room is the heart of the place — big sofa, plants, a decent speaker.",
  "Kitchen is fully equipped and we cook together a few nights a week.",
  "Renovated bathroom, fast internet, washing machine in the flat.",
  "Bus and bike lanes at the door; the train is a ten-minute walk.",
  "Shared spaces stay clean because everyone actually does their turn.",
  "Sunny balcony where most of the talking happens.",
  "There's a small yard out back with a table and a grill.",
  "Building has an elevator and a bike room; parking on the street is fine.",
];

const VIBE_LINES = [
  "We're relaxed on weekdays and social on weekends.",
  "Quiet flat — great if you study or work from home.",
  "We host friends now and then but never past midnight.",
  "Looking for someone tidy, easygoing, and up for the occasional dinner.",
  "No drama, clear chores rota, respectful of each other's space.",
  "Happy to share meals, happy to leave each other alone.",
  "We like a clean kitchen and a full fridge.",
  "Friendly flat that still respects a closed door.",
];

const STUDIO_LINES = [
  "Self-contained studio with a kitchenette and a proper shower.",
  "Compact but bright, with a fold-away table and lots of storage.",
  "Quiet building, fast internet, bus stop across the road.",
  "Comes furnished — bed, desk, wardrobe, and a small fridge.",
  "Balcony fits two chairs and a plant.",
];

const TITLES: Record<PropertyType, string[]> = {
  apartment: [
    "Bright room in {n}", "Quiet corner room in {n}", "Sunny room with a view in {n}",
    "Renovated room off the main street, {n}", "Big room in a calm {n} flat",
    "Cozy room in a leafy {n} building", "Room with a window seat in {n}",
    "Airy room near the park, {n}", "Warm room in a friendly {n} share",
    "Balcony room in {n}", "Light-filled room in {n}",
  ],
  garden_apartment: ["Garden room in {n}", "Ground-floor room with a yard, {n}", "Green garden flat room in {n}"],
  penthouse: ["Penthouse room with a terrace, {n}", "Top-floor room with rooftop access, {n}"],
  studio: ["Compact studio in {n}", "Furnished studio near the center, {n}", "Light-filled studio in {n}"],
  duplex: ["Upper-floor duplex room in {n}", "Duplex room with a loft, {n}"],
  private_house: ["Room in a house with a garden, {n}", "House share with a big kitchen, {n}"],
};

/** Popular interests are drawn more often so most owners overlap with a seeker. */
const INTEREST_WEIGHTS: Record<(typeof INTERESTS)[number], number> = {
  Music: 9, Cooking: 9, Travel: 6, "Movies & TV": 6, Coffee: 5, Tech: 5, Photography: 5, Fitness: 4, Beach: 4,
  Foodie: 3, Hiking: 3, Reading: 3, Basketball: 3, Podcasts: 3, "Live music": 3, Baking: 2, Running: 2, Yoga: 2,
  Concerts: 2, Gaming: 2, Art: 2, Football: 2, "Board games": 2, Nightlife: 2, Cycling: 2, Swimming: 2, Dancing: 2,
  Plants: 2, "Pets & animals": 2, Startups: 2, Design: 2, "Wine & beer": 2, Camping: 1, Surfing: 1, Climbing: 1,
  Pilates: 1, Tennis: 1, Meditation: 1, Languages: 1, Politics: 1, Science: 1, Chess: 1, Anime: 1, Theatre: 1,
  Writing: 1, "Crafts & DIY": 1, Fashion: 1, "Vegan food": 1, Volunteering: 1,
};

const MOVE_IN_DATES = [
  "2026-09-01", "2026-09-01", "2026-09-15", "2026-09-15", "2026-10-01", "2026-10-01", "2026-10-01",
  "2026-10-15", "2026-11-01", "2026-11-01", "2026-11-15", "2026-12-01", "2027-01-01",
];

/** One generation run: which PRNG seed, cities, portraits and photo pools it draws from. */
export interface Wave {
  prngSeed: number;
  cityPlan: readonly (readonly [string, number])[];
  /** `seed.user<N>` of the first generated owner in this wave. */
  firstUser: number;
  portraits: readonly string[];
  photos: (i: number, withExtra: boolean) => { photo_urls: string[]; photo_labels: PhotoRoom[] };
  /** Full names already taken by earlier waves — never reused. */
  takenNames?: readonly string[];
  /**
   * Reuse portraits once the pool runs out, instead of leaving the rest of the
   * wave faceless. Off for waves 1 and 2, whose output is pinned by a
   * fingerprint test.
   */
  cyclePortraits?: boolean;
}

export const WAVE1: Wave = {
  prngSeed: PRNG_SEED,
  cityPlan: CITY_PLAN,
  firstUser: HANDCRAFTED_BASE.length + 1,
  portraits: PORTRAITS,
  photos: (i, withExtra) => roomPhotos(HANDCRAFTED_BASE.length + i, withExtra),
};

export function generateSeeds(count = GENERATED_COUNT, wave: Wave = WAVE1): Seed[] {
  const rand = mulberry32(wave.prngSeed);
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
  const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
  const chance = (p: number) => rand() < p;
  const shuffle = <T,>(arr: readonly T[]): T[] => {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  const weightedInterests = (n: number): string[] => {
    const pool = INTERESTS.flatMap((i) => Array<string>(INTEREST_WEIGHTS[i]).fill(i));
    const chosen = new Set<string>();
    while (chosen.size < n) chosen.add(pick(pool));
    return [...chosen];
  };

  const cities = shuffle(wave.cityPlan.flatMap(([city, n]) => Array<string>(n).fill(city))).slice(0, count);
  const firsts = shuffle(FIRST_NAMES);
  const lasts = shuffle(LAST_NAMES);
  const portraits = shuffle(wave.portraits);
  const taken = new Set(wave.takenNames ?? []);

  const seeds: Seed[] = [];
  for (let i = 0; i < count; i++) {
    const city = cities[i];
    // Waves 1 and 2 cover twelve cities with hand-written quarters, streets and
    // rent bands. The third wave reaches every other city in the country, where
    // inventing a quarter name would be a lie — so the neighbourhood is left
    // empty (titles fall back to the city) and the street comes from names that
    // genuinely recur in nearly every Israeli town.
    const neighborhood = pick(NEIGHBORHOODS[city as City] ?? [""]);
    const property_type: PropertyType = (() => {
      const r = rand();
      if (r < 0.6) return "apartment";
      if (r < 0.72) return "garden_apartment";
      if (r < 0.82) return "studio";
      if (r < 0.9) return "duplex";
      if (r < 0.95) return "penthouse";
      return "private_house";
    })();
    const studio = property_type === "studio";
    const house = property_type === "private_house" || property_type === "duplex";
    const rooms = studio ? pick([1, 1.5, 2]) : house ? pick([4, 4.5, 5, 5.5, 6]) : pick([2.5, 3, 3, 3.5, 4, 4.5]);
    const roommates_count = studio ? 0 : Math.min(Math.max(1, Math.round(rooms) - int(1, 2)), 4);
    const band = RENT[city as City] ?? wave3Rent(city);
    const rent = Math.round((band.min + Math.pow(rand(), band.skew) * (band.max - band.min)) / 50) * 50;

    // 3–4 photos each: living room, bedroom, bathroom, sometimes one more room.
    const { photo_urls, photo_labels } = wave.photos(i, chance(0.35));

    const smoker = chance(0.12);
    const has_pet = chance(0.25);
    const description = studio
      ? shuffle(STUDIO_LINES).slice(0, 3).join(" ")
      : [pick(ROOM_LINES), pick(FLAT_LINES), pick(VIBE_LINES)].join(" ");

    // A name is never reused across waves: slide along the surnames until the pair is free.
    let full_name = `${firsts[i % firsts.length]} ${lasts[i % lasts.length]}`;
    for (let k = 1; taken.has(full_name); k++) full_name = `${firsts[i % firsts.length]} ${lasts[(i + k) % lasts.length]}`;
    taken.add(full_name);

    const n = wave.firstUser + i;
    seeds.push({
      email: seedEmail(n),
      profile: {
        full_name,
        age: int(22, 38),
        occupation: pick(OCCUPATIONS),
        bio: pick(BIOS),
        // Not everyone uploads a photo — the last few fall back to the outline avatar.
        avatar_url: wave.cyclePortraits
          ? portrait(portraits[i % portraits.length])
          : i < portraits.length
            ? portrait(portraits[i])
            : null,
        smoker,
        has_pet,
        noise_level: pick(["quiet", "moderate", "moderate", "lively"] as const),
        diet: chance(0.3) ? pick(["kosher", "kosher", "vegetarian", "vegan", "gluten_free"] as const) : "none",
        pref_cleanliness: chance(0.4) ? int(2, 4) : 1,
        pref_sleep: chance(0.2) ? pick(["early", "late"] as const) : "any",
        pref_guests: chance(0.3) ? pick(["rare", "sometimes"] as const) : "any",
        pref_noise: chance(0.35) ? pick(["quiet", "moderate"] as const) : "any",
        pref_diet: chance(0.15) ? pick(["kosher", "vegetarian"] as const) : "any",
        shabbat: pick(["not_observant", "not_observant", "traditional", "traditional", "observant", ""] as const),
        pref_shabbat: chance(0.2) ? pick(["traditional", "observant", "not_observant"] as const) : "any",
        chores: shuffle(CHORES).slice(0, int(3, 6)),
        cleanliness: int(2, 5),
        sleep_schedule: pick(["early", "late", "flexible", "flexible"] as const),
        guests_freq: pick(["rare", "sometimes", "sometimes", "often"] as const),
        interests: weightedInterests(int(4, 7)),
        ok_with_smoker: smoker || chance(0.35),
        ok_with_pets: has_pet || chance(0.6),
        budget_min: 0,
        budget_max: 0,
        preferred_cities: [city],
        earliest_move_in: null,
      },
      listing: {
        title: pick(TITLES[property_type]).replace("{n}", neighborhood || city),
        description,
        city,
        neighborhood,
        address: `${pick(STREETS[city as City] ?? COMMON_STREETS)} ${int(2, 140)}`,
        rent,
        available_from: pick(MOVE_IN_DATES),
        lease_term: pick(["year", "year", "year", "half_year", "half_year", "flexible", "flexible", "two_years", "three_months", "long_term"] as const),
        property_type,
        rooms,
        size_sqm: studio ? int(28, 45) : Math.round(rooms * int(22, 30)),
        roommates_count,
        pets_allowed: has_pet || chance(0.45),
        smoking_allowed: smoker || chance(0.1),
        balcony: chance(0.55),
        air_conditioning: chance(0.85),
        parking: chance(0.3),
        elevator: chance(0.45),
        furnished: studio || chance(0.55),
        is_active: true,
        photo_urls,
        photo_labels,
      },
    });
  }
  return seeds;
}

// ---------------------------------------------------------------------------
// Second wave (2026-08-26): 62 more owners so every city offers a real choice
// of rooms, not just Tel Aviv. Appended after the original 92 (seed.user93…)
// with its own PRNG seed, portraits and photo pools, so re-running the seed
// leaves the first wave byte-identical (the unit test pins its fingerprint).
// ---------------------------------------------------------------------------

export const WAVE2_COUNT = 62;

/** Where the second wave goes — the smaller cities get the most. */
const WAVE2_CITY_PLAN: [City, number][] = [
  ["Tel Aviv", 4], ["Jerusalem", 6], ["Haifa", 6], ["Ramat Gan", 3], ["Givatayim", 3], ["Herzliya", 5],
  ["Raanana", 5], ["Petah Tikva", 6], ["Rishon LeZion", 6], ["Netanya", 6], ["Rehovot", 6], ["Beer Sheva", 6],
];

/**
 * Wave-2 room photos, sorted by what they actually show — every id below was
 * looked at (2026-08-26) before it went into its pool, so a living-room slot
 * only ever shows a living room, a bedroom slot a bedroom, and so on.
 */
const WAVE2_LIVING_ROOM_PHOTOS = [
  "1613575831056-0acd5da8f085", "1629042306558-7d1e15cc02fa", "1654506012740-09321c969dc2", "1663756915304-40b7eda63e41",
  "1665249934445-1de680641f50", "1666532937489-331f2f8f4668", "1713832139677-a03a41b602e3", "1713832139688-79676097edde",
  "1738168246881-40f35f8aba0a", "1605774337664-7a846e9cdf17", "1564078516393-cf04bd966897", "1641232458416-feace752b346",
  "1631510390389-c1e4fb20ff31", "1610123172763-1f587473048f", "1615529182904-14819c35db37", "1649511134921-67afc567280c",
  "1632829882891-5047ccc421bc", "1560185007-5f0bb1866cab", "1560185127-bc36ce01f6e5", "1560185008-186576e0f1e2",
  "1560448205-97abe7378152", "1667959284037-97d4e06508d0", "1745429523617-0d837856ca35", "1616047006789-b7af5afb8c20",
  "1664711942326-2c3351e215e6", "1633505899118-4ca6bd143043", "1724582586529-62622e50c0b3", "1628744876497-eb30460be9f6",
  "1705321963943-de94bb3f0dd3", "1729086046027-09979ade13fd", "1723748972084-4124765e0a55", "1747336754870-ca7b10cc75f5",
  "1541085929911-dea736e9287b", "1614628079765-6c164f4bd970", "1610307540583-7472788642d6", "1615800002234-05c4d488696c",
];
const WAVE2_BEDROOM_PHOTOS = [
  "1566665797739-1674de7a421a", "1531835551805-16d864c8d311", "1618221118493-9cfa1a1c00da", "1562438668-bcf0ca6578f0",
  "1617098900591-3f90928e8c54", "1619810230359-b2c2f61c49cd", "1765464184843-105e144bd54b", "1744974256549-8ece7cdb5dd2",
  "1781249144235-7dff19f6e7db", "1734599505058-6653a0d8d3ff", "1734599511415-cb4a52aea2fe", "1780884864627-3e1664eb8feb",
  "1781249144129-4ba0869707f5", "1781249144056-ec397e444dfa", "1552558636-f6a8f071c2b3", "1699942681763-d1da9f692489",
  "1757344454333-cc666252e596", "1718717722247-26f4c6c09192", "1765862835193-3c37388a409e", "1610307522657-8c0304960189",
  "1760072513376-67a46aab0fd1", "1775241186452-c3d99b09f223", "1765862835260-47843a7bba45", "1765279333918-949ddcb655ba",
  "1630699293259-0b6c08606c62", "1630699375019-c334927264df", "1652882860938-f90aa298e644", "1612320582827-a95ab2596dbc",
  "1612320743558-020669ff20e8", "1649068559107-e5d936141e44", "1702014861736-d62834317c5e", "1771287491132-4954b32210d6",
  "1662454419716-c4c504728811",
];
const WAVE2_BATHROOM_PHOTOS = [
  "1695002817411-203c7f19dfa3", "1661107259637-4e1c55462428", "1629079447777-1e605162dc8d", "1576698483491-8c43f0862543",
  "1587527901949-ab0341697c1e", "1643949719317-4342d8d4031e", "1733426107854-ee00a25d72a7", "1603825491103-bd638b1873b0",
  "1521783593447-5702b9bfd267", "1650894622076-e09ab837c502", "1616537937163-387d3f079de8", "1642755622932-d1e0cb783dc5",
  "1643949700215-e61cdca053f7", "1742134131017-44d377a611b1", "1644421439741-712c7fde7e95", "1586798271654-0471bb1b0517",
  "1630699376443-a79cea41ed80", "1584069793933-57852d7060ea", "1560185127-bdf08e449371", "1618236444666-105ec54b5b69",
  "1737233523182-99e287258d58", "1646592472335-fa6be8e9bc7c", "1643949700830-2420cd030678", "1737233536991-8ee3f92b7781",
  "1566446896748-6075a87760c1", "1696987007764-7f8b85dd3033", "1631048499052-e6d9f305d2c0", "1644916930530-0e4e5afdd20d",
];
/** Optional fourth photo for wave 2 — kitchens, balconies and building fronts. */
const WAVE2_EXTRA_PHOTOS: { id: string; room: PhotoRoom }[] = [
  { id: "1600489000022-c2086d79f9d4", room: "kitchen" }, { id: "1617228069096-4638a7ffc906", room: "kitchen" },
  { id: "1565538810643-b5bdb714032a", room: "kitchen" }, { id: "1628797285815-453c1d0d21e3", room: "kitchen" },
  { id: "1588854337221-4cf9fa96059c", room: "kitchen" }, { id: "1588854337236-6889d631faa8", room: "kitchen" },
  { id: "1632583824020-937ae9564495", room: "kitchen" }, { id: "1600684388091-627109f3cd60", room: "kitchen" },
  { id: "1622372738946-62e02505feb3", room: "kitchen" }, { id: "1556910096-6f5e72db6803", room: "kitchen" },
  { id: "1556912173-46c336c7fd55", room: "kitchen" }, { id: "1610527003928-47afd5f470c6", room: "kitchen" },
  { id: "1629042306650-62a83c847b15", room: "kitchen" }, { id: "1630699144641-72fa7a6b8aa1", room: "kitchen" },
  { id: "1630699293784-9f977570255a", room: "kitchen" }, { id: "1630699294157-554177f5b940", room: "kitchen" },
  { id: "1630699294512-64ecddd912c5", room: "kitchen" }, { id: "1630699294544-d3fb634e2de4", room: "kitchen" },
  { id: "1630699376167-3870469e7598", room: "kitchen" }, { id: "1630699376331-7d70d7a3e417", room: "kitchen" },
  { id: "1560448075-cbc16bb4af8e", room: "kitchen" },
  { id: "1524549207884-e7d1130ae2f3", room: "balcony" }, { id: "1600776216872-b39b2a3dd995", room: "balcony" },
  { id: "1630699376682-84df40131d22", room: "balcony" }, { id: "1693585576674-2e1b7166f583", room: "balcony" },
  { id: "1630703103579-bde27ee45e49", room: "balcony" }, { id: "1616593969747-4797dc75033e", room: "balcony" },
  { id: "1560448205-d82bf18b9bcf", room: "balcony" }, { id: "1619082791183-1888233d6569", room: "balcony" },
  { id: "1486484290742-0ce4eb743a34", room: "balcony" }, { id: "1621045081424-97aa08903f76", room: "balcony" },
  { id: "1564829439675-0eec72f0b695", room: "balcony" }, { id: "1591944438730-23dbc9076a9a", room: "balcony" },
  { id: "1613013441633-785518cf90b3", room: "balcony" }, { id: "1597663459867-9903bf92dcfd", room: "balcony" },
  { id: "1537289865689-48454e64980b", room: "balcony" }, { id: "1667992403195-d2241a40ca2d", room: "balcony" },
  { id: "1613685302957-3a6fc45346ef", room: "balcony" },
  { id: "1515263487990-61b07816b324", room: "exterior" }, { id: "1479839672679-a46483c0e7c8", room: "exterior" },
  { id: "1612637968894-660373e23b03", room: "exterior" }, { id: "1545324418-cc1a3fa10c00", room: "exterior" },
  { id: "1624204386084-dd8c05e32226", room: "exterior" }, { id: "1580216643062-cf460548a66a", room: "exterior" },
  { id: "1580041065738-e72023775cdc", room: "exterior" }, { id: "1460317442991-0ec209397118", room: "exterior" },
  { id: "1619542402915-dcaf30e4e2a1", room: "exterior" }, { id: "1551361415-69c87624334f", room: "exterior" },
  { id: "1595330449916-e7c3e1962bd3", room: "exterior" }, { id: "1521831305363-c69576d4072f", room: "exterior" },
  { id: "1550945888-ce50c03c8aeb", room: "exterior" }, { id: "1550297672-bf5fcd844283", room: "exterior" },
  { id: "1621873979079-2d0467290c69", room: "exterior" }, { id: "1721623905125-af5f7b7fb18b", room: "exterior" },
  { id: "1707919106870-9f8787092297", room: "exterior" }, { id: "1648104265219-e72852f67726", room: "exterior" },
  { id: "1644489263565-dab79ae4fe5c", room: "exterior" }, { id: "1644489263923-e60425f6531d", room: "exterior" },
  { id: "1644489263559-70d7e3be2936", room: "exterior" },
];
const WAVE2_POOLS: PhotoPools = {
  living: WAVE2_LIVING_ROOM_PHOTOS, bedroom: WAVE2_BEDROOM_PHOTOS, bathroom: WAVE2_BATHROOM_PHOTOS, extra: WAVE2_EXTRA_PHOTOS,
};
/** Portraits for wave 2 — none shared with the first wave. */
const WAVE2_PORTRAITS = [
  "1614204424926-196a80bf0be8", "1570158268183-d296b2892211", "1581403341630-a6e0b9d2d257",
  "1531746020798-e6953c6e8e04", "1506863530036-1efeddceb993", "1629425733761-caae3b5f2e50",
  "1573496358961-3c82861ab8f4", "1543949806-2c9935e6aa78", "1699899657680-421c2c2d5064",
  "1540569014015-19a7be504e3a", "1705645930353-0e335311ef20", "1535295972055-1c762f4483e5",
  "1548382131-e0ebb1f0cdea", "1617812191081-2a24e3f30e45", "1542596594-649edbc13630",
  "1611695434369-a8f5d76ceb7b", "1484863137850-59afcfe05386", "1506277886164-e25aa3f4ef7f",
  "1544507888-56d73eb6046e", "1599566219227-2efe0c9b7f5f", "1611695434398-4f4b330623e6",
  "1593757107729-eae8bcc74f8e", "1614321375197-c5083895b054", "1604494747044-2e080876c5f1",
  "1647593782884-1a6779139eb5", "1681097561932-36d0df02b379", "1695737679868-de7eb09df3d0",
  "1584984647264-7e6f4e6d6b91", "1540222797359-e9b786124d4b", "1600603406200-5b2a104684ac",
  "1632765854612-9b02b6ec2b15", "1526510747491-58f928ec870f", "1553514029-1318c9127859",
  "1609505848912-b7c3b8b4beda", "1557053910-d9eadeed1c58", "1600486913747-55e5470d6f40",
  "1590086782792-42dd2350140d", "1557296387-5358ad7997bb", "1590702841774-45166f031529",
  "1560787313-5dff3307e257", "1593529467220-9d721ceb9a78", "1548142542-c53707f8b05b",
  "1662850886700-4ec19bd30d11", "1554727242-741c14fa561c", "1612994451093-c6791c8989cd",
  "1598625873873-52f9aefd7d9d", "1508002366005-75a695ee2d17", "1690444963408-9573a17a8058",
  "1614436201459-156d322d38c6", "1725866546799-4cc16f6cba23", "1633367583895-08545d733dfe",
  "1614023342667-6f060e9d1e04", "1659714962352-434900f95a91", "1625241152315-4a698f74ceb7",
  "1613419441661-6a5af1751d30", "1629185752040-57f6fa9b4f53", "1656338997878-279d71d48f6e",
  "1562124638-724e13052daf", "1618355776464-8666794d2520", "1529068755536-a5ade0dcb4e8",
  "1522529599102-193c0d76b5b6", "1621274790572-7c32596bc67f", "1568880893176-fb2bdab44e41",
  "1517256673644-36ad11246d21", "1622319107576-cca7c8a906f7", "1619431667975-e93b820cde63",
  "1612115958726-9af4b6bd28d1", "1692048098453-109979b87e10", "1654027879796-b9dee8caabb6",
  "1581841064838-a470c740e8ee", "1517462964-21fdcec3f25b", "1519744434498-a0de604df9db",
  "1611178204388-1deef70ec66a", "1667053508464-eb11b394df83", "1493136289900-28660d718589",
  "1740102075520-fe22a53035cf", "1738511980236-c670a95a3970", "1654110455429-cf322b40a906",
  "1603415526960-f7e0328c63b1", "1695927621677-ec96e048dce2",
];

export const WAVE2: Wave = {
  prngSeed: 20260826,
  cityPlan: WAVE2_CITY_PLAN,
  firstUser: HANDCRAFTED_BASE.length + GENERATED_COUNT + 1,
  portraits: WAVE2_PORTRAITS,
  photos: (i, withExtra) => photoStory(WAVE2_POOLS, i, withExtra),
};


// ---------------------------------------------------------------------------
// Third wave (2026-08-27): three rooms in every remaining city, so the map has
// something to show outside the twelve launch cities and a seeker who picks
// Abu Ghosh, Ashdod or Eilat isn't met with an empty deck. Appended after the
// first 154 (seed.user155…), with its own PRNG seed; waves 1 and 2 are
// untouched, and the fingerprint test still pins the original 92.
//
// These cities have no hand-written quarters, streets or rent bands — there
// are 112 of them — so the wave leans on three general rules instead:
//   · no neighbourhood at all (a made-up quarter name would be a lie)
//   · street names that genuinely recur in nearly every Israeli town
//   · a rent band from distance to the Gush Dan, with a list of exceptions
//     where that rule is plainly wrong
// Photos and portraits are the second wave's pools, already checked by eye on
// 2026-08-26; they repeat across the wave, which nobody sees at three rooms
// per city and which beats putting unlooked-at images into the app.
// ---------------------------------------------------------------------------

/** Street names found in town after town, so no city gets an invented address. */
const COMMON_STREETS = [
  "Herzl", "Ben Gurion", "Jabotinsky", "Weizmann", "Bialik", "Rothschild", "HaAtzmaut",
  "HaNassi", "Sokolov", "Trumpeldor", "Ussishkin", "HaShalom", "Begin", "Eshkol",
  "HaPalmach", "Golani", "HaZayit", "HaTamar", "Yitzhak Rabin", "HaRav Kook",
];

/** Central but not expensive — the distance rule gets these backwards. */
const WAVE3_MODEST = new Set([
  "Bnei Brak", "Elad", "Beitar Illit", "Modi'in Illit", "Lod", "Ramla", "Or Yehuda",
  "Jaljulia", "Kafr Qasim", "Tira", "Tayibe", "Qalansawe", "Baqa al-Gharbiyye",
  "Rahat", "Kiryat Malakhi", "Netivot", "Ofakim", "Sderot", "Dimona", "Yeruham",
  "Beit She'an", "Hatzor HaGlilit", "Migdal HaEmek", "Nof HaGalil", "Shefa-'Amr",
  "Tamra", "Sakhnin", "Umm al-Fahm", "Daliyat al-Karmel", "Isfiya", "Beit Jann",
  "Majdal Shams", "Jisr az-Zarqa", "Kiryat Arba", "Arad", "Mitzpe Ramon", "Acre",
]);

/** Sought-after towns, wherever they sit on the map. */
const WAVE3_PRICEY = new Set([
  "Kfar Shmaryahu", "Savyon", "Ramat HaSharon", "Kokhav Ya'ir", "Kfar Saba",
  "Hod HaSharon", "Even Yehuda", "Tel Mond", "Ramat Yishai", "Zichron Yaakov",
  "Binyamina", "Shoham", "Givat Shmuel", "Ganei Tikva", "Kiryat Ono",
  "Modi'in-Maccabim-Re'ut", "Mazkeret Batya", "Omer", "Lehavim", "Meitar",
  "Kfar Vradim", "Oranit", "Elkana", "Alfei Menashe", "Efrat", "Mevaseret Zion",
  "Giv'at Ada", "Kadima-Zoran", "Kiryat Tivon",
]);

const GUSH_DAN = { lat: 32.0853, lng: 34.7818 };

/** Rent band for a third-wave city: nearer the centre, dearer, with exceptions. */
export function wave3Rent(city: string): { min: number; max: number; skew: number } {
  if (WAVE3_PRICEY.has(city)) return { min: 3100, max: 5400, skew: 1.6 };
  if (WAVE3_MODEST.has(city)) return { min: 1500, max: 2900, skew: 1.2 };
  const centre = CITY_CENTRES[city];
  const km = centre ? distanceM(centre, GUSH_DAN) / 1000 : 60;
  if (km <= 20) return { min: 2800, max: 4900, skew: 1.7 };
  if (km <= 45) return { min: 2300, max: 3900, skew: 1.4 };
  return { min: 1800, max: 3200, skew: 1.3 };
}

/** Rooms seeded per city in the third wave. */
export const WAVE3_PER_CITY = 3;

/** Every city in the picker that the first two waves never reached. */
export const WAVE3_CITIES: string[] = ALL_CITIES.filter(
  (c) => !(CITIES as readonly string[]).includes(c)
);

const WAVE3_CITY_PLAN: (readonly [string, number])[] = WAVE3_CITIES.map(
  (c) => [c, WAVE3_PER_CITY] as const
);

export const WAVE3_COUNT = WAVE3_CITIES.length * WAVE3_PER_CITY;

export const WAVE3: Wave = {
  prngSeed: 20260827,
  cityPlan: WAVE3_CITY_PLAN,
  firstUser: HANDCRAFTED_BASE.length + GENERATED_COUNT + WAVE2_COUNT + 1,
  portraits: WAVE2_PORTRAITS,
  photos: (i, withExtra) => photoStory(WAVE2_POOLS, i, withExtra),
  cyclePortraits: true,
};

const WAVE1_SEEDS = generateSeeds();
const WAVE2_SEEDS = generateSeeds(WAVE2_COUNT, {
  ...WAVE2,
  takenNames: [...HANDCRAFTED, ...WAVE1_SEEDS].map((s) => s.profile.full_name),
});
const WAVE3_SEEDS = generateSeeds(WAVE3_COUNT, {
  ...WAVE3,
  takenNames: [...HANDCRAFTED, ...WAVE1_SEEDS, ...WAVE2_SEEDS].map((s) => s.profile.full_name),
});

export const SEEDS: Seed[] = [...HANDCRAFTED, ...WAVE1_SEEDS, ...WAVE2_SEEDS, ...WAVE3_SEEDS];
