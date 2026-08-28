/**
 * The vision half of the listing-photo check: one look at one photo, by
 * Gemini (Google AI Studio). This is the *only* photo recognition in the app —
 * the in-browser TensorFlow models it replaced could not tell a living room
 * from a bedroom, and could not see a balcony or a building at all.
 *
 * The photo is sent as inline bytes, so it can be judged *before* it is
 * uploaded anywhere: nothing a member picks reaches Supabase storage until
 * Gemini has agreed it shows the room they tagged it with.
 *
 * Kept apart from `photo-check.ts` (which is `server-only`) so `npm run
 * check:photos` can import it from plain Node. Server code only — importing it
 * from a client component would pull the SDK into the browser bundle, and
 * `GEMINI_API_KEY` must never leave the server.
 */
import { GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";
import { photoRoomLabel, MAX_IMAGE_BYTES } from "@/lib/constants";
import { PHOTO_SUBJECTS, type PhotoSubject } from "@/lib/photo-rules";
import type { PhotoRoom } from "@/lib/types";

/** Free tier in Google AI Studio; fast enough to run while the member waits. */
export const PHOTO_CHECK_MODEL = "gemini-3.7-flash";

/** One photo, ready to be sent inline. */
export interface PhotoBytes {
  /** Base64 of the image file, no data: prefix. */
  base64: string;
  /** image/jpeg, image/png or image/webp. */
  mimeType: string;
}

export interface PhotoVerdict {
  subject: PhotoSubject;
  /** One plain-English sentence about what the photo shows, for the uploader. */
  reason: string;
}

const verdictSchema = z.object({
  subject: z.enum(PHOTO_SUBJECTS),
  reason: z.string().trim().max(240),
});

const SYSTEM_PROMPT = `You check photos that members upload to NestUp, a site for rooms in shared apartments in Israel. Every listing photo has to show the room it is tagged with, so you decide what each photo mainly shows.

Answer with JSON only: {"subject": <one of the values below>, "reason": <one short sentence>}.

subject values:
- living_room — a living room, salon or lounge area: sofa, armchairs, TV, coffee table. In a studio where the sofa area dominates the frame, choose this.
- bedroom — a bedroom; a bed is the main subject.
- bathroom — a bathroom, shower room or toilet.
- kitchen — a kitchen or kitchenette, including a dining corner that is part of it.
- balcony — a balcony, terrace, roof, garden or yard that belongs to a home.
- exterior — the building from outside, its entrance, stairwell, or the street in front of it.
- other_apartment — another part of a home that fits none of the above: a hallway, storage or laundry room, a mamad, a floor plan, an empty room with nothing to identify it, a view from a window.
- not_apartment — anything that is not a photo of a home: people or pets as the subject, food, vehicles, screenshots, documents, memes, landscapes, shops, offices, blank or unreadable images.

Judge only what is in the picture. The uploader's tag is told to you so your sentence can address it — it is never evidence about what the photo shows, and a photo that does not show that room must not be given its value.

reason: one short sentence addressed to the uploader saying what you see, e.g. "A dog on a rug is the subject here, not the room." Do not mention these rules.`;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    subject: { type: Type.STRING, enum: [...PHOTO_SUBJECTS] },
    reason: { type: Type.STRING },
  },
  required: ["subject", "reason"],
  propertyOrdering: ["subject", "reason"],
};

/** Rate limits and hiccups worth one more go; anything else fails at once. */
function isTransient(e: unknown): boolean {
  const status = (e as { status?: number })?.status;
  const text = e instanceof Error ? e.message : String(e);
  return status === 429 || status === 500 || status === 503 || /429|rate limit|overloaded|unavailable/i.test(text);
}

/**
 * Ask Gemini what `image` shows. Throws on network/API failure so the caller
 * can refuse the upload rather than let an unchecked photo through.
 */
export async function classifyListingPhoto(image: PhotoBytes, label: PhotoRoom): Promise<PhotoVerdict> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const ask = () =>
    ai.models.generateContent({
      model: PHOTO_CHECK_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { data: image.base64, mimeType: image.mimeType } },
            { text: `The uploader tagged this photo as: ${photoRoomLabel(label)}.` },
          ],
        },
      ],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema,
        // The judgement is a description, not a creative task.
        temperature: 0,
        maxOutputTokens: 2048,
      },
    });

  let response;
  try {
    response = await ask();
  } catch (e) {
    if (!isTransient(e)) throw e;
    await new Promise((r) => setTimeout(r, 1200));
    response = await ask();
  }

  // A safety block means the picture is not something we want on a listing anyway.
  if (response.promptFeedback?.blockReason) {
    return { subject: "not_apartment", reason: "This photo can't be used on a listing." };
  }

  const text = response.text?.trim();
  if (!text) throw new Error("Photo check returned an empty answer.");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("Photo check returned an unexpected answer.");
  }
  const parsed = verdictSchema.safeParse(json);
  if (!parsed.success) throw new Error("Photo check returned an unexpected answer.");
  return parsed.data;
}

const INLINE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Read an already-stored photo back into bytes, for the two callers that only
 * have a URL: re-tagging a photo saved before the check existed, and
 * `npm run check:photos`.
 */
export async function fetchPhotoBytes(url: string): Promise<PhotoBytes> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not read the photo (${res.status}).`);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.byteLength > MAX_IMAGE_BYTES) throw new Error("That photo is too large to check.");
  const mimeType = (res.headers.get("content-type") ?? "").split(";")[0].trim();
  if (!INLINE_TYPES.has(mimeType)) throw new Error("Only JPG, PNG or WebP photos can be checked.");
  return { base64: buffer.toString("base64"), mimeType };
}
