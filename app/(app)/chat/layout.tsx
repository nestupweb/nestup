import { requireProfile } from "@/lib/auth";
import { getConversations } from "@/lib/chat";
import { ChatRealtime } from "@/components/chat/ChatRealtime";
import { ChatShell } from "@/components/chat/ChatShell";
import { ConversationList } from "@/components/chat/ConversationList";

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await requireProfile("/chat");
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
