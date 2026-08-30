import { requireUser } from "@/lib/auth";
import { getConversations, visibleConversations } from "@/lib/chat";
import { ChatRealtime } from "@/components/chat/ChatRealtime";
import { ChatShell } from "@/components/chat/ChatShell";
import { ConversationList } from "@/components/chat/ConversationList";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

// Chat is browsable even before the profile exists (WhatsApp-style empty
// inbox); the profile gate lives where a conversation actually starts
// (the listing's "Message the owner" entry point).
export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser();
  const userId = user.id;
  const conversations = visibleConversations(await getConversations());

  return (
    <>
      <ChatRealtime />
      <ChatShell list={<ConversationList conversations={conversations} meId={userId} />}>
        {children}
      </ChatShell>
    </>
  );
}
