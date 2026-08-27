-- 0030: blocked and suspended members disappear from what other members browse.
--
-- Done in the listings SELECT policy rather than in each query, so Swipe,
-- Browse, recommendations, saved rooms and any future reader all inherit it and
-- none of them can forget. `is_blocked` is symmetric, so the room vanishes for
-- both sides of a block; a suspended host's room vanishes for everyone.
--
-- Signed-out visitors still see the public catalogue: auth.uid() is null for
-- them, is_blocked(null, owner) is false, and only the suspension check bites.
-- Owners keep seeing their own rooms either way (the `owner_id = auth.uid()`
-- arm), so a suspended host can still see what they posted.

drop policy if exists "active listings are public" on public.listings;
create policy "active listings are public"
  on public.listings for select to anon, authenticated
  using (
    owner_id = (select auth.uid())
    or (
      is_active
      and not public.is_suspended(owner_id)
      and not public.is_blocked((select auth.uid()), owner_id)
    )
  );

-- `is_blocked` and `is_suspended` are called from a policy that anon also uses,
-- so anon needs execute on them. Both only ever read moderation state that the
-- policy is about to act on, and neither takes anything from the caller beyond
-- the ids already in the row.
grant execute on function public.is_blocked(uuid, uuid) to anon;
grant execute on function public.is_suspended(uuid) to anon;
