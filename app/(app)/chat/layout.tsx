import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { getConversations, visibleConversations } from "@/lib/chat";
import { ChatRealtime } from "@/components/chat/ChatRealtime";
import { ChatShell } from "@/components/chat/ChatShell";
import { ConversationList } from "@/components/chat/ConversationList";

// Chat is browsable even before the profile exists (WhatsApp-style empty
// inbox); the profile gate lives where a conversation actually starts
// (the listing's "Message the owner" entry point).
//
// Note on caching: the inbox is deliberately NOT wrapped in `use cache`, unlike
// Swipe, Listings and Profile. `ChatRealtime` subscribes to `messages` and
// `viewings` and refreshes this tree whenever anything lands, including
// messages from the other side — and a cached read with a stale window would
// keep serving the old inbox for up to that window, so a message could arrive
// and not appear. In a messaging feature, "always current" beats "instant", so
// the shell streams instead: the chat frame and the list skeleton paint
// immediately and the conversations arrive behind the boundary, always fresh.
export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ChatRealtime />
      <ChatShell
        list={
          <Suspense fallback={<InboxSkeleton />}>
            <Inbox />
          </Suspense>
        }
      >
        {children}
      </ChatShell>
    </>
  );
}

async function Inbox() {
  const { user } = await requireUser();
  const conversations = visibleConversations(await getConversations());
  return <ConversationList conversations={conversations} meId={user.id} />;
}

/** Shaped like the real list, so the swap is a fill rather than a jump. */
function InboxSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading chats">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 sm:px-6">
          <div className="h-12 w-12 shrink-0 animate-pulse rounded-full bg-hairline" />
          <div className="min-w-0 flex-1">
            <div className="h-4 w-2/5 animate-pulse rounded bg-hairline" />
            <div className="mt-2 h-3 w-4/5 animate-pulse rounded bg-hairline" />
          </div>
        </div>
      ))}
    </div>
  );
}
