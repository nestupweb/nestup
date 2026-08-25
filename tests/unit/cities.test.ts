import { expect, test } from "vitest";
import { CITIES, matchCity, suggestCities } from "@/lib/cities";

test("the national list is large, unique and keeps the launch spellings", () => {
  expect(CITIES.length).toBeGreaterThan(100);
  expect(new Set(CITIES).size).toBe(CITIES.length);
  for (const c of ["Tel Aviv", "Beer Sheva", "Rishon LeZion", "Petah Tikva", "Raanana", "Eilat", "Ashdod", "Nazareth"]) {
    expect(CITIES).toContain(c);
  }
});

test("suggestCities ranks prefix matches first and matches inner words", () => {
  expect(suggestCities("hai")[0]).toBe("Haifa");
  expect(suggestCities("HAI")).toContain("Haifa");
  expect(suggestCities("sab")).toContain("Kfar Saba");
  expect(suggestCities("tel")).toEqual(expect.arrayContaining(["Tel Aviv", "Tel Mond"]));
  expect(suggestCities("zzz")).toEqual([]);
  expect(suggestCities("k").length).toBeLessThanOrEqual(8);
});

test("matchCity canonicalises free text", () => {
  expect(matchCity("haifa")).toBe("Haifa");
  expect(matchCity(" TEL AVIV ")).toBe("Tel Aviv");
  expect(matchCity("Modiin-Maccabim-Reut")).toBe("Modi'in-Maccabim-Re'ut");
  expect(matchCity("Paris")).toBeNull();
});
