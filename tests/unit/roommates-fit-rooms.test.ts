/**
 * One room is the living room, the rest are bedrooms — so a home holds at most
 * `rooms - 1` roommates (user rule, 2026-09-01). Half rooms round up, and a
 * studio still holds the one person living in it.
 *
 * The same rule is stated three times and all three have to agree: this helper,
 * the listing schema (which is what the server actually enforces), and the
 * `public.max_roommates` SQL function behind the check constraints in 0043.
 */
import { describe, expect, test } from "vitest";
import { maxRoommates, roommatesOverCapError } from "@/lib/constants";
import { listingSchema } from "@/lib/validation/listing";

describe("maxRoommates", () => {
  test("the user's example: a 5-room flat holds 4", () => {
    expect(maxRoommates(5)).toBe(4);
  });

  test("one room is always the living room", () => {
    expect(maxRoommates(6)).toBe(5);
    expect(maxRoommates(4)).toBe(3);
    expect(maxRoommates(3)).toBe(2);
    expect(maxRoommates(2)).toBe(1);
  });

  test("a half room counts as a bedroom, so the cap rounds up", () => {
    expect(maxRoommates(2.5)).toBe(2);
    expect(maxRoommates(3.5)).toBe(3);
    expect(maxRoommates(4.5)).toBe(4);
    expect(maxRoommates(5.5)).toBe(5);
  });

  test("a studio holds the one person living in it, never zero", () => {
    expect(maxRoommates(1)).toBe(1);
    expect(maxRoommates(1.5)).toBe(1);
  });

  test("junk never widens the cap", () => {
    expect(maxRoommates(Number.NaN)).toBe(1);
    expect(maxRoommates(Number.POSITIVE_INFINITY)).toBe(1);
    expect(maxRoommates(0)).toBe(1);
    expect(maxRoommates(-4)).toBe(1);
  });
});

describe("roommatesOverCapError", () => {
  test("silent while the household fits", () => {
    expect(roommatesOverCapError(4, 5)).toBeNull();
    expect(roommatesOverCapError(3, 3.5)).toBeNull();
    expect(roommatesOverCapError(0, 2)).toBeNull();
  });

  test("names the cap and the reason when it does not", () => {
    expect(roommatesOverCapError(5, 5)).toMatch(/at most 4 roommates/);
    expect(roommatesOverCapError(5, 5)).toMatch(/living room/);
    // Singular where the cap is one.
    expect(roommatesOverCapError(2, 2)).toMatch(/at most 1 roommate —/);
  });
});

describe("the listing form's server-side check", () => {
  const valid = {
    description: "A room", city: "Tel Aviv", neighborhood: "", street: "Allenby", house_number: "5",
    rent: 3000, available_from: "2026-10-01", property_type: "apartment", rooms: 5, size_sqm: null,
    roommates_count: 4, pets_allowed: false, smoking_allowed: false, balcony: false,
    air_conditioning: false, parking: false, elevator: false, furnished: false,
    safe_room: "none", wanted_gender: "", food_restrictions: "",
  };

  test("5 rooms accepts 4 roommates and rejects 5", () => {
    expect(listingSchema.safeParse(valid).success).toBe(true);
    const tooMany = listingSchema.safeParse({ ...valid, roommates_count: 5 });
    expect(tooMany.success).toBe(false);
  });

  test("the refusal is reported against Current roommates, with the rule in it", () => {
    const r = listingSchema.safeParse({ ...valid, rooms: 3, roommates_count: 4 });
    expect(r.success).toBe(false);
    const issue = r.success ? null : r.error.issues.find((i) => i.path[0] === "roommates_count");
    expect(issue?.message).toMatch(/at most 2 roommates/);
  });

  test("shrinking the home is what breaks it — the same household is fine in a bigger one", () => {
    expect(listingSchema.safeParse({ ...valid, rooms: 4.5, roommates_count: 4 }).success).toBe(true);
    expect(listingSchema.safeParse({ ...valid, rooms: 3.5, roommates_count: 4 }).success).toBe(false);
  });
});
