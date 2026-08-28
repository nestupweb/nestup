-- 0034: find roommates who are actually free (2026-08-28).
--
-- The tag picker used to search profiles by name, take the first few dozen, and
-- then drop everyone who already had a home (0033). That is the wrong order:
-- with 815 of 842 members housed, nearly the whole window was discarded and the
-- member saw two results where the database held four. Over-fetching further
-- only moves the number — the filter has to run *before* the limit.
--
-- So the search becomes one query that knows all three rules at once: the name
-- matches, the member is not blocked in either direction, and the member has no
-- home of their own. Then it takes the first N, and N means what it says.
--
-- SECURITY DEFINER so it can read `blocks` in both directions — a member may
-- only read the rows where they are the blocker (0029) — without ever revealing
-- which way round the block runs. It answers only for the caller: `auth.uid()`
-- is read here, never passed in.
create or replace function public.search_available_members(
  p_query text,
  p_listing uuid default null,
  p_limit int default 8
)
returns table (user_id uuid, full_name text, avatar_url text, occupation text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.user_id, p.full_name, p.avatar_url, p.occupation
    from public.profiles p
   where p.user_id <> (select auth.uid())
     -- `%` and `_` are ILIKE wildcards; someone typing them means them
     -- literally, so they are escaped along with the escape character itself.
     and p.full_name ilike '%' || replace(replace(replace(coalesce(p_query, ''), '\', '\\'), '%', '\%'), '_', '\_') || '%'
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
  'Roommate tag picker: name match + not blocked + no home of their own, filtered before the limit so N results means N.';

revoke all on function public.search_available_members(text, uuid, int) from public, anon;
grant execute on function public.search_available_members(text, uuid, int) to authenticated;

-- The search is a leading-wildcard ILIKE, which no btree index can serve.
-- pg_trgm can, and the profile count only grows.
create extension if not exists pg_trgm;
create index if not exists profiles_full_name_trgm_idx
  on public.profiles using gin (full_name gin_trgm_ops);
