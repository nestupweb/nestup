/**
 * Seeds 12 demo owners + their listings so Browse looks like a real marketplace.
 * Idempotent: a seed user whose email already exists is skipped entirely.
 *
 * Run: npm run seed   (Node >= 22.18 runs the TS directly; --env-file loads .env.local)
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 * Demo accounts sign in with password "Demo1234!".
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — run via `npm run seed` so .env.local is loaded."
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PASSWORD = "Demo1234!";
const photo = (id: string) => `https://images.unsplash.com/photo-${id}?w=1200&q=80`;

const SEEDS = [
  {
    email: "seed.user1@nestup.dev",
    profile: {
      full_name: "Noa Peretz", age: 26, occupation: "Product designer",
      bio: "Early riser, plant person, cooks a mean shakshuka.",
      smoker: false, has_pet: false, cleanliness: 4, sleep_schedule: "early", guests_freq: "sometimes",
      interests: ["Cooking", "Yoga", "Art", "Travel", "Reading"],
      ok_with_smoker: false, ok_with_pets: true, budget_min: 0, budget_max: 0,
      preferred_cities: ["Tel Aviv"], earliest_move_in: null,
    },
    listing: {
      title: "Sunlit room in a Florentin loft",
      description: "Bright corner room in a renovated loft above the workshops. We're two easygoing designers; balcony dinners on Fridays, quiet weekday mornings.",
      city: "Tel Aviv", neighborhood: "Florentin", rent: 5400, available_from: "2026-10-01",
      property_type: "apartment", rooms: 3, size_sqm: 78, roommates_count: 2,
      pets_allowed: true, smoking_allowed: false,
      balcony: true, air_conditioning: true, parking: false, elevator: false, furnished: true,
      photo_urls: [photo("1522708323590-d24dbb6b0267"), photo("1502672260266-1c1ef2d93688"), photo("1556912167-f556f1f39fdf")],
      is_active: true,
    },
  },
  {
    email: "seed.user2@nestup.dev",
    profile: {
      full_name: "Avi Mizrahi", age: 29, occupation: "High-school teacher",
      bio: "Quiet reader, Friday hikes, shuk runs on Thursdays.",
      smoker: false, has_pet: false, cleanliness: 3, sleep_schedule: "flexible", guests_freq: "rare",
      interests: ["Reading", "Hiking", "Volunteering", "Music"],
      ok_with_smoker: false, ok_with_pets: true, budget_min: 0, budget_max: 0,
      preferred_cities: ["Jerusalem"], earliest_move_in: null,
    },
    listing: {
      title: "Stone-house room near Machane Yehuda",
      description: "High ceilings and thick Jerusalem stone walls, two minutes from the shuk. Flat of three — calm on weekdays, hosting on Fridays.",
      city: "Jerusalem", neighborhood: "Nachlaot", rent: 3600, available_from: "2026-09-15",
      property_type: "apartment", rooms: 4, size_sqm: 95, roommates_count: 3,
      pets_allowed: false, smoking_allowed: false,
      balcony: false, air_conditioning: true, parking: false, elevator: false, furnished: true,
      photo_urls: [photo("1493809842364-78817add7ffb"), photo("1554995207-c18c203602cb"), photo("1502672023488-70e25813eb80")],
      is_active: true,
    },
  },
  {
    email: "seed.user3@nestup.dev",
    profile: {
      full_name: "Tamar Cohen", age: 27, occupation: "Marine biology MSc",
      bio: "Sea swims before work, vegan kitchen, tidy but not obsessive.",
      smoker: false, has_pet: false, cleanliness: 5, sleep_schedule: "early", guests_freq: "sometimes",
      interests: ["Hiking", "Photography", "Vegan food", "Yoga", "Travel"],
      ok_with_smoker: false, ok_with_pets: false, budget_min: 0, budget_max: 0,
      preferred_cities: ["Haifa"], earliest_move_in: null,
    },
    listing: {
      title: "Bay-view room on the Carmel slope",
      description: "Wake up to the bay from your window. Big shared kitchen, plants everywhere, ten minutes downhill to the beach.",
      city: "Haifa", neighborhood: "Hadar", rent: 2800, available_from: "2026-09-01",
      property_type: "apartment", rooms: 3.5, size_sqm: 88, roommates_count: 2,
      pets_allowed: false, smoking_allowed: false,
      balcony: true, air_conditioning: false, parking: false, elevator: false, furnished: true,
      photo_urls: [photo("1560448204-e02f11c3d0e2"), photo("1586023492125-27b2c045efd7"), photo("1493663284031-b7e3aefcae8e")],
      is_active: true,
    },
  },
  {
    email: "seed.user4@nestup.dev",
    profile: {
      full_name: "Omer Katz", age: 28, occupation: "Backend engineer",
      bio: "Night owl, board-game host, quiet on weekdays.",
      smoker: false, has_pet: true, cleanliness: 3, sleep_schedule: "late", guests_freq: "often",
      interests: ["Gaming", "Board games", "Tech", "Movies & TV"],
      ok_with_smoker: true, ok_with_pets: true, budget_min: 0, budget_max: 0,
      preferred_cities: ["Ramat Gan", "Givatayim"], earliest_move_in: null,
    },
    listing: {
      title: "Quiet room steps from the Bursa",
      description: "Spacious flat with a friendly cat and a serious coffee corner. Looking for someone chill about occasional game nights.",
      city: "Ramat Gan", neighborhood: "Diamond District", rent: 4200, available_from: "2026-09-15",
      property_type: "apartment", rooms: 3, size_sqm: 70, roommates_count: 1,
      pets_allowed: true, smoking_allowed: false,
      balcony: false, air_conditioning: true, parking: true, elevator: true, furnished: false,
      photo_urls: [photo("1484154218962-a197022b5858"), photo("1512918728675-ed5a9ecdebfd"), photo("1484101403633-562f891dc89a")],
      is_active: true,
    },
  },
  {
    email: "seed.user5@nestup.dev",
    profile: {
      full_name: "Shira Levi", age: 30, occupation: "Physiotherapist",
      bio: "Morning runs in the park, early nights, everything in its place.",
      smoker: false, has_pet: true, cleanliness: 5, sleep_schedule: "early", guests_freq: "rare",
      interests: ["Running", "Fitness", "Cooking", "Reading"],
      ok_with_smoker: false, ok_with_pets: true, budget_min: 0, budget_max: 0,
      preferred_cities: ["Givatayim"], earliest_move_in: null,
    },
    listing: {
      title: "Garden room on a leafy Borochov street",
      description: "Ground-floor garden apartment with a real garden — herbs, lemon tree, a hammock. My golden retriever approves of tidy, calm flatmates.",
      city: "Givatayim", neighborhood: "Borochov", rent: 4800, available_from: "2026-10-15",
      property_type: "garden_apartment", rooms: 3.5, size_sqm: 85, roommates_count: 2,
      pets_allowed: true, smoking_allowed: false,
      balcony: false, air_conditioning: true, parking: false, elevator: false, furnished: true,
      photo_urls: [photo("1598928506311-c55ded91a20c"), photo("1595526114035-0d45ed16cfbf"), photo("1501183638710-841dd1904471")],
      is_active: true,
    },
  },
  {
    email: "seed.user6@nestup.dev",
    profile: {
      full_name: "Daniel Rosen", age: 32, occupation: "Startup founder",
      bio: "Gym at 7, office till late, marina runs on weekends.",
      smoker: false, has_pet: false, cleanliness: 4, sleep_schedule: "late", guests_freq: "sometimes",
      interests: ["Tech", "Fitness", "Nightlife", "Travel", "Basketball"],
      ok_with_smoker: false, ok_with_pets: false, budget_min: 0, budget_max: 0,
      preferred_cities: ["Herzliya"], earliest_move_in: null,
    },
    listing: {
      title: "Penthouse room near the marina",
      description: "Top-floor penthouse with a wraparound terrace and sea air. Two of us, both busy professionals — the flat stays quiet and spotless.",
      city: "Herzliya", neighborhood: "Marina", rent: 9500, available_from: "2026-11-01",
      property_type: "penthouse", rooms: 5, size_sqm: 140, roommates_count: 2,
      pets_allowed: false, smoking_allowed: false,
      balcony: true, air_conditioning: true, parking: true, elevator: true, furnished: true,
      photo_urls: [photo("1600607687939-ce8a6c25118c"), photo("1616486338812-3dadae4b4ace"), photo("1600585154340-be6161a56a0c")],
      is_active: true,
    },
  },
  {
    email: "seed.user7@nestup.dev",
    profile: {
      full_name: "Yuval Baruch", age: 24, occupation: "BGU engineering student",
      bio: "FIFA tournaments, midnight falafel, exams-week silence guaranteed.",
      smoker: false, has_pet: false, cleanliness: 2, sleep_schedule: "late", guests_freq: "often",
      interests: ["Gaming", "Football", "Music", "Nightlife"],
      ok_with_smoker: true, ok_with_pets: true, budget_min: 0, budget_max: 0,
      preferred_cities: ["Beer Sheva"], earliest_move_in: null,
    },
    listing: {
      title: "Student room five minutes from BGU",
      description: "Classic student flat in the Old City — big living room, projector wall, cheap rent. Third roommate just graduated.",
      city: "Beer Sheva", neighborhood: "Old City", rent: 2900, available_from: "2026-09-01",
      property_type: "apartment", rooms: 4, size_sqm: 100, roommates_count: 3,
      pets_allowed: true, smoking_allowed: true,
      balcony: true, air_conditioning: true, parking: false, elevator: false, furnished: true,
      photo_urls: [photo("1536376072261-38c75010e6c9"), photo("1513694203232-719a280e022f"), photo("1556228453-efd6c1ff04f6")],
      is_active: true,
    },
  },
  {
    email: "seed.user8@nestup.dev",
    profile: {
      full_name: "Lior Adler", age: 27, occupation: "ER nurse",
      bio: "Shift worker — sometimes home by day, always low-drama.",
      smoker: false, has_pet: false, cleanliness: 4, sleep_schedule: "flexible", guests_freq: "sometimes",
      interests: ["Cooking", "Movies & TV", "Volunteering", "Travel"],
      ok_with_smoker: false, ok_with_pets: true, budget_min: 0, budget_max: 0,
      preferred_cities: ["Rishon LeZion"], earliest_move_in: null,
    },
    listing: {
      title: "Renovated room near the West station",
      description: "Freshly renovated flat, two sane flatmates, direct train to Tel Aviv. Kitchen is the heart of the house.",
      city: "Rishon LeZion", neighborhood: "HaRakevet", rent: 3400, available_from: "2026-10-01",
      property_type: "apartment", rooms: 4, size_sqm: 105, roommates_count: 2,
      pets_allowed: false, smoking_allowed: false,
      balcony: false, air_conditioning: true, parking: true, elevator: true, furnished: false,
      photo_urls: [photo("1524758631624-e2822e304c36"), photo("1505691938895-1758d7feb511"), photo("1567767292278-a4f21aa2d36e")],
      is_active: true,
    },
  },
  {
    email: "seed.user9@nestup.dev",
    profile: {
      full_name: "Rotem Friedman", age: 29, occupation: "Accountant",
      bio: "Board games on Thursdays, park runs on Saturdays.",
      smoker: false, has_pet: false, cleanliness: 4, sleep_schedule: "early", guests_freq: "rare",
      interests: ["Board games", "Reading", "Basketball", "Hiking"],
      ok_with_smoker: false, ok_with_pets: false, budget_min: 0, budget_max: 0,
      preferred_cities: ["Petah Tikva"], earliest_move_in: null,
    },
    listing: {
      title: "Bright duplex room by Em HaMoshavot park",
      description: "Upper floor of a duplex — your room has a slanted ceiling and a park view. Three of us keep it neat and friendly.",
      city: "Petah Tikva", neighborhood: "Em HaMoshavot", rent: 3200, available_from: "2026-11-15",
      property_type: "duplex", rooms: 4.5, size_sqm: 120, roommates_count: 3,
      pets_allowed: false, smoking_allowed: false,
      balcony: true, air_conditioning: true, parking: true, elevator: false, furnished: false,
      photo_urls: [photo("1600566753086-00f18fb6b3ea"), photo("1600210492486-724fe5c67fb0"), photo("1505693416388-ac5ce068fe85")],
      is_active: true,
    },
  },
  {
    email: "seed.user10@nestup.dev",
    profile: {
      full_name: "Alona Berg", age: 31, occupation: "Freelance translator",
      bio: "Works from cafes, paints on weekends, keeps things serene.",
      smoker: false, has_pet: false, cleanliness: 4, sleep_schedule: "flexible", guests_freq: "rare",
      interests: ["Art", "Photography", "Reading", "Yoga", "Travel"],
      ok_with_smoker: false, ok_with_pets: false, budget_min: 0, budget_max: 0,
      preferred_cities: ["Netanya"], earliest_move_in: null,
    },
    listing: {
      title: "Sea-breeze studio near Ir Yamim",
      description: "Compact, quiet studio with a sliver of sea from the balcony. Fully furnished — bring a suitcase and you're home.",
      city: "Netanya", neighborhood: "Ir Yamim", rent: 3800, available_from: "2026-09-15",
      property_type: "studio", rooms: 1.5, size_sqm: 42, roommates_count: 0,
      pets_allowed: false, smoking_allowed: false,
      balcony: true, air_conditioning: true, parking: false, elevator: true, furnished: true,
      photo_urls: [photo("1540518614846-7eded433c457"), photo("1567016432779-094069958ea5"), photo("1522771739844-6a9f6d5f14af")],
      is_active: true,
    },
  },
  {
    email: "seed.user11@nestup.dev",
    profile: {
      full_name: "Michal Stern", age: 28, occupation: "PhD candidate, Weizmann",
      bio: "Lab by day, sourdough by night. Values quiet evenings.",
      smoker: false, has_pet: false, cleanliness: 5, sleep_schedule: "early", guests_freq: "sometimes",
      interests: ["Reading", "Vegan food", "Hiking", "Volunteering", "Music"],
      ok_with_smoker: false, ok_with_pets: true, budget_min: 0, budget_max: 0,
      preferred_cities: ["Rehovot"], earliest_move_in: null,
    },
    listing: {
      title: "Garden flat room near the Institute",
      description: "Green, quiet garden apartment ten minutes from Weizmann. We cook together most nights; the garden hosts our herb empire.",
      city: "Rehovot", neighborhood: "Weizmann", rent: 3100, available_from: "2026-10-01",
      property_type: "garden_apartment", rooms: 4, size_sqm: 110, roommates_count: 2,
      pets_allowed: true, smoking_allowed: false,
      balcony: false, air_conditioning: true, parking: true, elevator: false, furnished: true,
      photo_urls: [photo("1583847268964-b28dc8f51f92"), photo("1615873968403-89e068629265"), photo("1560185893-a55cbc8c57e8")],
      is_active: true,
    },
  },
  {
    email: "seed.user12@nestup.dev",
    profile: {
      full_name: "Eitan Gold", age: 34, occupation: "Architect",
      bio: "Sketches houses for a living, hosts long Friday lunches.",
      smoker: false, has_pet: true, cleanliness: 3, sleep_schedule: "flexible", guests_freq: "often",
      interests: ["Art", "Cooking", "Football", "Travel", "Photography"],
      ok_with_smoker: false, ok_with_pets: true, budget_min: 0, budget_max: 0,
      preferred_cities: ["Raanana"], earliest_move_in: null,
    },
    listing: {
      title: "House room with a garden off Ahuza",
      description: "Room in a proper house — garden, grill, a lazy dog named Biscuit. Two of us, both settled professionals who like hosting.",
      city: "Raanana", neighborhood: "Ahuza", rent: 5200, available_from: "2026-12-01",
      property_type: "private_house", rooms: 6, size_sqm: 210, roommates_count: 1,
      pets_allowed: true, smoking_allowed: false,
      balcony: true, air_conditioning: true, parking: true, elevator: false, furnished: false,
      photo_urls: [photo("1502005229762-cf1b2da7c5d6"), photo("1616594039964-ae9021a400a0"), photo("1560185007-cde436f6a4d0")],
      is_active: true,
    },
  },
];

async function main() {
  const { data, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listErr) throw listErr;
  const existing = new Set(data.users.map((u) => u.email ?? ""));

  let seeded = 0;
  for (const s of SEEDS) {
    if (existing.has(s.email)) {
      console.log(`- ${s.email} already exists, skipping`);
      continue;
    }
    const { data: created, error } = await admin.auth.admin.createUser({
      email: s.email,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error || !created.user) {
      throw new Error(`createUser(${s.email}): ${error?.message ?? "no user returned"}`);
    }
    const userId = created.user.id;

    const { error: pErr } = await admin.from("profiles").insert({ user_id: userId, ...s.profile });
    if (pErr) throw new Error(`profile(${s.email}): ${pErr.message}`);

    const { error: lErr } = await admin.from("listings").insert({ owner_id: userId, ...s.listing });
    if (lErr) throw new Error(`listing(${s.email}): ${lErr.message}`);

    seeded++;
    console.log(`+ seeded ${s.email} — ${s.listing.title}`);
  }
  console.log(`\nDone: ${seeded} seeded, ${SEEDS.length - seeded} skipped.`);
  console.log(`Demo accounts sign in with password ${PASSWORD}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
