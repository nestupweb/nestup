import { describe, expect, test } from "vitest";
import { PHOTO_SUBJECTS, photoFits, photoProblem, suggestedRoom } from "@/lib/photo-rules";
import { PHOTO_ROOMS, PHOTO_ROOM_CHOICES } from "@/lib/constants";

describe("photoFits — what a listing photo may be tagged as", () => {
  test("living room, bedroom and bathroom must match the photo exactly", () => {
    expect(photoFits("living_room", "living_room")).toBe(true);
    expect(photoFits("bedroom", "living_room")).toBe(false); // a bedroom named "living room"
    expect(photoFits("kitchen", "bathroom")).toBe(false);
    expect(photoFits("other_apartment", "bedroom")).toBe(false);
    expect(photoFits("not_apartment", "living_room")).toBe(false); // the dog
  });

  test("the other tags accept any photo of the apartment, never a non-apartment photo", () => {
    for (const label of ["kitchen", "balcony", "exterior", "other"] as const) {
      for (const subject of PHOTO_SUBJECTS) {
        expect(photoFits(subject, label)).toBe(subject !== "not_apartment");
      }
    }
  });

  test("a random food picture is rejected under every tag", () => {
    for (const r of PHOTO_ROOMS) expect(photoFits("not_apartment", r.key)).toBe(false);
  });
});

describe("photoProblem — the message on the tile", () => {
  test("is null when the photo fits", () => {
    expect(photoProblem("bathroom", "bathroom")).toBeNull();
    expect(photoProblem("kitchen", "other")).toBeNull();
  });
  test("explains a wrong room and suggests the right tag", () => {
    expect(photoProblem("bedroom", "living_room")).toBe(
      "This looks like a bedroom, not a living room — tag it as Bedroom or pick another photo."
    );
  });
  test("explains a non-apartment photo", () => {
    expect(photoProblem("not_apartment", "bedroom")).toMatch(/isn't a photo of the apartment/);
  });
  test("explains an unidentifiable interior under a strict tag", () => {
    expect(photoProblem("other_apartment", "bathroom")).toMatch(/couldn't see a bathroom/);
  });
});

test("suggestedRoom maps the six rooms to their tag and nothing else", () => {
  expect(suggestedRoom("bedroom")).toBe("bedroom");
  expect(suggestedRoom("exterior")).toBe("exterior");
  expect(suggestedRoom("other_apartment")).toBeNull();
  expect(suggestedRoom("not_apartment")).toBeNull();
});

test("file-name hints don't collide: bathroom.jpg is not a bedroom", () => {
  const guess = (name: string) =>
    PHOTO_ROOM_CHOICES.find((r) => r.hints.some((h) => name.toLowerCase().includes(h)))?.key ?? "";
  expect(guess("bathroom.jpg")).toBe("bathroom");
  expect(guess("bedroom-2.jpg")).toBe("bedroom");
  expect(guess("living-room.jpg")).toBe("living_room");
  expect(guess("IMG_4821.jpg")).toBe(""); // no hint, and no "Other" to fall into
});
