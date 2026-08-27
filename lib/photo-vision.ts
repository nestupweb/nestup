/**
 * The vision half of the listing-photo check: one look at one photo.
 *
 * Kept apart from `photo-check.ts` (which is `server-only`) so `npm run
 * check:photos` can import it from plain Node. Server code only — importing
 * it from a client component would pull the Anthropic SDK into the browser
 * bundle, and the API key lives on the server.
 */
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { photoRoomLabel } from "@/lib/constants";
import { PHOTO_SUBJECTS, type PhotoSubject } from "@/lib/photo-rules";
import type { PhotoRoom } from "@/lib/types";

export const PHOTO_CHECK_MODEL = "claude-opus-5";

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

Reply with JSON only: {"subject": <one of the values below>, "reason": <one short sentence>}.

subject values:
- living_room — a living room, salon or lounge area: sofa, armchairs, TV, coffee table. In a studio where the sofa area dominates the frame, choose this.
- bedroom — a bedroom; a bed is the main subject.
- bathroom — a bathroom, shower room or toilet.
- kitchen — a kitchen or kitchenette, including a dining corner that is part of it.
- balcony — a balcony, terrace, roof, garden or yard that belongs to a home.
- exterior — the building from outside, its entrance, stairwell, or the street in front of it.
- other_apartment — another part of a home that fits none of the above: a hallway, storage or laundry room, a mamad, a floor plan, an empty room with nothing to identify it, a view from a window.
- not_apartment — anything that is not a photo of a home: people or pets as the subject, food, vehicles, screenshots, documents, memes, landscapes, shops, offices, blank or unreadable images.

The uploader's tag is a hint for genuinely ambiguous frames (a studio with both a bed and a sofa) — never let it override what the photo clearly shows.

reason: one short sentence addressed to the uploader that says what you see, e.g. "A dog on a rug is the subject here, not the room." Do not mention the tag or these rules.`;

/** Ask the vision model what `url` shows. Throws on network/API failure. */
export async function classifyListingPhoto(url: string, label: PhotoRoom): Promise<PhotoVerdict> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: PHOTO_CHECK_MODEL,
    max_tokens: 512,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    output_config: {
      effort: "low",
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            subject: { type: "string", enum: [...PHOTO_SUBJECTS] },
            reason: { type: "string" },
          },
          required: ["subject", "reason"],
          additionalProperties: false,
        },
      },
    },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "url", url } },
          { type: "text", text: `The uploader tagged this photo as: ${photoRoomLabel(label)}.` },
        ],
      },
    ],
  });

  // A safety refusal means the picture is not something we want on a listing anyway.
  if (response.stop_reason === "refusal") {
    return { subject: "not_apartment", reason: "This photo can't be used on a listing." };
  }
  const text = response.content.find((b) => b.type === "text")?.text ?? "";
  const parsed = verdictSchema.safeParse(JSON.parse(text));
  if (!parsed.success) throw new Error("Photo check returned an unexpected answer.");
  return parsed.data;
}
