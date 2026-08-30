import { notFound, redirect } from "next/navigation";
import { getAuthContext, getOwnProfile } from "@/lib/auth";
import { findOrCreateConversation } from "@/lib/chat";
import { EmptyState } from "@/components/ui/EmptyState";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

/**
 * "Message the owner" entry point. Resolves (or starts) the seeker's thread for
 * this listing and hands off to the inbox at /chat/[conversationId].
 */
export default async function ListingChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, user } = await getAuthContext();
  if (!user) redirect(`/login?next=/browse/${id}/chat`);

  const { profile } = await getOwnProfile();
  if (!profile) redirect(`/profile?onboarding=1&next=/browse/${id}/chat`);

  const { data } = await supabase.from("listings").select("id, owner_id").eq("id", id).is("removed_at", null).maybeSingle();
  const listing = data as { id: string; owner_id: string } | null;
  if (!listing) notFound();
  if (listing.owner_id === user.id) redirect("/chat");

  const conversation = await findOrCreateConversation(supabase, listing.id, user.id);
  if (!conversation) {
    // Insert is RLS-blocked for paused listings — nothing to chat about.
    return (
      <main className="px-5 pb-16">
        <EmptyState
          title="This listing isn't taking messages"
          hint="It may have been paused by the owner. Browse other rooms in the meantime."
        />
      </main>
    );
  }
  redirect(`/chat/${conversation.id}`);
}
