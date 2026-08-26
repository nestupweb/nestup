import { expect, test } from "vitest";
import { orderPhotos } from "@/lib/photos";

test("swipe story opens living room → bedroom → bathroom, then the rest as posted", () => {
  const { urls, labels } = orderPhotos(
    ["bath.jpg", "kitchen.jpg", "bed.jpg", "balcony.jpg", "living.jpg"],
    ["bathroom", "kitchen", "bedroom", "balcony", "living_room"]
  );
  expect(urls).toEqual(["living.jpg", "bed.jpg", "bath.jpg", "kitchen.jpg", "balcony.jpg"]);
  expect(labels).toEqual(["living_room", "bedroom", "bathroom", "kitchen", "balcony"]);
});

test("untagged photos keep the host's order and never jump ahead", () => {
  expect(orderPhotos(["a.jpg", "b.jpg", "c.jpg"]).urls).toEqual(["a.jpg", "b.jpg", "c.jpg"]);
  const { urls, labels } = orderPhotos(["a.jpg", "b.jpg", "c.jpg"], ["", "bedroom", ""]);
  expect(urls).toEqual(["b.jpg", "a.jpg", "c.jpg"]);
  expect(labels).toEqual(["bedroom", "", ""]);
});

test("two photos of the same room stay in the posted order", () => {
  const { urls } = orderPhotos(["bed2.jpg", "living.jpg", "bed1.jpg"], ["bedroom", "living_room", "bedroom"]);
  expect(urls).toEqual(["living.jpg", "bed2.jpg", "bed1.jpg"]);
});
