/**
 * Seeds demo owners + their listings so Browse and the swipe deck look like a
 * real marketplace: 12 handcrafted + 80 generated (see `seed-data.ts`).
 *
 * Idempotent — safe to re-run:
 *  - a seed user whose email already exists is left alone (its portrait is
 *    backfilled if missing);
 *  - roommates ("Who lives here") are added only to seed rooms that have none.
 *
 * Run: npm run seed   (Node >= 22.18 runs the TS directly; --env-file loads .env.local)
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 * Demo accounts sign in with password "Demo1234!".
 */
import { createClient } from "@supabase/supabase-js";
import { SEEDS, SEED_EMAIL_DOMAIN } from "./seed-data.ts";

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

async function listSeedUsers(): Promise<Map<string, string>> {
  const byEmail = new Map<string, string>();
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const u of data.users) {
      if (u.email?.endsWith(`@${SEED_EMAIL_DOMAIN}`)) byEmail.set(u.email, u.id);
    }
    if (data.users.length < 1000) return byEmail;
  }
}

async function main() {
  const idByEmail = await listSeedUsers();

  let seeded = 0;
  let skipped = 0;
  for (const s of SEEDS) {
    const existingId = idByEmail.get(s.email);
    if (existingId) {
      skipped++;
      // Keep the demo room's photo story in sync with seed-data (living room →
      // bedroom → bathroom, each tagged) — the deck relies on the tags.
      const { error: photoErr } = await admin
        .from("listings")
        .update({ photo_urls: s.listing.photo_urls, photo_labels: s.listing.photo_labels, lease_term: s.listing.lease_term })
        .eq("owner_id", existingId);
      if (photoErr) throw new Error(`photos(${s.email}): ${photoErr.message}`);
      if (s.profile.noise_level || s.profile.chores) {
        // Undefined fields are dropped from the JSON body, so a handcrafted
        // member (Shabbat + chores only) keeps their other Daily life answers.
        const { noise_level, diet, shabbat, chores, pref_cleanliness, pref_sleep, pref_guests, pref_noise, pref_diet, pref_shabbat } = s.profile;
        const { error: dailyErr } = await admin
          .from("profiles")
          .update({ noise_level, diet, shabbat, chores, pref_cleanliness, pref_sleep, pref_guests, pref_noise, pref_diet, pref_shabbat })
          .eq("user_id", existingId);
        if (dailyErr) throw new Error(`daily life(${s.email}): ${dailyErr.message}`);
      }
      if (s.profile.avatar_url) {
        // Older seed runs didn't set portraits; fill in only where still empty.
        await admin
          .from("profiles")
          .update({ avatar_url: s.profile.avatar_url })
          .eq("user_id", existingId)
          .is("avatar_url", null);
      }
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

    idByEmail.set(s.email, userId);
    seeded++;
    console.log(`+ seeded ${s.email} — ${s.listing.title}`);
  }
  console.log(`\nOwners: ${seeded} seeded, ${skipped} already existed.`);

  await addRoommates(idByEmail);
  console.log(`Demo accounts sign in with password ${PASSWORD}`);
}

/**
 * "Who lives here": give every seed room without roommates up to two extra
 * residents drawn from other seed owners in the same city. Rotates through
 * the candidates so the same faces don't appear in every flat.
 */
async function addRoommates(idByEmail: Map<string, string>) {
  const seedIds = [...idByEmail.values()];
  const { data: listingRows, error: lErr } = await admin
    .from("listings")
    .select("id, owner_id, city, roommates_count")
    .in("owner_id", seedIds)
    .eq("is_active", true);
  if (lErr) throw new Error(`listings for roommates: ${lErr.message}`);
  const listings = (listingRows ?? []) as { id: string; owner_id: string; city: string; roommates_count: number }[];

  const { data: residentRows, error: rErr } = await admin
    .from("listing_residents")
    .select("listing_id")
    .in("listing_id", listings.map((l) => l.id));
  if (rErr) throw new Error(`listing_residents: ${rErr.message}`);
  const hasRoommates = new Set((residentRows ?? []).map((r) => r.listing_id as string));

  const ownersByCity = new Map<string, string[]>();
  for (const l of listings) {
    ownersByCity.set(l.city, [...(ownersByCity.get(l.city) ?? []), l.owner_id]);
  }

  const rows: { listing_id: string; resident_id: string }[] = [];
  listings.forEach((l, i) => {
    if (hasRoommates.has(l.id)) return;
    const candidates = (ownersByCity.get(l.city) ?? []).filter((id) => id !== l.owner_id);
    const want = Math.min(l.roommates_count, 2, candidates.length);
    for (let k = 0; k < want; k++) {
      rows.push({ listing_id: l.id, resident_id: candidates[(i + k) % candidates.length] });
    }
  });
  if (rows.length === 0) {
    console.log("Roommates: nothing to add.");
    return;
  }
  const { error } = await admin
    .from("listing_residents")
    .upsert(rows, { onConflict: "listing_id,resident_id", ignoreDuplicates: true });
  if (error) throw new Error(`insert roommates: ${error.message}`);
  console.log(`Roommates: linked ${rows.length} resident(s) across ${new Set(rows.map((r) => r.listing_id)).size} room(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
