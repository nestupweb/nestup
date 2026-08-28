import { NextResponse, type NextRequest } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { respondToInvite } from "@/lib/invites";

/**
 * PATCH /api/invites/:id → { "status": "accepted" | "declined" }
 *
 * The Yes/No on one co-poster invitation. A wrapper over
 * `respond_to_listing_invite` (migration 0032): that function checks the
 * caller is the invitee and that the invitation is still unanswered, writes
 * the answer and the `listing_residents` row in one transaction, and returns
 * 409 through here if someone answers twice.
 *
 * PATCH rather than POST because this changes the state of a resource that
 * already exists — the invitation was created when the listing was published.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await getAuthContext();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const next = (body as { status?: unknown })?.status;
  if (next !== "accepted" && next !== "declined") {
    return NextResponse.json({ error: 'Expected `status` to be "accepted" or "declined".' }, { status: 400 });
  }

  const { listingId, error, status } = await respondToInvite(supabase, id, next === "accepted");
  if (error) return NextResponse.json({ error }, { status: status ?? 400 });

  return NextResponse.json({ id, status: next, listing_id: listingId });
}
