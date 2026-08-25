-- Listing form v2: structured address (city · area · street · number),
-- safe room (mamad), food restrictions, per-photo room labels, 3–10 photos.
-- `address` stays as the display string ("Ahuza 23"), composed by the app
-- from street + house_number.
alter table public.listings
  add column street text not null default '' check (char_length(street) <= 80),
  add column house_number text not null default '' check (char_length(house_number) <= 10),
  add column safe_room text not null default 'none' check (safe_room in ('none', 'apartment', 'building')),
  add column food_restrictions text not null default '' check (char_length(food_restrictions) <= 200),
  add column photo_labels text[] not null default '{}';

alter table public.listings drop constraint listings_photo_urls_check;
alter table public.listings add constraint listings_photo_urls_check
  check (array_length(photo_urls, 1) is null or array_length(photo_urls, 1) <= 10);

-- Backfill street / house number from the free-text address ("Ahuza 23").
update public.listings
set house_number = coalesce(substring(address from '\s(\d+[A-Za-z]?)$'), ''),
    street = coalesce(nullif(trim(regexp_replace(address, '\s\d+[A-Za-z]?$', '')), ''), address)
where address <> '';
