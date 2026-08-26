-- 0021: how long the room is offered for — a rough duration ("half a year",
-- "a year"), never an end date (user decision, 2026-08-26). Shown on the
-- listing page next to the entrance date; set on the listing form.
alter table public.listings
  add column if not exists lease_term text not null default 'flexible'
    check (lease_term in ('flexible', 'month', 'two_months', 'three_months', 'half_year', 'year', 'two_years', 'long_term'));

comment on column public.listings.lease_term is 'Rough rental duration offered (lib/constants LEASE_TERMS); flexible = open-ended.';
