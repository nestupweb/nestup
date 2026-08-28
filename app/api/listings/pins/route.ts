import { NextResponse } from "next/server";
import { queryAllListingPins } from "@/lib/listings";

/**
 * Pins for the map dialog. Fetched when the map is first opened rather than
 * shipped with the Listings page: eight hundred pins are worth about 150 KB,
 * and most visits never open the map.
 */
export async function GET() {
  const pins = await queryAllListingPins();
  return NextResponse.json(
    { pins, total: pins.length },
    // The seed set changes when someone lists a room, not by the second.
    { headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=3600" } }
  );
}
