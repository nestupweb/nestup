import { NextResponse, type NextRequest } from "next/server";
import { listingFiltersSchema } from "@/lib/validation/filters";
import { queryListings } from "@/lib/listings";

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const filters = listingFiltersSchema.parse(params); // .catch() defaults make this total
  const { listings, total } = await queryListings(filters);
  return NextResponse.json({
    listings,
    total,
    page: filters.page,
    page_size: filters.page_size,
  });
}
