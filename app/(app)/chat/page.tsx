// Desktop-only placeholder for the right pane; on phones the layout shows the list instead.
// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { getCachedInbox, visibleConversations } from "@/lib/chat";

export const instant = false;

export default function ChatIndexPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
          <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 3.5V17H6.5A2.5 2.5 0 0 1 4 14.5Z" />
        </svg>
      </span>
      <p className="mt-4 text-2xl font-bold">Your messages</p>
      {/* The line depends on whether the inbox has anything in it, and the shell
          must not wait on that query — it streams in beside the list instead. */}
      <Suspense fallback={<p className="mt-1 h-10 max-w-xs" />}>
        <Hint />
      </Suspense>
    </div>
  );
}

/**
 * "Pick one" once there are chats; how to start one when there are none.
 *
 * Reads the same cached inbox the list beside it does, so the desktop
 * placeholder costs no extra round-trip — it is one `use cache: private` entry
 * answering both.
 */
async function Hint() {
  // `requireUser()` stays here even though the inbox no longer needs it. This
  // route is the one place under /chat with no deeper page to enforce the
  // suspension gate, and that check is deliberately never cached. It costs an
  // uncached read, but it sits behind this component's own `<Suspense>` whose
  // fallback is a blank spacer rather than a skeleton — so it delays one line
  // of text, not the inbox beside it.
  await requireUser();
  const { conversations } = await getCachedInbox();
  const hasChats = visibleConversations(conversations).length > 0;
  return (
    <p className="mt-1 max-w-xs text-sm text-muted">
      {hasChats
        ? "Pick a conversation on the left."
        : "Start a conversation by matching in Swipe or messaging a listing."}
    </p>
  );
}
