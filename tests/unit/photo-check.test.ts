// @vitest-environment node
import { describe, expect, test } from "vitest";
import { auditPhotos, readPhotoVerdict, signPhotoVerdict } from "@/lib/photo-check";

const SECRET = "sk-ant-test-secret";
const A = "https://x.supabase.co/storage/v1/object/public/listing-photos/u1/a.jpg";
const B = "https://x.supabase.co/storage/v1/object/public/listing-photos/u1/b.jpg";

describe("signed photo verdicts", () => {
  test("round-trip, and the token is bound to the URL and the subject", () => {
    const token = signPhotoVerdict(SECRET, A, "bedroom");
    expect(token.startsWith("bedroom.")).toBe(true);
    expect(readPhotoVerdict(SECRET, A, token)).toBe("bedroom");
    expect(readPhotoVerdict(SECRET, B, token)).toBeNull(); // another photo
    expect(readPhotoVerdict("other-secret", A, token)).toBeNull();
  });

  test("a forged or edited token is worthless", () => {
    const token = signPhotoVerdict(SECRET, A, "not_apartment");
    const forged = "living_room." + token.split(".")[1]; // relabel the verdict
    expect(readPhotoVerdict(SECRET, A, forged)).toBeNull();
    expect(readPhotoVerdict(SECRET, A, "living_room.deadbeef")).toBeNull();
    expect(readPhotoVerdict(SECRET, A, "living_room")).toBeNull();
    expect(readPhotoVerdict(SECRET, A, "")).toBeNull();
    expect(readPhotoVerdict(SECRET, A, undefined)).toBeNull();
  });
});

describe("auditPhotos — the publish gate", () => {
  test("accepts photos whose verdict fits the tag", () => {
    expect(
      auditPhotos({
        urls: [A, B],
        labels: ["living_room", "other"],
        tokens: [signPhotoVerdict(SECRET, A, "living_room"), signPhotoVerdict(SECRET, B, "kitchen")],
        trusted: new Map(),
        secret: SECRET,
      })
    ).toBeNull();
  });

  test("rejects a bedroom photo submitted as the living room, naming the photo", () => {
    const bad = auditPhotos({
      urls: [A, B],
      labels: ["living_room", "bedroom"],
      tokens: [signPhotoVerdict(SECRET, A, "living_room"), signPhotoVerdict(SECRET, B, "kitchen")],
      trusted: new Map(),
      secret: SECRET,
    });
    expect(bad?.index).toBe(1);
    expect(bad?.message).toMatch(/looks like a kitchen, not a bedroom/);
  });

  test("rejects an unchecked photo (no token) unless that exact url+tag is already on the listing", () => {
    const unchecked = auditPhotos({ urls: [A], labels: ["bedroom"], tokens: [""], trusted: new Map(), secret: SECRET });
    expect(unchecked?.message).toMatch(/hasn't been checked/);
    const trusted = new Map([[A, "bedroom" as const]]);
    expect(auditPhotos({ urls: [A], labels: ["bedroom"], tokens: [""], trusted, secret: SECRET })).toBeNull();
    // Re-tagging a saved photo needs a fresh verdict.
    expect(auditPhotos({ urls: [A], labels: ["living_room"], tokens: [""], trusted, secret: SECRET })?.index).toBe(0);
  });

  test("a non-apartment verdict can't be published under any tag", () => {
    const token = signPhotoVerdict(SECRET, A, "not_apartment");
    for (const label of ["living_room", "kitchen", "other"] as const) {
      expect(auditPhotos({ urls: [A], labels: [label], tokens: [token], trusted: new Map(), secret: SECRET })?.index).toBe(0);
    }
  });
});
