"use client";

import Image from "next/image";
import Link from "next/link";
import { respondToInviteAction, type InviteAnswerState } from "@/app/actions/co-posters";
import { Avatar } from "@/components/ui/Avatar";
import { useStickyForm } from "@/lib/hooks";
import { invitePrompt, type PendingInvite } from "@/lib/co-posters";

/**
 * "someone added you to a shared listing" — the invitations waiting at the top
 * of My Listings.
 *
 * Nothing about the member has changed yet when this appears: the room is
 * already live for whoever created it, and the only thing pending is whether
 * it also becomes theirs. Yes puts it under their listings and lets them into
 * the room's chats with seekers; No removes the association and leaves the
 * room to its creator and whoever else confirmed.
 */
export function CoPosterInvites({ invites }: { invites: PendingInvite[] }) {
  if (invites.length === 0) return null;
  return (
    <ul className="space-y-3">
      {invites.map((invite) => (
        <li key={invite.id}>
          <InviteCard invite={invite} />
        </li>
      ))}
    </ul>
  );
}

/**
 * One card, one form. Each needs its own action state — a shared one would
 * show a failure on every card at once — so the card, not the list, owns it.
 */
function InviteCard({ invite }: { invite: PendingInvite }) {
  const [state, form, pending] = useStickyForm<InviteAnswerState>(respondToInviteAction, {});
  const { listing, inviter } = invite;
  const photo = listing.photo_urls?.[0] ?? null;

  return (
    <form
      {...form}
      className="rounded-2xl border border-accent/30 bg-accent/5 p-4"
      aria-label={`Invitation from ${inviter.full_name}`}
    >
      <input type="hidden" name="invite_id" value={invite.id} />

      <div className="flex items-start gap-3">
        <Avatar url={inviter.avatar_url} name={inviter.full_name} size={12} />
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-5 text-ink">{invitePrompt(inviter.full_name)}</p>
          <Link
            href={`/browse/${listing.id}`}
            className="mt-1 inline-block truncate text-xs text-muted underline-offset-4 hover:text-accent hover:underline"
          >
            {listing.title} · ₪{listing.rent.toLocaleString()} · {listing.city}
          </Link>
        </div>
        {photo ? (
          <div className="relative hidden h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-hairline sm:block">
            <Image src={photo} alt="" fill sizes="64px" className="object-cover" />
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="submit"
          name="answer"
          value="yes"
          disabled={pending}
          className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-contrast disabled:opacity-60"
        >
          {pending ? "Saving…" : "Yes, join as co-poster"}
        </button>
        <button
          type="submit"
          name="answer"
          value="no"
          disabled={pending}
          className="rounded-full border border-hairline px-5 py-2 text-sm font-semibold text-muted transition-colors hover:border-danger hover:text-danger disabled:opacity-60"
        >
          No, thanks
        </button>
      </div>

      {state.error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
