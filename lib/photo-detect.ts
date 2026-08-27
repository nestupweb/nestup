/**
 * The photo check that runs in the member's own browser, before a photo is
 * uploaded: an object detector (COCO-SSD via TensorFlow.js) looks at the file
 * and says whether it is a photo of a home at all, and which room it is.
 *
 * It only ever speaks when it is sure. A dog, a plate of food or a car filling
 * the frame is refused on the spot; a bed or a sofa re-tags the photo to the
 * room it shows; anything it can't read comes back `unsure`, which lets the
 * photo through (the server check in `photo-check.ts` is the strict authority
 * when `ANTHROPIC_API_KEY` is set).
 */
/** The rooms furniture can name on its own — also valid `PhotoSubject`s. */
export type DetectableRoom = "living_room" | "bedroom" | "bathroom" | "kitchen";

export type LocalPhotoVerdict =
  | { kind: "reject"; reason: string }
  | { kind: "room"; room: DetectableRoom }
  | { kind: "unsure" };

interface Detected {
  class: string;
  score: number;
  /** Share of the frame this object covers, 0–1. */
  share: number;
}

/**
 * Things that mean "this is not a photo of the apartment", with how much of
 * the frame each has to fill before we say so. People and pets do turn up in
 * real room photos, so they need to dominate the picture; a plate of food or a
 * car never belongs in a room photo at all.
 */
const NOT_A_HOME: { classes: readonly string[]; share: number }[] = [
  { classes: ["dog", "cat", "bird", "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe"], share: 0.12 },
  { classes: ["banana", "apple", "sandwich", "orange", "broccoli", "carrot", "hot dog", "pizza", "donut", "cake"], share: 0.12 },
  { classes: ["bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck", "boat"], share: 0.15 },
  { classes: ["traffic light", "fire hydrant", "stop sign", "parking meter"], share: 0.1 },
  { classes: ["frisbee", "skis", "snowboard", "sports ball", "kite", "baseball bat", "baseball glove", "skateboard", "surfboard", "tennis racket"], share: 0.15 },
  { classes: ["person"], share: 0.28 },
];

/** Furniture that names the room it stands in. */
const ROOM_CUES: { classes: readonly string[]; room: DetectableRoom }[] = [
  { classes: ["bed"], room: "bedroom" },
  { classes: ["couch"], room: "living_room" },
  { classes: ["toilet"], room: "bathroom" },
  { classes: ["oven", "refrigerator", "microwave", "toaster"], room: "kitchen" },
];

/** "a dog" / "a pizza" reads better than the bare class name. */
function article(name: string): string {
  return /^[aeiou]/.test(name) ? `an ${name}` : `a ${name}`;
}

/** Turn raw detections into a verdict. Exported so it can be tested without the model. */
export function readDetections(objects: readonly Detected[]): LocalPhotoVerdict {
  const seen = objects.filter((o) => o.score >= 0.5);
  if (seen.length === 0) return { kind: "unsure" };

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
  return { kind: "unsure" };
}

let modelPromise: Promise<{ detect: (img: HTMLImageElement) => Promise<{ class: string; score: number; bbox: number[] }[]> }> | null =
  null;

/** Loads the detector once per page (about 5 MB, fetched from the TF.js CDN). */
async function loadModel() {
  if (!modelPromise) {
    modelPromise = (async () => {
      await import("@tensorflow/tfjs");
      const cocoSsd = await import("@tensorflow-models/coco-ssd");
      const model = await cocoSsd.load(); // lite_mobilenet_v2
      return { detect: (img: HTMLImageElement) => model.detect(img) };
    })().catch((e) => {
      modelPromise = null; // let the next photo try again
      throw e;
    });
  }
  return modelPromise;
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
 * Look at `file` in the browser. Never throws: if the model can't load (no
 * network, an unsupported browser) the answer is `unsure` and the photo goes
 * through, exactly as it did before this check existed.
 */
export async function inspectPhoto(file: File): Promise<LocalPhotoVerdict> {
  try {
    const [model, img] = await Promise.all([loadModel(), decode(file)]);
    const frame = Math.max(1, img.naturalWidth * img.naturalHeight);
    const objects = (await model.detect(img)).map((o) => ({
      class: o.class,
      score: o.score,
      share: (o.bbox[2] * o.bbox[3]) / frame,
    }));
    return readDetections(objects);
  } catch {
    return { kind: "unsure" };
  }
}
