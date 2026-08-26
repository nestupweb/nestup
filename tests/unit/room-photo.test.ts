import { expect, test } from "vitest";
import { roomPhoto } from "@/lib/room-photo";

const urls = ["https://x/living.jpg", "https://x/bed.jpg", "https://x/bath.jpg"];

test("roomPhoto picks the photo labelled bedroom", () => {
  expect(roomPhoto({ photo_urls: urls, photo_labels: ["living_room", "bedroom", "bathroom"] })).toEqual({
    url: "https://x/bed.jpg",
    isBedroom: true,
  });
});

test("roomPhoto falls back to the cover when nothing is labelled bedroom (seed rooms, old listings)", () => {
  expect(roomPhoto({ photo_urls: urls, photo_labels: [] })).toEqual({ url: "https://x/living.jpg", isBedroom: false });
  expect(roomPhoto({ photo_urls: urls, photo_labels: ["kitchen", "balcony"] })).toEqual({ url: "https://x/living.jpg", isBedroom: false });
  // A stray label beyond the photo list can't point at anything.
  expect(roomPhoto({ photo_urls: ["https://x/one.jpg"], photo_labels: ["other", "bedroom"] })).toEqual({ url: "https://x/one.jpg", isBedroom: false });
});

test("roomPhoto is null without photos", () => {
  expect(roomPhoto({ photo_urls: [], photo_labels: [] })).toBeNull();
});
