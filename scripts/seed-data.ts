/**
 * Demo data for `scripts/seed.ts`: 12 handcrafted owners plus 80 generated
 * ones, each with a portrait and one active listing. Pure module — no env,
 * no I/O — so `tests/unit/seed-data.test.ts` can check it against the DB
 * constraints. Generation is deterministic (fixed PRNG seed): running the
 * seed twice produces the same people and rooms.
 *
 * Cities and interests are duplicated from `lib/constants.ts` on purpose:
 * this file runs under Node's native TS loader (`npm run seed`), which can't
 * resolve the `@/` alias, and the unit test asserts the two lists agree.
 */

export type SleepSchedule = "early" | "late" | "flexible";
export type GuestsFreq = "rare" | "sometimes" | "often";
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

export const INTERESTS = [
  "Music", "Concerts", "Cooking", "Fitness", "Yoga", "Running", "Hiking",
  "Travel", "Gaming", "Movies & TV", "Reading", "Art", "Photography", "Tech",
  "Football", "Basketball", "Board games", "Nightlife", "Vegan food", "Volunteering",
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
      city: "Tel Aviv", neighborhood: "Florentin", address: "Florentin 12", rent: 5400, available_from: "2026-10-01",
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
      city: "Jerusalem", neighborhood: "Nachlaot", address: "Agripas 88", rent: 3600, available_from: "2026-09-15",
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
      city: "Haifa", neighborhood: "Hadar", address: "Masada 21", rent: 2800, available_from: "2026-09-01",
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
      city: "Ramat Gan", neighborhood: "Diamond District", address: "Tuval 9", rent: 4200, available_from: "2026-09-15",
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
      city: "Givatayim", neighborhood: "Borochov", address: "Borochov 34", rent: 4800, available_from: "2026-10-15",
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
      city: "Herzliya", neighborhood: "Marina", address: "HaShunit 5", rent: 9500, available_from: "2026-11-01",
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
      city: "Beer Sheva", neighborhood: "Old City", address: "HaAvot 17", rent: 2900, available_from: "2026-09-01",
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
      city: "Rishon LeZion", neighborhood: "HaRakevet", address: "Sderot Nim 3", rent: 3400, available_from: "2026-10-01",
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
      city: "Petah Tikva", neighborhood: "Em HaMoshavot", address: "HaShoshanim 12", rent: 3200, available_from: "2026-11-15",
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
      city: "Netanya", neighborhood: "Ir Yamim", address: "Bnei Berman 8", rent: 3800, available_from: "2026-09-15",
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
      city: "Rehovot", neighborhood: "Weizmann", address: "Herzl 210", rent: 3100, available_from: "2026-10-01",
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
      city: "Raanana", neighborhood: "Ahuza", address: "Ahuza 156", rent: 5200, available_from: "2026-12-01",
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

/**
 * The photo story for seed listing number `i`: living room, bedroom, bathroom,
 * and for some a fourth room. Pools have different lengths, so neighbouring
 * listings never share a full set.
 */
export function roomPhotos(i: number, withExtra: boolean): { photo_urls: string[]; photo_labels: PhotoRoom[] } {
  const photo_urls = [
    photo(LIVING_ROOM_PHOTOS[i % LIVING_ROOM_PHOTOS.length]),
    photo(BEDROOM_PHOTOS[i % BEDROOM_PHOTOS.length]),
    photo(BATHROOM_PHOTOS[i % BATHROOM_PHOTOS.length]),
  ];
  const photo_labels: PhotoRoom[] = ["living_room", "bedroom", "bathroom"];
  if (withExtra) {
    const extra = EXTRA_PHOTOS[i % EXTRA_PHOTOS.length];
    photo_urls.push(photo(extra.id));
    photo_labels.push(extra.room);
  }
  return { photo_urls, photo_labels };
}

export const HANDCRAFTED: Seed[] = HANDCRAFTED_BASE.map((s, i) => ({
  ...s,
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
  Music: 9, Cooking: 9, Travel: 6, "Movies & TV": 6, Tech: 5, Photography: 5, Fitness: 4,
  Hiking: 3, Reading: 3, Basketball: 3, Running: 2, Yoga: 2, Concerts: 2, Gaming: 2, Art: 2,
  Football: 2, "Board games": 2, Nightlife: 2, "Vegan food": 1, Volunteering: 1,
};

const MOVE_IN_DATES = [
  "2026-09-01", "2026-09-01", "2026-09-15", "2026-09-15", "2026-10-01", "2026-10-01", "2026-10-01",
  "2026-10-15", "2026-11-01", "2026-11-01", "2026-11-15", "2026-12-01", "2027-01-01",
];

export function generateSeeds(count = GENERATED_COUNT): Seed[] {
  const rand = mulberry32(PRNG_SEED);
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

  const cities = shuffle(CITY_PLAN.flatMap(([city, n]) => Array<City>(n).fill(city))).slice(0, count);
  const firsts = shuffle(FIRST_NAMES);
  const lasts = shuffle(LAST_NAMES);
  const portraits = shuffle(PORTRAITS);

  const seeds: Seed[] = [];
  for (let i = 0; i < count; i++) {
    const city = cities[i];
    const neighborhood = pick(NEIGHBORHOODS[city]);
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
    const band = RENT[city];
    const rent = Math.round((band.min + Math.pow(rand(), band.skew) * (band.max - band.min)) / 50) * 50;

    // 3–4 photos each: living room, bedroom, bathroom, sometimes one more room.
    const { photo_urls, photo_labels } = roomPhotos(HANDCRAFTED_BASE.length + i, chance(0.35));

    const smoker = chance(0.12);
    const has_pet = chance(0.25);
    const description = studio
      ? shuffle(STUDIO_LINES).slice(0, 3).join(" ")
      : [pick(ROOM_LINES), pick(FLAT_LINES), pick(VIBE_LINES)].join(" ");

    const n = 13 + i;
    seeds.push({
      email: seedEmail(n),
      profile: {
        full_name: `${firsts[i % firsts.length]} ${lasts[i % lasts.length]}`,
        age: int(22, 38),
        occupation: pick(OCCUPATIONS),
        bio: pick(BIOS),
        // Not everyone uploads a photo — the last few fall back to the outline avatar.
        avatar_url: i < portraits.length ? portrait(portraits[i]) : null,
        smoker,
        has_pet,
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
        title: pick(TITLES[property_type]).replace("{n}", neighborhood),
        description,
        city,
        neighborhood,
        address: `${pick(STREETS[city])} ${int(2, 140)}`,
        rent,
        available_from: pick(MOVE_IN_DATES),
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

export const SEEDS: Seed[] = [...HANDCRAFTED, ...generateSeeds()];
