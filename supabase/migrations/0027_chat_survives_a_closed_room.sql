-- 0027: a closed room must not take its chats with it (2026-08-27).
--
-- `active listings are public` (0001) reads `is_active or owner_id = auth.uid()`.
-- `my_conversations()` inner-joins listings, so the moment a room came off the
-- site every seeker's chat about it vanished from their inbox — including, from
-- 0025, the message telling them the room was taken. The same already happened
-- to a resident's household chat when the owner paused a listing in Settings.
--
-- The fix is not to weaken the public policy: a paused room still must not turn
-- up in Listings or Swipe for anyone. It is to let the handful of members whose
-- conversations hang off that room keep reading the row itself.
--
-- "Delete chat" (0024) leaves the `conversations` row in place — it only stamps
-- a cutoff — so someone who deleted the chat still counts as linked here and
-- keeps reading the room. That is deliberate: it is what lets the "room is
-- taken" notice arrive after their cutoff and bring the thread back, the way a
-- new message does anywhere else.
--
-- Both EXISTS below hit an existing unique index — `conversations
-- (listing_id, seeker_id)` and `listing_residents (listing_id, resident_id)` —
-- so the extra check per row is an index probe, not a scan.

-- SECURITY DEFINER on purpose, and it is the reason this is a function at all:
-- `conversations` policies read `listings`, so a policy on `listings` that read
-- `conversations` directly would recurse. Definer skips RLS on the two tables
-- below; both branches are pinned to the caller's own id, so it can only ever
-- answer a question about the caller, and it returns a boolean, never a row.
create or replace function public.linked_to_listing(p_listing uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversations c
     where c.listing_id = p_listing and c.seeker_id = (select auth.uid())
  ) or exists (
    select 1 from public.listing_residents r
     where r.listing_id = p_listing and r.resident_id = (select auth.uid())
  );
$$;

comment on function public.linked_to_listing(uuid) is
  'True when the caller is a seeker in a conversation about this room, or lives in it. Used by the listings SELECT policy so a paused or taken room keeps its chats readable.';

revoke all on function public.linked_to_listing(uuid) from public, anon;
grant execute on function public.linked_to_listing(uuid) to authenticated;

-- Additive: policies are OR-ed, so "active listings are public" is untouched
-- and nothing that was hidden becomes public. Browse, Swipe and the people
-- pages all filter `is_active = true` in the query itself, so a taken room
-- still cannot appear in any of them.
drop policy if exists "members linked to a room keep reading it" on public.listings;
create policy "members linked to a room keep reading it"
  on public.listings for select to authenticated
  using (public.linked_to_listing(id));
