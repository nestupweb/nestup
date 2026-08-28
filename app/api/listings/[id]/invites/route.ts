import { NextResponse, type NextRequest } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { getTaggedMembers, inviteRoommates } from "@/lib/invites";

/**
 * REST view of a listing's co-poster invitations.
 *
 *   GET  /api/listings/:id/invites   → who is tagged, and what they answered
 *   POST /api/listings/:id/invites   → { "invitees": [uuid, …] } — set the list
 *
 * Wrappers, nothing more. Who may tag, how many, blocked pairs and un-tagging
 * are all decided by `invite_listing_roommates` (migration 0032) under the
 * caller's own session; these functions only carry the answer out over HTTP.
 * The Server Actions the app itself uses go through the same `lib/invites.ts`,
 * so there is one implementation and these routes cannot drift from it.
 *
 * Authentication is the session cookie, the same one the rest of the app uses:
 * `getAuthContext()` rather than `requireUser()`, because an API route must
 * answer 401 rather than redirect to the sign-in page.
 */

const UNAUTHENTICATED = { error: "Sign in first." };

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await getAuthContext();
  if (!user) return NextResponse.json(UNAUTHENTICATED, { status: 401 });

  // RLS returns rows only to the listing's owner and to each invitee, so an id
  // that isn't the caller's business comes back as an empty list, not a leak.
  return NextResponse.json({ listing_id: id, invitees: await getTaggedMembers(supabase, id) });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await getAuthContext();
  if (!user) return NextResponse.json(UNAUTHENTICATED, { status: 401 });

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const invitees = (body as { invitees?: unknown })?.invitees;
  if (!Array.isArray(invitees)) {
    return NextResponse.json({ error: "Expected `invitees` to be an array of user ids." }, { status: 400 });
  }

  const { pending, error, status } = await inviteRoommates(supabase, id, invitees);
  if (error) return NextResponse.json({ error }, { status: status ?? 400 });

  return NextResponse.json({ listing_id: id, pending, invitees: await getTaggedMembers(supabase, id) });
}
