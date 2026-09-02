import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { getCachedConversations, visibleConversations } from "@/lib/chat";
import { ChatRealtime } from "@/components/chat/ChatRealtime";
import { ChatShell } from "@/components/chat/ChatShell";
import { ConversationList } from "@/components/chat/ConversationList";

// Chat is browsable even before the profile exists (WhatsApp-style empty
// inbox); the profile gate lives where a conversation actually starts
// (the listing's "Message the roommate(s)" entry point).
//
// Note on caching: the inbox IS cached now (`getCachedConversations`), which it
// deliberately was not before. The old reasoning was that a stale window could
// hide a message that had just landed, so Chat alone streamed fresh on every
// visit — and paid a skeleton for it on every single tab tap.
//
// The trade was never forced. A stale window only hides a new message if
// nothing tells the cache one arrived, and `ChatRealtime` is subscribed to
// precisely that: it now calls `syncChatAction`, which drops `chatTag` in this
// browser and re-renders. Messages from the other side are covered by the same
// path — that is the case a server action of *this* member's could not reach.
//
// So both halves hold: the list paints from cache the moment the tab is
// tapped, and it is never more than a socket round-trip behind. The Suspense
// boundary stays for the genuine first visit, when there is nothing cached yet.
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
  const conversations = visibleConversations(await getCachedConversations(user.id));
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
