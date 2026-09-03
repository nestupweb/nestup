-- The Chat tab's badge counts CHATS, not messages (user, 2026-09-03).
--
-- `count(*)` made the pill read "3" for one conversation holding three unread
-- messages, which reads as three people waiting rather than one. What a member
-- wants off that badge is how many threads need opening, so the only change is
-- `count(distinct c.id)`.
--
-- The name stays `my_unread_count` on purpose: it is the RPC `getUnreadCount`
-- in lib/chat.ts already calls, and renaming it would open a window where the
-- deployed build asks for a function that no longer exists. What it counts is
-- documented here and in the `comment on function` below.
create or replace function public.my_unread_count()
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
  select count(distinct c.id)
  from public.messages m
  join public.conversations c on c.id = m.conversation_id
  join public.listings l on l.id = c.listing_id
  left join public.conversation_reads r on r.conversation_id = c.id and r.user_id = auth.uid()
  left join public.conversation_deletes d on d.conversation_id = c.id and d.user_id = auth.uid()
  where (c.seeker_id = auth.uid() or public.is_household_member(l.id))
    and m.sender_id <> auth.uid()
    and m.created_at > greatest(
      coalesce(r.last_read_at, 'epoch'::timestamptz),
      coalesce(d.cleared_at, 'epoch'::timestamptz)
    );
$$;

comment on function public.my_unread_count() is
  'Number of conversations holding at least one unread message for the caller. Counts chats, not messages (0044).';
