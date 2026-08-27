import { describe, expect, test } from "vitest";
import { readVerdict } from "@/lib/photo-detect";

const o = (cls: string, share: number, score = 0.9) => ({ class: cls, score, share });

describe("readDetections — the check that runs in the browser", () => {
  test("a dog photo is turned away, and the message names the dog", () => {
    const v = readVerdict([o("dog", 0.55)]);
    expect(v.kind).toBe("reject");
    expect(v).toMatchObject({ reason: "A dog is the main thing in this photo." });
  });

  test("food, cars and streets are turned away too", () => {
    expect(readVerdict([o("pizza", 0.4)]).kind).toBe("reject");
    expect(readVerdict([o("car", 0.5)]).kind).toBe("reject");
    expect(readVerdict([o("traffic light", 0.2)]).kind).toBe("reject");
    expect(readVerdict([o("apple", 0.3)])).toMatchObject({ reason: "An apple is the main thing in this photo." });
  });

  test("a selfie is turned away but a person in the corner of a room is not", () => {
    expect(readVerdict([o("person", 0.6)]).kind).toBe("reject");
    expect(readVerdict([o("person", 0.08), o("couch", 0.3)])).toEqual({ kind: "room", room: "living_room" });
  });

  test("a pet on the sofa is still a photo of the living room", () => {
    expect(readVerdict([o("dog", 0.14), o("couch", 0.42)])).toEqual({ kind: "room", room: "living_room" });
  });

  test("furniture names the room", () => {
    expect(readVerdict([o("bed", 0.5)])).toEqual({ kind: "room", room: "bedroom" });
    expect(readVerdict([o("toilet", 0.2), o("sink", 0.1)])).toEqual({ kind: "room", room: "bathroom" });
    expect(readVerdict([o("refrigerator", 0.25)])).toEqual({ kind: "room", room: "kitchen" });
  });

  test("it stays quiet when it can't tell — an empty room is not a rejection", () => {
    expect(readVerdict([])).toEqual({ kind: "unsure" });
    expect(readVerdict([o("vase", 0.05), o("clock", 0.02)])).toEqual({ kind: "unsure" });
    expect(readVerdict([o("dog", 0.9, 0.3)])).toEqual({ kind: "unsure" }); // unsure detection, ignored
    expect(readVerdict([o("dog", 0.04)])).toEqual({ kind: "unsure" }); // a dog toy on a shelf
  });
});

describe("the whole-picture classifier — what the object detector has no word for", () => {
  const g = (className: string, probability: number) => ({ className, probability });

  test("a landscape, a flower, a menu and a car are turned away with a fitting sentence", () => {
    expect(readVerdict([], [g("seashore, coast, seacoast, sea-coast", 0.62)])).toEqual({
      kind: "reject",
      reason: "This looks like scenery outdoors, not part of an apartment.",
    });
    expect(readVerdict([], [g("valley, vale", 0.4)]).kind).toBe("reject");
    expect(readVerdict([], [g("daisy", 0.55)])).toMatchObject({ reason: "This is a close-up of a plant or an animal, not a room." });
    expect(readVerdict([], [g("menu", 0.44)])).toMatchObject({ reason: "This looks like a document or a screen, not a room." });
    expect(readVerdict([], [g("sports car, sport car", 0.48)])).toMatchObject({ reason: "This looks like a vehicle, not a room." });
  });

  test("a close-up of a screen or a book is turned away by the detector's share rule", () => {
    expect(readVerdict([o("keyboard", 0.84)]).kind).toBe("reject");
    expect(readVerdict([o("tv", 0.2), o("couch", 0.3)])).toEqual({ kind: "room", room: "living_room" }); // a TV in a living room is fine
  });

  test("an office paper stack and a macro of a dandelion are turned away", () => {
    expect(readVerdict([], [g("carton", 0.38), g("bookshop, bookstore, bookstall", 0.38)]).kind).toBe("reject");
    expect(readVerdict([], [g("sea urchin", 0.49)])).toMatchObject({
      reason: "This is a close-up of a plant or an animal, not a room.",
    });
  });

  test("built things never match the outdoor rule — a Building / street photo must survive", () => {
    for (const name of ["castle", "monastery", "viaduct", "cinema, movie theater", "library", "miniskirt, mini", "damselfly"]) {
      const v = readVerdict([], [g(name, 0.6)]);
      if (v.kind === "reject") expect(v.reason).not.toBe("This looks like scenery outdoors, not part of an apartment.");
    }
    expect(readVerdict([], [g("cinema, movie theater, movie theatre", 0.6)])).toEqual({ kind: "unsure" });
    expect(readVerdict([], [g("castle", 0.6)])).toEqual({ kind: "unsure" });
  });

  test("a guess the classifier isn't sure about is ignored", () => {
    expect(readVerdict([], [g("seashore", 0.11)])).toEqual({ kind: "unsure" });
  });

  test("groups that can misfire on real room photos need more confidence", () => {
    // A living room really does come back as "crossword puzzle" sometimes.
    expect(readVerdict([], [g("crossword puzzle", 0.23)])).toEqual({ kind: "unsure" });
    expect(readVerdict([], [g("crossword puzzle", 0.4)]).kind).toBe("reject");
    // Scenery, food and animals are unambiguous, so they answer sooner.
    expect(readVerdict([], [g("alp", 0.26)]).kind).toBe("reject");
    expect(readVerdict([], [g("pizza", 0.26)]).kind).toBe("reject");
  });

  test("indoor guesses pass — the classifier can only reject, never approve a room", () => {
    for (const name of ["studio couch, day bed", "quilt, comforter", "washbasin, handbasin", "wardrobe, closet", "window shade", "dining table, board"]) {
      expect(readVerdict([], [g(name, 0.8)])).toEqual({ kind: "unsure" });
    }
  });

  test("what the detector says wins — a real room photo is never overruled by a guess", () => {
    expect(readVerdict([o("bed", 0.4)], [g("seashore", 0.9)])).toEqual({ kind: "room", room: "bedroom" });
  });
});
