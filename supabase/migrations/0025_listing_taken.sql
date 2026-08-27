-- 0025: "The room is taken" (2026-08-27). Closing a deal is not the same as
-- pausing a listing: the room comes down AND everyone the owner is talking to
-- hears about it, in the chat they were already using. One timestamp records
-- it, so the notice cannot go out twice and the owner can see when they closed
-- the room; clearing it puts the room back up (a deal can still fall through).

alter table public.listings
  add column if not exists taken_at timestamptz;

comment on column public.listings.taken_at is
  'When the owner marked the room taken. Null = still available. Set by mark_listing_taken(), which also pauses the listing and messages every conversation once.';

-- Pausing the room and telling everyone must be one thing: a half-done version
-- (room still live but everyone told, or room down and nobody told) is worse
-- than either. One statement per transaction, so both happen or neither does.
--
-- SECURITY INVOKER: every write below goes through the caller's own policies —
-- the update through "owners update their listings" (0001), the inserts through
-- "participants send conversation messages" (0004), which an owner satisfies
-- for their own listing's conversations. A member cannot close someone else's
-- room, and cannot use this to write into a conversation that isn't theirs.
--
-- Returns the number of members told, or -1 when there was nothing to do (not
-- the caller's listing, or already marked taken).
create or replace function public.mark_listing_taken(p_listing uuid, p_message text)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_told integer;
begin
  if coalesce(btrim(p_message), '') = '' then
    raise exception 'a message is required';
  end if;

  update public.listings
     set is_active = false,
         taken_at = now(),
         updated_at = now()
   where id = p_listing
     and owner_id = (select auth.uid())
     and taken_at is null;

  if not found then
    return -1;
  end if;

  -- One notice per conversation on this room. `client_id` is filled so the row
  -- looks like every other message (the unique index is per conversation).
  insert into public.messages (conversation_id, sender_id, content, client_id)
  select c.id, (select auth.uid()), btrim(p_message), gen_random_uuid()
    from public.conversations c
   where c.listing_id = p_listing;

  get diagnostics v_told = row_count;
  return v_told;
end;
$$;

revoke all on function public.mark_listing_taken(uuid, text) from public, anon;
grant execute on function public.mark_listing_taken(uuid, text) to authenticated;
