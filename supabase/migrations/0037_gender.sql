-- 0037: gender, the preference, and the household it implies (2026-08-29).
--
-- Four options everywhere, no free text: the enum is the single definition the
-- profile form, the listing form and both filters all read.
create type public.gender as enum ('male', 'female', 'other', 'prefer_not_to_say');

-- Nullable on purpose: "not answered" is not one of the four. It is what every
-- existing member has until they choose, and what a real member keeps if they
-- never do.
alter table public.profiles add column if not exists gender public.gender;

-- The right-hand column of Daily life, and the only row there that is a
-- checkbox: unticked is a complete answer, so this one is not part of
-- `isDailyLifeComplete` and never holds the swipe deck shut.
alter table public.profiles
  add column if not exists pref_same_gender boolean not null default false;

-- The listing's own requirement. NULL = open to anyone, which is the default
-- and stays the default.
alter table public.listings add column if not exists wanted_gender public.gender;

/*
 * `household_gender` is the whole point of the filters: "all the roommates are
 * the same gender" is otherwise a question about a set of profiles, one
 * subquery per listing, which neither PostgREST's filter syntax nor an index
 * can express. Here it is one column, one equality, one index.
 *
 * It is the gender every household member shares, or NULL — and NULL covers
 * two different "no": a mixed household, and one where somebody has not said.
 * Both are correct answers to "are they all the same gender?": we cannot claim
 * they are, so a strict filter must leave the room out.
 *
 * The household is the owner plus every confirmed resident (0032/0033) — the
 * same set the co-poster feature calls a household.
 */
create or replace function public.household_gender_of(p_listing uuid)
returns public.gender
language sql
stable
security definer
set search_path = ''
as $$
  with members as (
    select l.owner_id as uid from public.listings l where l.id = p_listing
    union
    select r.resident_id from public.listing_residents r where r.listing_id = p_listing
  )
  select case when count(*) > 0
               and count(*) filter (where p.gender is null) = 0
               and count(distinct p.gender) = 1
              then min(p.gender)
         end
    from members m
    join public.profiles p on p.user_id = m.uid;
$$;

alter table public.listings add column if not exists household_gender public.gender;

comment on column public.listings.household_gender is
  'Derived (0037): the gender every household member shares, or NULL when they differ or someone has not said. Maintained by trigger — never write it by hand.';

create or replace function public.refresh_household_gender(p_listing uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.listings
     set household_gender = public.household_gender_of(p_listing)
   where id = p_listing;
$$;

-- Three things can change the answer: who owns the room, who lives in it, and
-- what one of those people says their gender is.
create or replace function public.tg_listing_household_gender()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.refresh_household_gender(new.id);
  return null;
end;
$$;

create or replace function public.tg_resident_household_gender()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.refresh_household_gender(coalesce(new.listing_id, old.listing_id));
  return null;
end;
$$;

create or replace function public.tg_profile_household_gender()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_listing uuid;
begin
  for v_listing in
    select l.id from public.listings l where l.owner_id = new.user_id
    union
    select r.listing_id from public.listing_residents r where r.resident_id = new.user_id
  loop
    perform public.refresh_household_gender(v_listing);
  end loop;
  return null;
end;
$$;

-- `of owner_id` matters: without it the UPDATE inside the trigger would fire
-- the trigger again.
drop trigger if exists listings_household_gender on public.listings;
create trigger listings_household_gender
  after insert or update of owner_id on public.listings
  for each row execute function public.tg_listing_household_gender();

drop trigger if exists residents_household_gender on public.listing_residents;
create trigger residents_household_gender
  after insert or delete on public.listing_residents
  for each row execute function public.tg_resident_household_gender();

drop trigger if exists profiles_household_gender on public.profiles;
create trigger profiles_household_gender
  after update of gender on public.profiles
  for each row execute function public.tg_profile_household_gender();

-- Existing rooms get their answer now rather than at their next edit.
update public.listings set household_gender = public.household_gender_of(id);

create index if not exists listings_household_gender_idx
  on public.listings (household_gender) where removed_at is null;
create index if not exists listings_wanted_gender_idx
  on public.listings (wanted_gender) where removed_at is null;
