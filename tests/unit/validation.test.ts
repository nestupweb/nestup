import { describe, expect, test } from "vitest";
import { profileSchema } from "@/lib/validation/profile";
import { listingSchema } from "@/lib/validation/listing";
import { messageSchema } from "@/lib/validation/message";
import { listingFiltersSchema } from "@/lib/validation/filters";

const validProfile = {
  full_name: "Dana Levi", age: 26, occupation: "Student", bio: "Hi!",
  smoker: false, has_pet: false, cleanliness: 4,
  sleep_schedule: "early", guests_freq: "sometimes",
  interests: ["Music", "Cooking", "Travel"],
  ok_with_smoker: false, ok_with_pets: true,
  budget_min: 2000, budget_max: 3500,
  preferred_cities: ["Tel Aviv"], earliest_move_in: "2026-10-01",
};

describe("profileSchema", () => {
  test("accepts a valid profile", () => {
    expect(profileSchema.safeParse(validProfile).success).toBe(true);
  });
  test("rejects age under 18", () => {
    expect(profileSchema.safeParse({ ...validProfile, age: 17 }).success).toBe(false);
  });
  test("rejects fewer than 3 interests", () => {
    expect(profileSchema.safeParse({ ...validProfile, interests: ["Music"] }).success).toBe(false);
  });
  test("rejects unknown interest tags", () => {
    expect(profileSchema.safeParse({ ...validProfile, interests: ["Music", "Cooking", "Zzz"] }).success).toBe(false);
  });
  test("rejects budget_max below budget_min", () => {
    expect(profileSchema.safeParse({ ...validProfile, budget_min: 4000, budget_max: 3000 }).success).toBe(false);
  });
  test("rejects duplicate interest tags", () => {
    expect(profileSchema.safeParse({ ...validProfile, interests: ["Music", "Music", "Cooking"] }).success).toBe(false);
  });
  test("rejects a non-existent calendar date", () => {
    expect(profileSchema.safeParse({ ...validProfile, earliest_move_in: "2026-13-45" }).success).toBe(false);
  });
  test("defaults 'for how long' to no preference and keeps a chosen term", () => {
    const blank = profileSchema.safeParse(validProfile);
    expect(blank.success && blank.data.pref_lease_term).toBe("any");
    const picked = profileSchema.safeParse({ ...validProfile, pref_lease_term: "half_year" });
    expect(picked.success && picked.data.pref_lease_term).toBe("half_year");
  });
  test("defaults the mamad to no preference and keeps a chosen one", () => {
    const blank = profileSchema.safeParse(validProfile);
    expect(blank.success && blank.data.pref_safe_room).toBe("any");
    const picked = profileSchema.safeParse({ ...validProfile, pref_safe_room: "building" });
    expect(picked.success && picked.data.pref_safe_room).toBe("building");
    // "none" belongs to a listing, not to what someone is looking for.
    expect(profileSchema.safeParse({ ...validProfile, pref_safe_room: "none" }).success).toBe(false);
  });
  test("amenities default to none, dedupe, and reject anything not a feature", () => {
    const blank = profileSchema.safeParse(validProfile);
    expect(blank.success && blank.data.pref_amenities).toEqual([]);
    const picked = profileSchema.safeParse({ ...validProfile, pref_amenities: ["balcony", "parking", "balcony"] });
    expect(picked.success && picked.data.pref_amenities).toEqual(["balcony", "parking"]);
    // Pets and smoking are house rules asked about in Daily life, not amenities.
    expect(profileSchema.safeParse({ ...validProfile, pref_amenities: ["pets_allowed"] }).success).toBe(false);
  });
  test("rejects an unknown 'for how long' value", () => {
    expect(profileSchema.safeParse({ ...validProfile, pref_lease_term: "forever" }).success).toBe(false);
  });
});

describe("listingSchema", () => {
  const validListing = {
    description: "Great flat", city: "Tel Aviv", neighborhood: "Florentin",
    street: "Florentin", house_number: "12", rent: 2800, available_from: "2026-10-01",
    roommates_count: 2, pets_allowed: true, smoking_allowed: false,
    balcony: true, air_conditioning: true, parking: false, elevator: false, furnished: true,
  };
  test("accepts a valid listing", () => {
    expect(listingSchema.safeParse(validListing).success).toBe(true);
  });
  test("rejects rent of 0", () => {
    expect(listingSchema.safeParse({ ...validListing, rent: 0 }).success).toBe(false);
  });
  test("rejects a city outside the list", () => {
    expect(listingSchema.safeParse({ ...validListing, city: "Paris" }).success).toBe(false);
  });
  test("requires street and house number, area stays optional", () => {
    expect(listingSchema.safeParse({ ...validListing, street: "" }).success).toBe(false);
    expect(listingSchema.safeParse({ ...validListing, house_number: "" }).success).toBe(false);
    expect(listingSchema.safeParse({ ...validListing, neighborhood: "" }).success).toBe(true);
  });
  test("accepts safe room and food restrictions", () => {
    const r = listingSchema.safeParse({ ...validListing, safe_room: "building", food_restrictions: "Kosher only" });
    expect(r.success).toBe(true);
    expect(listingSchema.safeParse({ ...validListing, safe_room: "basement" }).success).toBe(false);
  });
});

describe("messageSchema", () => {
  test("accepts a normal message and trims it", () => {
    const r = messageSchema.safeParse({ content: "  hey there  " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.content).toBe("hey there");
  });
  test("rejects empty and over-long content", () => {
    expect(messageSchema.safeParse({ content: "   " }).success).toBe(false);
    // a photo alone is a valid message; the path must be <conversation>/<uuid>.<ext>
    const img = "11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.jpg";
    expect(messageSchema.safeParse({ content: "", image_path: img }).success).toBe(true);
    expect(messageSchema.safeParse({ content: "", image_path: "../etc/passwd" }).success).toBe(false);
    expect(messageSchema.safeParse({ content: "", image_path: "11111111-1111-4111-8111-111111111111/x.jpg" }).success).toBe(false);
    expect(messageSchema.safeParse({ content: "x".repeat(2001) }).success).toBe(false);
  });

  // The extension allow-list here used to be jpg|png|webp, which refused the
  // message *after* the browser had already uploaded the file — an orphan in
  // the bucket and a "failed to send" bubble for every clip.
  test("takes a video from the video/ folder, in any container", () => {
    const conv = "11111111-1111-4111-8111-111111111111";
    const file = "22222222-2222-4222-8222-222222222222";
    for (const ext of ["mp4", "mov", "webm", "mkv", "3gp", "m4v"]) {
      const r = messageSchema.safeParse({ content: "", image_path: `${conv}/video/${file}.${ext}` });
      expect(r.success, `video/${file}.${ext}`).toBe(true);
    }
    // ...and a photo in a format the canvas could not re-encode, sent as-is.
    for (const ext of ["heic", "gif", "avif"]) {
      expect(messageSchema.safeParse({ content: "", image_path: `${conv}/${file}.${ext}` }).success).toBe(true);
    }
  });

  test("still pins the path to one conversation folder and a uuid name", () => {
    const conv = "11111111-1111-4111-8111-111111111111";
    const file = "22222222-2222-4222-8222-222222222222";
    for (const bad of [
      `${conv}/video/../../etc/passwd`,
      `${conv}/video/${file}.mp4/../../x`,
      `${conv}/audio/${file}.mp3`, // only video/ is a permitted subfolder
      `${conv}/video/video/${file}.mp4`,
      `${conv}/video/notauuid.mp4`,
      `${conv}/${file}.verylongext`,
      `${conv}/${file}`, // no extension at all
      `/${conv}/${file}.jpg`,
    ]) {
      expect(messageSchema.safeParse({ content: "", image_path: bad }).success, bad).toBe(false);
    }
  });
});

describe("listingFiltersSchema", () => {
  test("parses url-style strings and fills defaults", () => {
    const r = listingFiltersSchema.parse({ city: "Haifa", rent_max: "3000", page: "2" });
    expect(r).toMatchObject({ city: "Haifa", rent_max: 3000, page: 2, page_size: 20 });
  });
  test("clamps nonsense to safe defaults", () => {
    const r = listingFiltersSchema.parse({ page: "-5", page_size: "9999", rent_max: "banana" });
    expect(r.page).toBe(1);
    expect(r.page_size).toBe(20);
    expect(r.rent_max).toBeUndefined();
  });
});
