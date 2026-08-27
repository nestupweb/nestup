-- Map coordinates for a room.
--
-- Nullable on purpose: every listing that existed before the map keeps working
-- with no coordinates at all, and the UI falls back to "approximate area, city
-- centre" instead of breaking. Plain columns rather than PostGIS — the map only
-- ever needs point rendering and a bounding box, both of which are two
-- comparisons on these columns.
--
-- `coords_source` records how much to trust the point, and gives the save path
-- its precedence rule: an owner who dragged the pin ('owner') is never
-- overwritten by a later automatic geocode.
--   none      — no coordinates yet
--   city      — geocoding failed or was skipped; this is the city centre
--   geocoded  — looked up from the street address
--   owner     — the owner placed this pin themselves
alter table public.listings
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists coords_source text not null default 'none';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'listings_coords_source_check'
  ) then
    alter table public.listings
      add constraint listings_coords_source_check
      check (coords_source in ('none', 'city', 'geocoded', 'owner'));
  end if;
end $$;

-- Latitude/longitude must be a real point on Earth, or absent together.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'listings_coords_range_check'
  ) then
    alter table public.listings
      add constraint listings_coords_range_check
      check (
        (lat is null and lng is null)
        or (lat between -90 and 90 and lng between -180 and 180)
      );
  end if;
end $$;

comment on column public.listings.lat is 'Latitude of the room, null until geocoded. See coords_source.';
comment on column public.listings.lng is 'Longitude of the room, null until geocoded. See coords_source.';
comment on column public.listings.coords_source is 'none | city | geocoded | owner — owner-placed pins win over geocoding.';
