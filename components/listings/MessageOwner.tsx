"use client";

import { useCallback, useState } from "react";
import { IntroDialog } from "@/components/chat/IntroDialog";
import { messageHouseholdLabel } from "@/lib/constants";
import type { Profile } from "@/lib/types";

/**
 * "Message the roommate(s)", from the listing page.
 *
 * It used to be a link straight to `/browse/[id]/chat`, which opened a thread
 * — creating the conversation — before the seeker had written a word. Now it
 * opens the same sheet the deck uses after a like (`IntroDialog`): the hello is
 * there to edit, and Cancel leaves nothing behind because nothing was created
 * yet.
 *
 * Sending does NOT navigate (user decision, 2026-09-01). The seeker was reading
 * this room; the message going out is not a reason to take the room off their
 * screen. The sheet says it went and offers the conversation as a link, so
 * going there stays their choice.
 *
 * Not a like, so nothing here claims one — no "You liked this room" line.
 */
export function MessageOwner({
  listingId,
  household,
  roommatesCount,
  template = "",
}: {
  listingId: string;
  /** The household the message reaches, owner first. */
  household: Profile[];
  /** The listing's `roommates_count`, which decides singular vs plural. */
  roommatesCount: number;
  /** The seeker's saved default hello, "" for the built-in text. */
  template?: string;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const label = messageHouseholdLabel(roommatesCount);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block w-full rounded-xl bg-accent py-3 text-center text-sm font-semibold text-accent-contrast"
      >
        {label}
      </button>
      {open ? (
        <IntroDialog
          listingId={listingId}
          household={household}
          template={template}
          title={label}
          sendLabel="Send"
          cancelLabel="Cancel"
          onClose={close}
        />
      ) : null}
    </>
  );
}
