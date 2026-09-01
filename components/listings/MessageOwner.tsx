"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { IntroDialog } from "@/components/chat/IntroDialog";
import type { Profile } from "@/lib/types";

/**
 * "Message the owner", from the listing page.
 *
 * It used to be a link straight to `/browse/[id]/chat`, which opened a thread
 * — creating the conversation — before the seeker had written a word. Now it
 * opens the same sheet the deck uses after a like (`IntroDialog`): the hello
 * is there to edit, Send posts it and moves on to the conversation, and Cancel
 * leaves nothing behind, because nothing was created yet.
 *
 * Not a like, so nothing here claims one — no "You liked this room" line.
 */
export function MessageOwner({
  listingId,
  household,
  template = "",
}: {
  listingId: string;
  /** The household the message reaches, owner first. */
  household: Profile[];
  /** The seeker's saved default hello, "" for the built-in text. */
  template?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);
  // The sheet keeps its "Message sent" state on screen while this runs, so the
  // send never looks like it did nothing on a slow navigation.
  const goToConversation = useCallback(
    (conversationId: string) => router.push(`/chat/${conversationId}`),
    [router]
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block w-full rounded-xl bg-accent py-3 text-center text-sm font-semibold text-accent-contrast"
      >
        Message the owner
      </button>
      {open ? (
        <IntroDialog
          listingId={listingId}
          household={household}
          template={template}
          title="Message the roommates"
          sendLabel="Send"
          cancelLabel="Cancel"
          onClose={close}
          onSent={goToConversation}
        />
      ) : null}
    </>
  );
}
