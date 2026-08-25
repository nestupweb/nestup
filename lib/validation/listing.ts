import { z } from "zod";
import { CITIES, PHOTO_ROOMS, PROPERTY_TYPES, SAFE_ROOM_OPTIONS } from "@/lib/constants";
import type { PhotoRoom, PropertyType, SafeRoom } from "@/lib/types";

const propertyTypeKeys = PROPERTY_TYPES.map((p) => p.key) as [PropertyType, ...PropertyType[]];
const safeRoomKeys = SAFE_ROOM_OPTIONS.map((o) => o.key) as [SafeRoom, ...SafeRoom[]];
const photoRoomKeys = PHOTO_ROOMS.map((r) => r.key) as [PhotoRoom, ...PhotoRoom[]];

export const listingSchema = z.object({
  description: z.string().trim().max(2000).default(""),
  city: z.enum(CITIES, { error: "Pick a city from the list." }),
  neighborhood: z.string().trim().max(80).default(""),
  street: z.string().trim().min(2, "Street is required.").max(80),
  house_number: z.string().trim().min(1, "House number is required.").max(10),
  rent: z.coerce.number().int().positive(),
  available_from: z.iso.date(),
  property_type: z.enum(propertyTypeKeys).default("apartment"),
  rooms: z.coerce.number().min(1).max(12).multipleOf(0.5).default(3),
  size_sqm: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    z.coerce.number().int().min(10).max(1000).nullable()
  ).default(null),
  roommates_count: z.coerce.number().int().min(0).max(10),
  pets_allowed: z.coerce.boolean().default(false),
  smoking_allowed: z.coerce.boolean().default(false),
  balcony: z.coerce.boolean().default(false),
  air_conditioning: z.coerce.boolean().default(false),
  parking: z.coerce.boolean().default(false),
  elevator: z.coerce.boolean().default(false),
  furnished: z.coerce.boolean().default(false),
  safe_room: z.enum(safeRoomKeys).default("none"),
  food_restrictions: z.string().trim().max(200).default(""),
});

export type ListingInput = z.infer<typeof listingSchema>;

export const photoRoomSchema = z.enum(photoRoomKeys).catch("other");

/** Rooms every listing must show — the deck is a photo story, so no guessing. */
export const REQUIRED_PHOTO_ROOMS: readonly PhotoRoom[] = ["living_room", "bedroom", "bathroom"];

/** Null when the labelled set covers the required rooms; else a readable error. */
export function missingPhotoRooms(labels: readonly string[]): PhotoRoom[] {
  const have = new Set(labels);
  return REQUIRED_PHOTO_ROOMS.filter((r) => !have.has(r));
}
