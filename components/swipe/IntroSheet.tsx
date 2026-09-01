"use client";

import { householdName, IntroDialog } from "@/components/chat/IntroDialog";
import type { DeckEntry } from "@/lib/swipe";

/**
 * The deck's "say hi", appearing the moment a room is liked, over the card.
 * The sheet itself is `IntroDialog` — shared with the listing page's "Message
 * the owner" — and this only supplies the deck's wording and its one rule
 * about what happens next: sending closes the sheet at once, so the card can
 * slide away and the next room arrive. "Not now" does the same without
 * creating anything.
 */
export function IntroSheet({ entry, template = "", onClose }: { entry: DeckEntry; template?: string; onClose: () => void }) {
  const household = [entry.owner, ...entry.residents];
  return (
    <IntroDialog
      listingId={entry.listing.id}
      household={household}
      template={template}
      eyebrow="You liked this room"
      title={`Say hi to ${householdName(household)}?`}
      sendLabel="Send message"
      cancelLabel="Not now"
      onClose={onClose}
      onSent={onClose}
    />
  );
}
