import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { getAuthContext, getOwnProfile } from "@/lib/auth";
import { EmptyState } from "@/components/ui/EmptyState";
import { MessageComposer } from "@/components/chat/MessageComposer";
import type { Conversation, Listing, Message } from "@/lib/types";

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

  const { data: listingData } = await supabase
    .from("listings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  const listing = listingData as Listing | null;
  if (!listing) notFound();

  if (listing.owner_id === user.id) {
    return (
      <main className="px-5 pb-16">
        <EmptyState
          title="This is your listing"
          hint="Messages from interested seekers will land in your inbox soon."
        />
      </main>
    );
  }

  // Load or lazily create the conversation; a concurrent request may win the
  // unique (listing_id, seeker_id) race, so fall back to re-reading.
  let conversation: Conversation | null = null;
  const { data: existing } = await supabase
    .from("conversations")
    .select("*")
    .eq("listing_id", listing.id)
    .eq("seeker_id", user.id)
    .maybeSingle();
  conversation = existing as Conversation | null;
  if (!conversation) {
    const { data: created, error: insertError } = await supabase
      .from("conversations")
      .insert({ listing_id: listing.id, seeker_id: user.id })
      .select()
      .single();
    if (insertError) {
      const { data: raced } = await supabase
        .from("conversations")
        .select("*")
        .eq("listing_id", listing.id)
        .eq("seeker_id", user.id)
        .maybeSingle();
      conversation = raced as Conversation | null;
    } else {
      conversation = created as Conversation;
    }
  }
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

  const { data: messageData } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true });
  const messages = (messageData as Message[] | null) ?? [];

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 sm:px-6">
      <Link href={`/browse/${listing.id}`} className="text-sm text-muted hover:text-ink">
        ← Back to listing
      </Link>

      <div className="mt-3 flex items-center gap-3 rounded-2xl border border-hairline bg-surface p-3">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-hairline">
          {listing.photo_urls[0] ? (
            <Image src={listing.photo_urls[0]} alt="" fill sizes="56px" className="object-cover" />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-lg font-semibold">{listing.title}</p>
          <p className="text-sm text-muted">
            ₪{listing.rent.toLocaleString()} / mo · {listing.city}
          </p>
        </div>
      </div>
      <h1 className="sr-only">Chat about {listing.title}</h1>

      <section aria-label="Messages" className="mt-5 flex flex-col gap-3">
        {messages.length === 0 ? (
          <div className="rounded-2xl border border-hairline bg-surface px-6 py-10 text-center">
            <p className="font-serif text-xl font-semibold">Say hello</p>
            <p className="mt-1 text-sm text-muted">
              Ask about the room, the flatmates, or the move-in date.
            </p>
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === user.id;
            return (
              <div key={m.id} className={`max-w-[75%] ${mine ? "self-end" : "self-start"}`}>
                <div
                  className={
                    mine
                      ? "rounded-2xl rounded-br-md border border-accent/20 bg-accent/10 px-4 py-2.5 text-sm"
                      : "rounded-2xl rounded-bl-md border border-hairline bg-surface px-4 py-2.5 text-sm"
                  }
                >
                  <p className="whitespace-pre-line break-words">{m.content}</p>
                </div>
                <p className={`mt-1 text-xs text-muted ${mine ? "text-right" : ""}`}>
                  {new Date(m.created_at).toLocaleString("en-GB", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            );
          })
        )}
      </section>

      <MessageComposer conversationId={conversation.id} listingId={listing.id} />
    </main>
  );
}
