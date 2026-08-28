-- 0035: attention-based personalisation for the swipe deck (2026-08-28).
--
-- The deck is ranked by compatibility alone (`sortKey`, lib/compatibility.ts).
-- This adds a second, much weaker signal: how much attention a seeker actually
-- paid to each room. Rooms resembling the ones they lingered on move earlier in
-- the remaining queue.
--
-- What this table is NOT: an event stream. One row per (seeker, room), upserted
-- with the strongest reading so far. That makes duplicate events impossible by
-- construction — the same guarantee `listing_views` (0007) gets from its
-- composite primary key — and keeps the stored data to an aggregate.
--
-- PRIVACY, and the reason this table looks different from `swipes`:
-- `swipes` is deliberately readable by the room's owner (0001) — a like is a
-- signal the seeker is choosing to send. Dwell time is not. An owner learning
-- that someone stared at their room for forty seconds is surveillance the
-- seeker never opted into, so there is deliberately NO owner-side select
-- policy here. Only the seeker can read their own attention, and deleting the
-- account takes it with them.
create table public.listing_dwell (
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  -- Active milliseconds only: the client stops the clock when the tab is
  -- hidden, the window loses focus, or the seeker goes idle, and caps a single
  -- card before it is ever sent (see lib/use-dwell.ts). Stored capped as well,
  -- so a forged request cannot outweigh honest ones.
  dwell_ms int not null default 0 check (dwell_ms between 0 and 45000),
  -- Corroboration. Elapsed time alone is a poor interest signal — a seeker may
  -- have been confused, or waiting on a slow photo. Deliberate navigation is
  -- much stronger evidence, so the ranker weighs these alongside the clock.
  photos_seen int not null default 0 check (photos_seen between 0 and 20),
  pages_seen int not null default 0 check (pages_seen between 0 and 10),
  updated_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create index listing_dwell_by_user_idx on public.listing_dwell (user_id, updated_at desc);

alter table public.listing_dwell enable row level security;

create policy "seekers read their own attention" on public.listing_dwell
  for select to authenticated using (user_id = (select auth.uid()));
create policy "seekers record their own attention" on public.listing_dwell
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "seekers refresh their own attention" on public.listing_dwell
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "seekers erase their own attention" on public.listing_dwell
  for delete to authenticated using (user_id = (select auth.uid()));
