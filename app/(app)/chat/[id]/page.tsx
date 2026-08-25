import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getConversations, markConversationRead } from "@/lib/chat";
import { isGoogleConfigured } from "@/lib/google";
import { ChatThread } from "@/components/chat/ChatThread";
import type { Message, Viewing } from "@/lib/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ChatThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ calendar?: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const { calendar } = await searchParams;
  const { supabase, user } = await requireUser();

  // RLS-scoped: only conversations the user participates in come back.
  const conversation = (await getConversations()).find((c) => c.id === id);
  if (!conversation) notFound();

  const [{ data: messageRows }, { data: viewingRows }, { data: googleRow }] = await Promise.all([
    supabase.from("messages").select("*").eq("conversation_id", id).order("created_at", { ascending: true }),
    supabase.from("viewings").select("*").eq("conversation_id", id).order("created_at", { ascending: true }),
    supabase.from("google_tokens").select("email").eq("user_id", user.id).maybeSingle(),
  ]);
  await markConversationRead(supabase, id);

  return (
    <ChatThread
      meId={user.id}
      conversation={conversation}
      messages={(messageRows as Message[] | null) ?? []}
      viewings={(viewingRows as Viewing[] | null) ?? []}
      google={{
        configured: isGoogleConfigured(),
        connected: Boolean(googleRow),
        email: (googleRow as { email: string } | null)?.email ?? "",
      }}
      calendarNotice={typeof calendar === "string" ? calendar : undefined}
    />
  );
}
