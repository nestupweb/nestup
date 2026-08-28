import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { getPendingInvites } from "@/lib/invites";

/**
 * GET /api/invites → the signed-in member's unanswered co-poster invitations.
 *
 * The read behind the pending cards on My Listings, exposed for the same
 * reason the write is: so the flow can be exercised without the UI. RLS shows
 * a member only their own rows, so there is no id to pass and none to forge.
 */
export async function GET() {
  const { supabase, user } = await getAuthContext();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const invites = await getPendingInvites(supabase, user.id);
  return NextResponse.json({
    invites: invites.map((i) => ({
      id: i.id,
      listing: { id: i.listing.id, title: i.listing.title, city: i.listing.city, rent: i.listing.rent },
      inviter: i.inviter,
    })),
  });
}
