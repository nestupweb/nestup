-- The extras a member wants in a room: Profile › Apartment preferences › Amenities.
--
-- The seeker's side of the listing's own feature flags, and deliberately the
-- same five keys — a member asking for a balcony and an owner ticking
-- "balcony" have to mean the same thing or the two sides never meet. Pets and
-- smoking are not here: those are house rules, and the profile already asks
-- about both in Daily life.
alter table public.profiles
  add column if not exists pref_amenities text[] not null default '{}'
    check (
      cardinality(pref_amenities) <= 5
      and pref_amenities <@ array['balcony', 'air_conditioning', 'parking', 'elevator', 'furnished']::text[]
    );

comment on column public.profiles.pref_amenities is
  'Amenities this member is looking for (lib/constants PREF_AMENITIES); empty = no preference.';
