-- Listing card details: property type, room count (halves allowed), floor area.
-- Constant defaults => metadata-only change, no table rewrite.
alter table public.listings
  add column property_type text not null default 'apartment'
    check (property_type in ('apartment','garden_apartment','penthouse','studio','duplex','private_house')),
  add column rooms numeric(3,1) not null default 3
    check (rooms >= 1 and rooms <= 12),
  add column size_sqm int
    check (size_sqm between 10 and 1000);
