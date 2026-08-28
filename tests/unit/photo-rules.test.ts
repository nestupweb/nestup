import { describe, expect, test } from "vitest";
import { PHOTO_SUBJECTS, photoFits, photoProblem, suggestedRoom } from "@/lib/photo-rules";
import { PHOTO_ROOMS, PHOTO_ROOM_CHOICES } from "@/lib/constants";

describe("photoFits — what a listing photo may be tagged as", () => {
  test("every tag a member can pick must match the photo exactly", () => {
    for (const r of PHOTO_ROOM_CHOICES) {
      for (const subject of PHOTO_SUBJECTS) {
        expect(photoFits(subject, r.key)).toBe(subject === r.key);
      }
    }
  });

  test("the rooms that used to be lenient are strict now", () => {
    expect(photoFits("kitchen", "balcony")).toBe(false); // a kitchen named "balcony"
    expect(photoFits("living_room", "kitchen")).toBe(false);
    expect(photoFits("bedroom", "exterior")).toBe(false);
    expect(photoFits("other_apartment", "kitchen")).toBe(false); // a hallway named "kitchen"
    expect(photoFits("balcony", "balcony")).toBe(true);
    expect(photoFits("exterior", "exterior")).toBe(true);
  });

  test("the retired 'Other' tag still accepts any photo of the apartment", () => {
    for (const subject of PHOTO_SUBJECTS) {
      expect(photoFits(subject, "other")).toBe(subject !== "not_apartment");
    }
  });

  test("a random food picture is rejected under every tag", () => {
    for (const r of PHOTO_ROOMS) expect(photoFits("not_apartment", r.key)).toBe(false);
  });
});

describe("photoProblem — the message on the tile", () => {
  test("is null when the photo fits", () => {
    expect(photoProblem("bathroom", "bathroom")).toBeNull();
    expect(photoProblem("balcony", "balcony")).toBeNull();
    expect(photoProblem("kitchen", "other")).toBeNull();
  });

  test("names what the photo shows and asks for the right one", () => {
    expect(photoProblem("bedroom", "living_room")).toBe(
      "This looks like a bedroom, not a living room — tag it as Bedroom or upload a photo of a living room."
    );
    expect(photoProblem("kitchen", "balcony")).toBe(
      "This looks like a kitchen, not a balcony — tag it as Kitchen or upload a photo of a balcony."
    );
  });

  test("explains a non-apartment photo and asks for the room instead", () => {
    expect(photoProblem("not_apartment", "bedroom")).toBe(
      "This isn't a photo of the apartment — please upload a photo of a bedroom instead."
    );
  });

  test("explains an unidentifiable interior under any tag", () => {
    expect(photoProblem("other_apartment", "bathroom")).toBe(
      "We couldn't see a bathroom in this photo — please upload one that clearly shows a bathroom."
    );
    expect(photoProblem("other_apartment", "kitchen")).toMatch(/couldn't see a kitchen/);
  });

  test("every mismatch produces a sentence, never an empty string", () => {
    for (const r of PHOTO_ROOM_CHOICES) {
      for (const subject of PHOTO_SUBJECTS) {
        const message = photoProblem(subject, r.key);
        if (subject === r.key) expect(message).toBeNull();
        else expect(message).toMatch(/\S/);
      }
    }
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
