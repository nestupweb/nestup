import { describe, expect, test } from "vitest";
import { readDetections } from "@/lib/photo-detect";

const o = (cls: string, share: number, score = 0.9) => ({ class: cls, score, share });

describe("readDetections — the check that runs in the browser", () => {
  test("a dog photo is turned away, and the message names the dog", () => {
    const v = readDetections([o("dog", 0.55)]);
    expect(v.kind).toBe("reject");
    expect(v).toMatchObject({ reason: "A dog is the main thing in this photo." });
  });

  test("food, cars and streets are turned away too", () => {
    expect(readDetections([o("pizza", 0.4)]).kind).toBe("reject");
    expect(readDetections([o("car", 0.5)]).kind).toBe("reject");
    expect(readDetections([o("traffic light", 0.2)]).kind).toBe("reject");
    expect(readDetections([o("apple", 0.3)])).toMatchObject({ reason: "An apple is the main thing in this photo." });
  });

  test("a selfie is turned away but a person in the corner of a room is not", () => {
    expect(readDetections([o("person", 0.6)]).kind).toBe("reject");
    expect(readDetections([o("person", 0.08), o("couch", 0.3)])).toEqual({ kind: "room", room: "living_room" });
  });

  test("a pet on the sofa is still a photo of the living room", () => {
    expect(readDetections([o("dog", 0.14), o("couch", 0.42)])).toEqual({ kind: "room", room: "living_room" });
  });

  test("furniture names the room", () => {
    expect(readDetections([o("bed", 0.5)])).toEqual({ kind: "room", room: "bedroom" });
    expect(readDetections([o("toilet", 0.2), o("sink", 0.1)])).toEqual({ kind: "room", room: "bathroom" });
    expect(readDetections([o("refrigerator", 0.25)])).toEqual({ kind: "room", room: "kitchen" });
  });

  test("it stays quiet when it can't tell — an empty room is not a rejection", () => {
    expect(readDetections([])).toEqual({ kind: "unsure" });
    expect(readDetections([o("vase", 0.05), o("clock", 0.02)])).toEqual({ kind: "unsure" });
    expect(readDetections([o("dog", 0.9, 0.3)])).toEqual({ kind: "unsure" }); // unsure detection, ignored
    expect(readDetections([o("dog", 0.04)])).toEqual({ kind: "unsure" }); // a dog toy on a shelf
  });
});
