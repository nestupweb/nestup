-- 0036: find a roommate by e-mail as well as by name (2026-08-29).
--
-- Two members called "Daniel" and "Daniel Levy", both students, both without a
-- photo, are the same row twice as far as the picker was concerned — there was
-- nothing on screen to tag the right one by. The e-mail address is what tells
-- them apart, so it is now both searchable and returned for display.
--
-- The name still matches anywhere inside it. The e-mail matches from the START
-- of the address only: `%gmail.com%` would otherwise turn the picker into a
-- way of listing every member on a given mail host, and nobody searching for a
-- person they know types the middle of their address.
drop function if exists public.search_available_members(text, uuid, int);

create function public.search_available_members(
  p_query text,
  p_listing uuid default null,
  p_limit int default 8
)
returns table (user_id uuid, full_name text, avatar_url text, occupation text, email text)
language sql
stable
security definer
set search_path = ''
as $$
  with q as (
    -- `%` and `_` are ILIKE wildcards; someone typing them means them
    -- literally, so they are escaped along with the escape character itself.
    select replace(replace(replace(coalesce(p_query, ''), '\', '\'), '%', '\%'), '_', '\_') as term
  )
  select p.user_id, p.full_name, p.avatar_url, p.occupation, u.email::text
    from public.profiles p
    join auth.users u on u.id = p.user_id
   cross join q
   where p.user_id <> (select auth.uid())
     and (p.full_name ilike '%' || q.term || '%' or u.email ilike q.term || '%')
     and not exists (
       select 1 from public.blocks b
        where (b.blocker_id = (select auth.uid()) and b.blocked_id = p.user_id)
           or (b.blocked_id = (select auth.uid()) and b.blocker_id = p.user_id)
     )
     -- One person, one home (0033): a live listing of their own disqualifies…
     and not exists (
       select 1 from public.listings l
        where l.owner_id = p.user_id and l.is_active and l.removed_at is null
     )
     -- …and so does a home they have already confirmed, except this one, or
     -- every roommate who had already joined the room being edited would look
     -- unavailable to it.
     and not exists (
       select 1 from public.listing_residents r
         join public.listings l on l.id = r.listing_id
        where r.resident_id = p.user_id
          and (p_listing is null or r.listing_id <> p_listing)
          and l.is_active and l.removed_at is null
     )
   order by p.full_name
   limit greatest(1, least(coalesce(p_limit, 8), 25));
$$;

comment on function public.search_available_members(text, uuid, int) is
  'Roommate tag picker: name (anywhere) or e-mail (from the start) + not blocked + no home of their own, filtered before the limit so N results means N.';

revoke all on function public.search_available_members(text, uuid, int) from public, anon;
grant execute on function public.search_available_members(text, uuid, int) to authenticated;
