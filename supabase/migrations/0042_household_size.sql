-- 0042: household_size — the roommate count the site actually shows (2026-09-01).
--
-- The bug this closes: a room could print "1 roommate" under House rules while
-- "Who lives here" showed two faces. Two different numbers were being asked two
-- different questions.
--
--   * `roommates_count` is what the CREATOR TYPED in the listing form ("Current
--     roommates"). It is a claim about the flat, made before anyone confirms,
--     and it is what caps the co-poster picker (max_tagged = roommates_count - 1,
--     migration 0032). It stays exactly as it is, and stays the cap's input.
--   * `household_size` is what the site DISPLAYS: how many people the page can
--     actually name — the owner plus every confirmed resident (0032/0033), the
--     same set `household_gender_of` calls a household. One person, one avatar,
--     one number.
--
-- Keeping the shown number in a column, rather than counting residents at
-- render time, is what lets it be right in the two places a subquery per row
-- would hurt most: the /browse cards, and anonymous visitors — RLS hides
-- `listing_residents` from them (0006), so they could never count it themselves,
-- and they are exactly the people who saw the wrong number before.
--
-- Same shape as `household_gender` (0037): a stable function, a column, a
-- refresher, and triggers on the three things that can change the answer.

create or replace function public.household_size_of(p_listing uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from (
    select l.owner_id as uid from public.listings l where l.id = p_listing
    union
    select r.resident_id from public.listing_residents r where r.listing_id = p_listing
  ) members;
$$;

-- Default 1, not 0: a listing always has its owner. A brand-new room shows one
-- face and says "1 roommate" from its first render, before any trigger runs.
alter table public.listings
  add column if not exists household_size int not null default 1;

comment on column public.listings.household_size is
  'Derived (0042): people the listing can name — owner + confirmed residents. This is the number the UI prints as "N roommates"; roommates_count is the creator''s typed claim and only caps the co-poster picker. Maintained by trigger — never write it by hand.';

create or replace function public.refresh_household_size(p_listing uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.listings
     set household_size = public.household_size_of(p_listing)
   where id = p_listing;
$$;

create or replace function public.tg_listing_household_size()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.refresh_household_size(new.id);
  return null;
end;
$$;

create or replace function public.tg_resident_household_size()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.refresh_household_size(coalesce(new.listing_id, old.listing_id));
  return null;
end;
$$;

-- `of owner_id`, exactly as in 0037: without it the UPDATE inside the trigger
-- would fire the trigger again.
drop trigger if exists listings_household_size on public.listings;
create trigger listings_household_size
  after insert or update of owner_id on public.listings
  for each row execute function public.tg_listing_household_size();

drop trigger if exists residents_household_size on public.listing_residents;
create trigger residents_household_size
  after insert or delete on public.listing_residents
  for each row execute function public.tg_resident_household_size();

-- Every existing room gets the right number now, not at its next edit.
update public.listings set household_size = public.household_size_of(id);

-- The "Max roommates" filter moved onto this column, so give it the same
-- partial index the other filtered columns have.
create index if not exists listings_household_size_idx
  on public.listings (household_size) where removed_at is null;
