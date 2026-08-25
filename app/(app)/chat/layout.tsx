import { requireUser } from "@/lib/auth";
import { getConversations } from "@/lib/chat";
import { ChatRealtime } from "@/components/chat/ChatRealtime";
import { ChatShell } from "@/components/chat/ChatShell";
import { ConversationList } from "@/components/chat/ConversationList";

// Chat is browsable even before the profile exists (WhatsApp-style empty
// inbox); the profile gate lives where a conversation actually starts
// (the listing's "Message the owner" entry point).
export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser();
  const userId = user.id;
  const conversations = await getConversations();

  return (
    <>
      <ChatRealtime />
      <ChatShell list={<ConversationList conversations={conversations} meId={userId} />}>
        {children}
      </ChatShell>
    </>
  );
}
