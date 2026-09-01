import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getConversations } from "@/lib/chat";
import { isGoogleConfigured } from "@/lib/google";
import { ChatThread } from "@/components/chat/ChatThread";
import { renderIntro } from "@/lib/swipe-intro";
import type { Message, Viewing } from "@/lib/types";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** "Nothing was ever deleted here" — matches `coalesce(cleared_at, 'epoch')` in SQL. */
const EPOCH = "1970-01-01T00:00:00Z";

export default async function ChatThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ calendar?: string; intro?: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const { calendar, intro } = await searchParams;
  const { supabase, user } = await requireUser();

  // RLS-scoped: only conversations the user participates in come back.
  const conversation = (await getConversations()).find((c) => c.id === id);
  if (!conversation) notFound();

  // "Delete chat" is a per-member cutoff, not a delete: everything up to it
  // stays in the table and stays readable to the other side, and is filtered
  // out here (the epoch stands in for "never deleted", as it does in the SQL).
  // Re-opening a deleted chat therefore lands on an empty thread.
  const since = conversation.cleared_at ?? EPOCH;

  // A thread opened from a listing's "Message the owner" arrives with ?intro=1.
  // The owner never does (that route sends them to the inbox), so only the
  // seeker's own template is ever loaded here.
  const wantsIntro = intro === "1" && conversation.seeker_id === user.id;

  const [{ data: messageRows }, { data: viewingRows }, { data: googleRow }, { data: introRow }, { data: meRow }] = await Promise.all([
    supabase.from("messages").select("*").eq("conversation_id", id).gt("created_at", since).order("created_at", { ascending: true }),
    supabase.from("viewings").select("*").eq("conversation_id", id).gt("created_at", since).order("created_at", { ascending: true }),
    supabase.from("google_tokens").select("email").eq("user_id", user.id).maybeSingle(),
    wantsIntro
      ? supabase.from("profile_details").select("intro_template").eq("user_id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    // The conversation row describes the other side only, so the viewer's own
    // photo is read here — it is what "You" wears in the viewing participants.
    supabase.from("profiles").select("avatar_url").eq("user_id", user.id).maybeSingle(),
  ]);
  // Marking the thread read is deliberately NOT done here. It is a write, and a
  // render that writes cannot be cached: the write would be skipped on a cache
  // hit (the badge would never clear) or repeated on every replay. `ChatThread`
  // calls `markReadAction` on mount instead, which stamps the read and
  // invalidates the inbox tag.

  // Photos live in a private bucket; hand the client short-lived signed URLs.
  const messages = (messageRows as Message[] | null) ?? [];
  const paths = messages.map((m) => m.image_path).filter((p): p is string => Boolean(p));
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage.from("chat-images").createSignedUrls(paths, 60 * 60);
    const byPath = new Map<string, string>();
    for (const s of signed ?? []) if (s.path && s.signedUrl) byPath.set(s.path, s.signedUrl);
    for (const m of messages) if (m.image_path) m.image_url = byPath.get(m.image_path);
  }

  // Same offer the swipe sheet makes after a like: the seeker's saved hello
  // (or the standard one) sitting in the composer, theirs to edit or replace
  // before it goes. Only on a thread with nothing in it yet — an existing
  // conversation is never overwritten with a canned opener.
  const draft =
    wantsIntro && messages.length === 0
      ? renderIntro(
          (introRow as { intro_template: string } | null)?.intro_template ?? "",
          conversation.other_name ?? ""
        )
      : "";

  return (
    <ChatThread
      meId={user.id}
      meAvatar={(meRow as { avatar_url: string | null } | null)?.avatar_url ?? null}
      conversation={conversation}
      messages={messages}
      viewings={(viewingRows as Viewing[] | null) ?? []}
      google={{
        configured: isGoogleConfigured(),
        connected: Boolean(googleRow),
        email: (googleRow as { email: string } | null)?.email ?? "",
      }}
      calendarNotice={typeof calendar === "string" ? calendar : undefined}
      initialDraft={draft}
    />
  );
}
