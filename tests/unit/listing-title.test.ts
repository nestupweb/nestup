import { expect, test } from "vitest";
import { buildListingTitle } from "@/lib/listing-title";
import { missingPhotoRooms } from "@/lib/validation/listing";

test("buildListingTitle reads naturally and stays within 5–80 characters", () => {
  expect(buildListingTitle({ property_type: "apartment", rooms: 3.5, neighborhood: "Florentin", city: "Tel Aviv" }))
    .toBe("Room in a 3.5-room apartment in Florentin");
  expect(buildListingTitle({ property_type: "studio", rooms: 1, neighborhood: "", city: "Netanya" })).toBe("Studio in Netanya");
  expect(buildListingTitle({ property_type: "private_house", rooms: 5, city: "Raanana" }))
    .toBe("Room in a 5-room private house in Raanana");
  const long = buildListingTitle({ property_type: "garden_apartment", rooms: 4, neighborhood: "N".repeat(90), city: "Haifa" });
  expect(long.length).toBeLessThanOrEqual(80);
});

test("missingPhotoRooms lists what a listing still has to show", () => {
  expect(missingPhotoRooms(["living_room", "bedroom", "bathroom", "kitchen"])).toEqual([]);
  expect(missingPhotoRooms(["living_room", "other"])).toEqual(["bedroom", "bathroom"]);
});
