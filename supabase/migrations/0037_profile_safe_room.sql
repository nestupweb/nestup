-- What mamad (safe room) a member is looking for.
--
-- The seeker's side of listings.safe_room. Three values rather than that
-- column's three: "any" is no preference at all, "has" is one anywhere in the
-- building, "apartment" is inside the flat itself. Nobody searches for a room
-- without a mamad, so "none" has no twin here.
alter table public.profiles
  add column if not exists pref_safe_room text not null default 'any'
    check (pref_safe_room in ('any', 'has', 'apartment'));

comment on column public.profiles.pref_safe_room is
  'Mamad this member is looking for (lib/constants PREF_SAFE_ROOMS); any = no preference, has = anywhere in the building.';
