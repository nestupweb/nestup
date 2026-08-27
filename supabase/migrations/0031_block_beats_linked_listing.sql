-- 0031: a block (and a suspension) beats the "linked to this room" exception.
--
-- Found by probing the live database rather than reading the code: after
-- blocking, the blocked member's room was still visible to the blocker, while
-- the blocker's rooms had correctly vanished for the other side. The asymmetry
-- came from migration 0027, which added a SECOND permissive SELECT policy on
-- listings — `linked_to_listing(id)`, so a chat about a room outlives the room.
-- Permissive policies are OR'd, so anyone holding that link kept reading the
-- room no matter what 0030 said. The blocker had an old conversation about it;
-- the blocked side had none, hence one direction working and the other not.
--
-- The exception is still worth having, so it is narrowed rather than dropped:
--   * a suspended owner's room is never readable through it — suspension is the
--     platform removing someone, and it has to be absolute;
--   * a block hides it too, EXCEPT for a room you actually live in: blocking a
--     roommate must not blind you to your own home.

drop policy if exists "members linked to a room keep reading it" on public.listings;
create policy "members linked to a room keep reading it"
  on public.listings for select to authenticated
  using (
    public.linked_to_listing(id)
    and not public.is_suspended(owner_id)
    and (
      exists (
        select 1 from public.listing_residents r
        where r.listing_id = id and r.resident_id = (select auth.uid())
      )
      or not public.is_blocked((select auth.uid()), owner_id)
    )
  );
