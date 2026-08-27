-- 0028: Delete Listing tells everyone, and stops taking the chats with it
-- (2026-08-27, user-asked).
--
-- Deleting the row cascades to conversations and messages (0001/0004), so a
-- notice sent on the way out was destroyed a moment after it was written and
-- the other side simply watched the thread disappear. The room now leaves the
-- site by being marked removed instead: gone from Listings, Swipe, the owner's
-- profile and its own page, for good and with no way back — but the
-- conversations, and the message explaining why, stay where they are. Nothing a
-- member wrote is ever destroyed by someone else's button.
--
-- `linked_to_listing()` (0027) is what keeps those chats readable: the seekers
-- in them can still read this one row after it leaves the site.

alter table public.listings
  add column if not exists removed_at timestamptz;

comment on column public.listings.removed_at is
  'When the owner deleted the room. Non-null = gone everywhere (every owner-facing query filters it out) while its conversations live on. One-way: nothing clears it.';

-- Same shape and the same guarantees as mark_listing_taken (0025): one
-- transaction, SECURITY INVOKER, so the caller's own policies decide whether
-- the update and the inserts are allowed. Returns how many members were told,
-- -1 when there is nothing to do (not the caller's room, or already removed),
-- and -2 when the room was already marked taken, because everyone was told then
-- and the same sentence twice is spam.
create or replace function public.remove_listing(p_listing uuid, p_message text)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_told integer;
  v_was_taken timestamptz;
begin
  if coalesce(btrim(p_message), '') = '' then
    raise exception 'a message is required';
  end if;

  -- Read before the write: after it, taken_at is set either way.
  select l.taken_at into v_was_taken
    from public.listings l
   where l.id = p_listing
     and l.owner_id = (select auth.uid())
     and l.removed_at is null;

  if not found then
    return -1;
  end if;

  update public.listings l
     set is_active = false,
         removed_at = now(),
         taken_at = coalesce(l.taken_at, now()),
         updated_at = now()
   where l.id = p_listing
     and l.owner_id = (select auth.uid())
     and l.removed_at is null;

  if not found then
    return -1;
  end if;

  if v_was_taken is not null then
    return -2;
  end if;

  insert into public.messages (conversation_id, sender_id, content, client_id)
  select c.id, (select auth.uid()), btrim(p_message), gen_random_uuid()
    from public.conversations c
   where c.listing_id = p_listing;

  get diagnostics v_told = row_count;
  return v_told;
end;
$$;

revoke all on function public.remove_listing(uuid, text) from public, anon;
grant execute on function public.remove_listing(uuid, text) to authenticated;
