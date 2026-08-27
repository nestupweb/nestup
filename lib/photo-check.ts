import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { isPhotoSubject, photoProblem, type PhotoSubject } from "@/lib/photo-rules";
import type { PhotoRoom } from "@/lib/types";

/**
 * Server half of the listing-photo check: whether it is switched on, the
 * HMAC-signed verdicts the browser carries between the check and the publish,
 * and the publish-time audit. The look itself lives in `photo-vision.ts`.
 *
 * Without `ANTHROPIC_API_KEY` the check is off and listings save as before —
 * `isPhotoCheckEnabled()` gates both the browser call and the publish audit.
 */
export function isPhotoCheckEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export { classifyListingPhoto, PHOTO_CHECK_MODEL, type PhotoVerdict } from "@/lib/photo-vision";

// ---------------------------------------------------------------------------
// Signed verdicts — the browser holds them between the check and the publish.
// ---------------------------------------------------------------------------

function verdictKey(secret: string): Buffer {
  return createHash("sha256").update(`nestup-photo-check:${secret}`).digest();
}

/** `subject.hmac` for (url, subject); only this server can mint one. */
export function signPhotoVerdict(secret: string, url: string, subject: PhotoSubject): string {
  const mac = createHmac("sha256", verdictKey(secret)).update(`${url}\n${subject}`).digest("hex");
  return `${subject}.${mac}`;
}

/** The subject a token vouches for on `url`, or null if it's missing/forged. */
export function readPhotoVerdict(secret: string, url: string, token: string | undefined): PhotoSubject | null {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot < 0) return null;
  const subject = token.slice(0, dot);
  if (!isPhotoSubject(subject)) return null;
  const expected = signPhotoVerdict(secret, url, subject);
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return subject;
}

export interface PhotoAuditInput {
  urls: readonly string[];
  labels: readonly PhotoRoom[];
  tokens: readonly (string | undefined)[];
  /** url → label pairs already stored on this listing; they were vetted when saved. */
  trusted: ReadonlyMap<string, PhotoRoom>;
  secret: string;
}

/**
 * Publish-time gate: every (url, label) pair must either already be on the
 * listing or carry a token whose subject fits the label. Returns the first
 * offending photo (0-based) with a message, or null when all is well.
 */
export function auditPhotos(input: PhotoAuditInput): { index: number; message: string } | null {
  for (let i = 0; i < input.urls.length; i++) {
    const url = input.urls[i];
    const label = input.labels[i] ?? "other";
    if (input.trusted.get(url) === label) continue;
    const subject = readPhotoVerdict(input.secret, url, input.tokens[i]);
    if (!subject) {
      return { index: i, message: "this photo hasn't been checked yet — remove it and add it again." };
    }
    const problem = photoProblem(subject, label);
    if (problem) return { index: i, message: problem };
  }
  return null;
}

/** Storage URL prefix every checkable photo must live under (the public listing-photos bucket). */
export function listingPhotoPrefix(): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/listing-photos/`;
}
