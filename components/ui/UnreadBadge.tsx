import { getUnreadCount } from "@/lib/chat";

/**
 * The unread pill on the Chat tab, as its own async server component so the
 * layouts can drop it into `<BottomNav unreadSlot>` behind a `<Suspense>`.
 *
 * Why it is split out at all: both layouts used to `await getUnreadCount()`
 * before returning any markup, which held the header, the nav and the page
 * itself behind an extra `my_unread_count` round-trip on every signed-in
 * navigation. Nothing above the badge needs the number, so only the badge
 * waits for it now.
 */
export async function UnreadBadge() {
  const unread = await getUnreadCount();
  if (unread <= 0) return null;

  return (
    <span
      aria-label={`${unread} unread`}
      className="absolute right-2.5 top-1 min-w-[1.15rem] rounded-full bg-accent px-1 text-center text-[11px] font-bold leading-[1.15rem] tracking-normal text-accent-contrast"
    >
      {unread > 99 ? "99+" : unread}
    </span>
  );
}
