-- 0043: a home cannot hold more roommates than it has bedrooms (2026-09-01).
--
-- The rule (user's): one room is the living room, the rest are bedrooms, so a
-- 5-room flat tops out at 4 roommates. Half rooms round UP — "3.5 rooms" holds
-- 3 — because a half room here is a small bedroom, and because that is the rule
-- every listing's own `roommates_count` already obeyed (0 of 815 conflicted,
-- against 149 under the round-down reading). The floor of 1 is for studios: a
-- 1-room home has no living room to subtract.
--
-- Kept in one SQL expression, `public.max_roommates(rooms)`, so the two check
-- constraints below and lib/constants.ts `maxRoommates` state the same rule.

create or replace function public.max_roommates(p_rooms numeric)
returns integer
language sql
immutable
as $$ select greatest(1, ceil(p_rooms)::int - 1) $$;

-- 154 active rooms had a household bigger than their room count allowed —
-- all of them seeded, none of them possible under the rule. The user chose to
-- keep every resident and enlarge the home rather than drop anybody from
-- "Who lives here" (asked and answered, 2026-09-01), so `rooms` goes up by the
-- whole-number shortfall and the .5 is preserved: a 2.5-room flat housing 3
-- becomes 3.5, not 4.
update public.listings l
   set rooms = l.rooms + (l.household_size + 1 - ceil(l.rooms))
 where l.household_size > public.max_roommates(l.rooms);

-- Same shortfall applied to the creator's typed claim. Nothing matches today —
-- the typed numbers already obey the rule — but the constraint below is only
-- honest if this can never have been skipped.
update public.listings l
   set rooms = l.rooms + (l.roommates_count + 1 - ceil(l.rooms))
 where l.roommates_count > public.max_roommates(l.rooms);

-- Both numbers are now bounded, and stay bounded:
--   * roommates_count is the creator's claim, checked here and in the form.
--   * household_size is trigger-maintained (0042), so this check is what stops
--     a confirmed roommate being added to a home with no bedroom for them —
--     including through the seed, which writes listing_residents directly and
--     never goes near invite_listing_roommates.
alter table public.listings
  drop constraint if exists listings_roommates_fit_rooms;
alter table public.listings
  add constraint listings_roommates_fit_rooms
  check (roommates_count <= public.max_roommates(rooms));

alter table public.listings
  drop constraint if exists listings_household_fits_rooms;
alter table public.listings
  add constraint listings_household_fits_rooms
  check (household_size <= public.max_roommates(rooms));
