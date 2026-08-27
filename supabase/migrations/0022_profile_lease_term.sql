-- 0022: "For how long" on the seeker side. The listing says how long the room
-- is offered for (0021, `listings.lease_term`); this is the matching wish on
-- the profile — how long the member wants to rent — set under Apartment
-- preferences on the profile form. 'any' = no preference (the default), so the
-- ADD COLUMN rewrites nothing and existing members read as "no preference".
alter table public.profiles
  add column if not exists pref_lease_term text not null default 'any'
    check (pref_lease_term in ('any', 'flexible', 'month', 'two_months', 'three_months', 'half_year', 'year', 'two_years', 'long_term'));

comment on column public.profiles.pref_lease_term is 'How long this member wants to rent for (lib/constants PREF_LEASE_TERMS); any = no preference.';
