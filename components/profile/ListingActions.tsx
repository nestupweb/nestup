"use client";

import Link from "next/link";
import { useState } from "react";
import { deleteListingAction, type DeleteListingState } from "@/app/actions/listing";
import { PencilIcon } from "@/components/ui/PencilIcon";
import { useStickyForm } from "@/lib/hooks";

const BUTTON =
  "inline-flex items-center gap-2 rounded-full border border-hairline px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-accent hover:text-accent";
const DANGER =
  "inline-flex items-center gap-2 rounded-full border border-danger/40 px-4 py-2 text-sm font-semibold text-danger transition-colors hover:border-danger hover:bg-danger/5";
const CONFIRM =
  "inline-flex items-center gap-2 rounded-full bg-danger px-4 py-2 text-sm font-semibold text-white disabled:opacity-60";

/**
 * The two things an owner does with their room, side by side under the photo
 * grid. Deleting takes the conversations about the room with it (migration
 * 0001 cascades), so it asks once before it happens rather than going straight
 * through on a stray tap.
 */
export function ListingActions({
  listingId,
  editHref,
  children,
}: {
  listingId: string;
  editHref: string;
  /**
   * Somewhere for a further owner action to sit inside the same row (today:
   * "The room is taken"). A slot rather than props, so this file never has to
   * know what that action needs.
   */
  children?: React.ReactNode;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, form, pending] = useStickyForm<DeleteListingState>(deleteListingAction, {});

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={editHref} className={BUTTON}>
          <PencilIcon />
          Edit Listing
        </Link>

        {confirming ? (
          <form {...form} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="listing_id" value={listingId} />
            <button type="submit" disabled={pending} className={CONFIRM}>
              {pending ? "Deleting…" : "Yes, Delete It"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className={BUTTON}>
              Cancel
            </button>
          </form>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className={DANGER}>
            <TrashIcon />
            Delete Listing
          </button>
        )}
        {confirming ? null : children}
      </div>

      {confirming ? (
        <p className="mt-2.5 max-w-prose text-[13px] leading-5 text-muted">
          This removes the room for good, along with the chats about it and anyone&rsquo;s saved copy of it. If the
          room is simply gone, use &ldquo;The room is taken&rdquo; instead &mdash; it tells the people you&rsquo;re
          chatting with and keeps the conversations.
        </p>
      ) : null}

      {state.error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
