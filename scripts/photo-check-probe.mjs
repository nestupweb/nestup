/**
 * Eyeball the listing-photo check against real images:
 *   npm run check:photos -- <photo> <tag> [<photo> <tag> …]
 * where <photo> is a URL or a path to a file on disk, and <tag> is the room
 * it would be uploaded under — or `<tag>!` to say that is what the photo
 * really shows, so the run ends with a hit/miss tally:
 *   npm run check:photos -- "my listing-guy/bedroom.png" bedroom!
 *   npm run check:photos -- "https://…/dog.jpg" living_room
 *
 * Prints what the model saw and whether that tag would be accepted, so the
 * rules can be checked against real photos without publishing a listing.
 * Needs GEMINI_API_KEY (the npm script loads .env.local).
 */
import { registerHooks } from "node:module";
import { readFile } from "node:fs/promises";

// The app imports itself as "@/…" and leaves extensions off, the way the
// bundler likes it; teach plain Node both.
const ROOT = new URL("../", import.meta.url);
registerHooks({
  resolve(specifier, context, next) {
    const target = specifier.startsWith("@/") ? new URL(specifier.slice(2), ROOT).href : specifier;
    try {
      return next(target, context);
    } catch (err) {
      for (const ext of [".ts", ".tsx"]) {
        try {
          return next(target + ext, context);
        } catch {
          /* try the next extension */
        }
      }
      throw err;
    }
  },
});

const { classifyListingPhoto, fetchPhotoBytes, PHOTO_CHECK_MODELS } = await import("@/lib/photo-vision.ts");
const { photoProblem } = await import("@/lib/photo-rules.ts");

const args = process.argv.slice(2);
if (args.length < 2 || args.length % 2 !== 0) {
  console.error("usage: npm run check:photos -- <photo> <tag>[!] [<photo> <tag>[!] …]");
  process.exit(1);
}
if (!process.env.GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is not set — add it to .env.local first.");
  process.exit(1);
}
console.log(`models: ${PHOTO_CHECK_MODELS.join(" → ")}
`);

const MIME = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

/** A URL is fetched; anything else is read off disk, so an unpublished photo can be tried. */
async function bytesOf(photo) {
  if (/^https?:\/\//.test(photo)) return fetchPhotoBytes(photo);
  const mimeType = MIME[photo.split(".").pop().toLowerCase()];
  if (!mimeType) throw new Error("Only JPG, PNG or WebP photos can be checked.");
  return { base64: (await readFile(photo)).toString("base64"), mimeType };
}

let failures = 0;
let expected = 0;
let hits = 0;
for (let i = 0; i < args.length; i += 2) {
  const photo = args[i];
  // "bedroom!" means the photo really is a bedroom, so we can score the answer.
  const truth = args[i + 1].endsWith("!");
  const tag = truth ? args[i + 1].slice(0, -1) : args[i + 1];
  const name = photo.split(/[\\/]/).pop().slice(0, 44);
  try {
    const verdict = await classifyListingPhoto(await bytesOf(photo), tag);
    const problem = photoProblem(verdict.subject, tag);
    let mark = "";
    if (truth) {
      expected++;
      const right = verdict.subject === tag;
      if (right) hits++;
      mark = right ? "  [hit]" : "  [MISS]";
    }
    console.log(`${problem ? "REJECT" : "ACCEPT"}  tag=${tag.padEnd(11)} saw=${verdict.subject.padEnd(15)} ${name}${mark}`);
    console.log(`        ${verdict.reason}   [${verdict.model}]`);
    if (problem) console.log(`        → ${problem}`);
  } catch (e) {
    failures++;
    console.log(`ERROR   tag=${tag.padEnd(11)} ${name}  ${e instanceof Error ? e.message : e}`);
  }
}
if (expected) console.log(`
${hits}/${expected} photos read correctly.`);
process.exit(failures ? 1 : 0);
