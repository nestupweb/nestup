/**
 * Eyeball the listing-photo check against real images:
 *   npm run check:photos -- <url> <tag> [<url> <tag> …]
 * e.g. npm run check:photos -- "https://…/dog.jpg" living_room
 *
 * Prints what the model saw and whether that tag would be accepted, so the
 * rules can be checked against real photos without publishing a listing.
 * Needs ANTHROPIC_API_KEY (the npm script loads .env.local).
 */
import { registerHooks } from "node:module";

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

const { classifyListingPhoto } = await import("@/lib/photo-vision.ts");
const { photoProblem } = await import("@/lib/photo-rules.ts");

const args = process.argv.slice(2);
if (args.length < 2 || args.length % 2 !== 0) {
  console.error("usage: npm run check:photos -- <url> <tag> [<url> <tag> …]");
  process.exit(1);
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set — add it to .env.local first.");
  process.exit(1);
}

let failures = 0;
for (let i = 0; i < args.length; i += 2) {
  const [url, tag] = [args[i], args[i + 1]];
  try {
    const verdict = await classifyListingPhoto(url, tag);
    const problem = photoProblem(verdict.subject, tag);
    console.log(`${problem ? "REJECT" : "ACCEPT"}  tag=${tag}  saw=${verdict.subject}`);
    console.log(`        ${verdict.reason}`);
    if (problem) console.log(`        → ${problem}`);
  } catch (e) {
    failures++;
    console.log(`ERROR   tag=${tag}  ${e instanceof Error ? e.message : e}`);
  }
}
process.exit(failures ? 1 : 0);
