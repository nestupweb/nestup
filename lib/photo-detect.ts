/**
 * The photo check that runs in the member's own browser, before a photo is
 * uploaded. Two models look at the file together:
 *
 * - an object detector (COCO-SSD) that finds *things* and how much of the
 *   frame they fill — a dog, a pizza, a car, a person, but also a bed, a
 *   sofa, a toilet or a fridge, which name the room;
 * - a classifier (MobileNet, 1000 categories) that reads the picture as a
 *   whole — a beach, a mountain, a flower, a menu, a screenshot. Without it,
 *   anything the detector has no word for slips through unseen.
 *
 * It only ever speaks when it is sure: a photo neither model can read comes
 * back `unsure` and goes through, so a plain white wall is never turned away.
 * The server check in `photo-check.ts` is the strict authority when
 * `ANTHROPIC_API_KEY` is set.
 */

/** The rooms furniture can name on its own — also valid `PhotoSubject`s. */
export type DetectableRoom = "living_room" | "bedroom" | "bathroom" | "kitchen";

export type LocalPhotoVerdict =
  | { kind: "reject"; reason: string }
  | { kind: "room"; room: DetectableRoom }
  | { kind: "unsure" };

/** One object the detector found. */
export interface Detected {
  class: string;
  score: number;
  /** Share of the frame this object covers, 0–1. */
  share: number;
}

/** One guess from the whole-picture classifier. */
export interface Guess {
  className: string;
  probability: number;
}

/**
 * Things that mean "this is not a photo of the apartment", with how much of
 * the frame each has to fill before we say so. People and pets do turn up in
 * real room photos, so they need to dominate the picture; a plate of food or a
 * car never belongs in a room photo at all. Screens, books and keyboards are
 * ordinary things in a home — only a close-up of one is not a room photo.
 */
const NOT_A_HOME: { classes: readonly string[]; share: number }[] = [
  { classes: ["dog", "cat", "bird", "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe"], share: 0.12 },
  { classes: ["banana", "apple", "sandwich", "orange", "broccoli", "carrot", "hot dog", "pizza", "donut", "cake"], share: 0.12 },
  { classes: ["bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck", "boat"], share: 0.15 },
  { classes: ["traffic light", "fire hydrant", "stop sign", "parking meter"], share: 0.1 },
  { classes: ["frisbee", "skis", "snowboard", "sports ball", "kite", "baseball bat", "baseball glove", "skateboard", "surfboard", "tennis racket"], share: 0.15 },
  { classes: ["person"], share: 0.28 },
  { classes: ["laptop", "keyboard", "mouse", "cell phone", "remote", "book", "tv"], share: 0.45 },
];

/** Furniture that names the room it stands in. */
const ROOM_CUES: { classes: readonly string[]; room: DetectableRoom }[] = [
  { classes: ["bed"], room: "bedroom" },
  { classes: ["couch"], room: "living_room" },
  { classes: ["toilet"], room: "bathroom" },
  { classes: ["oven", "refrigerator", "microwave", "toaster"], room: "kitchen" },
];

/**
 * What the whole-picture classifier may see instead of a home. Matched as
 * substrings against its category names ("seashore, coast, seacoast"), each
 * with the sentence the member reads when the photo is turned away. Nothing
 * here may name something that belongs indoors — a false match costs a member
 * a perfectly good photo.
 */
const NOT_A_HOME_SCENES: { words: readonly string[]; reason: string; min: number }[] = [
  {
    // Nature only. Nothing built: "Building / street" is a tag members are
    // meant to use, so castles, viaducts and the like must not match here.
    words: [
      "seashore", "lakeside", "lakeshore", "valley", "alp", "cliff", "promontory", "sandbar", "coral reef",
      "geyser", "volcano", "iceberg", "glacier", "haystack", "hay", "sandbank", "shoal",
    ],
    reason: "This looks like scenery outdoors, not part of an apartment.",
    min: 0.25,
  },
  {
    words: [
      "daisy", "lady's slipper", "rapeseed", "acorn", "buckeye", "coral fungus", "agaric", "mushroom",
      "cardoon", "hip, rose", "sea urchin", "sea anemone", "jellyfish", "starfish", "spider", "butterfly",
      "bee, ", "beetle", "dragonfly", "damselfly", "mantis", "grasshopper", "snail", "slug", "worm",
    ],
    reason: "This is a close-up of a plant or an animal, not a room.",
    min: 0.25,
  },
  {
    words: [
      "pizza", "cheeseburger", "hotdog", "ice cream", "ice lolly", "guacamole", "consomme", "trifle",
      "carbonara", "burrito", "bagel", "pretzel", "meat loaf", "mashed potato", "espresso", "red wine",
      "eggnog", "banana", "orange", "lemon", "pineapple", "strawberry", "pomegranate", "french loaf",
      "dough", "cauliflower", "broccoli", "cucumber", "bell pepper", "corn",
    ],
    reason: "This looks like food, not a room.",
    min: 0.25,
  },
  {
    words: [
      "menu", "web site", "envelope", "comic book", "book jacket", "crossword", "notebook", "laptop",
      "desktop computer", "monitor", "screen", "typewriter", "binder", "ballpoint", "fountain pen",
      "bookshop", "carton", "packet",
    ],
    // Held to a higher bar: a real room photo sometimes comes back as
    // "crossword puzzle" or "binder" with a fifth of the classifier's
    // confidence, and losing a good photo is worse than missing a bad one.
    reason: "This looks like a document or a screen, not a room.",
    min: 0.35,
  },
  {
    words: ["sports car", "convertible", "limousine", "minivan", "pickup", "jeep", "moped", "motor scooter", "mountain bike", "racer", "cab, hack", "trailer truck", "school bus"],
    reason: "This looks like a vehicle, not a room.",
    min: 0.3,
  },
  {
    words: ["jersey", "gown", "bikini", "sunglass", "wig", "military uniform", "bow tie", "brassiere", "maillot", "kimono"],
    reason: "This looks like a photo of a person, not a room.",
    min: 0.3,
  },
];

/** "a dog" / "an apple" reads better than the bare class name. */
function article(name: string): string {
  return /^[aeiou]/.test(name) ? `an ${name}` : `a ${name}`;
}

/**
 * Turn what the two models saw into a verdict. Pure, so the thresholds can be
 * tested — and re-tuned — without loading anything.
 */
export function readVerdict(objects: readonly Detected[], guesses: readonly Guess[] = []): LocalPhotoVerdict {
  const seen = objects.filter((o) => o.score >= 0.5);

  const cue = ROOM_CUES.flatMap((c) => seen.filter((o) => c.classes.includes(o.class)).map((o) => ({ ...o, room: c.room })))
    .sort((a, b) => b.share - a.share)[0];

  const bad = NOT_A_HOME.flatMap((g) => seen.filter((o) => g.classes.includes(o.class) && o.share >= g.share)).sort(
    (a, b) => b.share - a.share
  )[0];

  // A pet on the sofa is still a photo of the living room — the offending
  // thing has to be the biggest thing in the picture before we turn it away.
  if (bad && (!cue || bad.share > cue.share)) {
    const named = article(bad.class);
    return { kind: "reject", reason: `${named.charAt(0).toUpperCase()}${named.slice(1)} is the main thing in this photo.` };
  }
  if (cue) return { kind: "room", room: cue.room };

  // Nothing the detector has a word for. Ask the classifier what the picture
  // is of — this is what catches a beach, a flower or a screenshot.
  for (const guess of guesses) {
    const name = guess.className.toLowerCase();
    const hit = NOT_A_HOME_SCENES.find(
      (group) => guess.probability >= group.min && group.words.some((w) => name.includes(w))
    );
    if (hit) return { kind: "reject", reason: hit.reason };
  }
  return { kind: "unsure" };
}

interface Models {
  detect: (img: HTMLImageElement) => Promise<{ class: string; score: number; bbox: number[] }[]>;
  classify: (img: HTMLImageElement) => Promise<{ className: string; probability: number }[]>;
}

let modelsPromise: Promise<Models> | null = null;

/** Loads both models once per page (a few MB, fetched from the TF.js CDN). */
async function loadModels(): Promise<Models> {
  if (!modelsPromise) {
    modelsPromise = (async () => {
      await import("@tensorflow/tfjs");
      const [cocoSsd, mobilenet] = await Promise.all([
        import("@tensorflow-models/coco-ssd"),
        import("@tensorflow-models/mobilenet"),
      ]);
      // The small classifier: 5 MB rather than 14, and just as good at the
      // pictures this has to catch (scenery, food, animals, plants).
      const [detector, classifier] = await Promise.all([cocoSsd.load(), mobilenet.load({ version: 1, alpha: 0.5 })]);
      return {
        detect: (img: HTMLImageElement) => detector.detect(img),
        classify: (img: HTMLImageElement) => classifier.classify(img, 5),
      };
    })().catch((e) => {
      modelsPromise = null; // let the next photo try again
      throw e;
    });
  }
  return modelsPromise;
}

function decode(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("could not read the image"));
    };
    img.src = url;
  });
}

/**
 * Look at `file` in the browser. Never throws: if the models can't load (no
 * network, an unsupported browser) the answer is `unsure` and the photo goes
 * through, exactly as it did before this check existed.
 */
export async function inspectPhoto(file: File): Promise<LocalPhotoVerdict> {
  try {
    const [models, img] = await Promise.all([loadModels(), decode(file)]);
    const frame = Math.max(1, img.naturalWidth * img.naturalHeight);
    const [found, guesses] = await Promise.all([models.detect(img), models.classify(img)]);
    return readVerdict(
      found.map((o) => ({ class: o.class, score: o.score, share: (o.bbox[2] * o.bbox[3]) / frame })),
      guesses
    );
  } catch {
    return { kind: "unsure" };
  }
}
