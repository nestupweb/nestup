/**
 * Eyeball the listing-photo check against real images:
 *   npm run check:photos -- <url> <tag> [<url> <tag> …]
 * Prints what the model saw and whether the tag would be accepted. Needs
 * ANTHROPIC_API_KEY (run through `npm run check:photos`, which loads .env.local).
 */
import { classifyListingPhoto } from "../lib/photo-check.ts";
import { photoProblem } from "../lib/photo-rules.ts";

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
