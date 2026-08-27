-- 0029: reporting, blocking and automatic suspension (2026-08-27).
--
-- Three related pieces, all enforced here rather than in the UI:
--   * blocks     — symmetric hiding between two members, owner-managed;
--   * reports    — one per reporter per subject, so a single member can never
--                  push someone past the threshold on their own;
--   * suspensions— written ONLY by the trigger below. It is deliberately not a
--                  column on `profiles`: 0001 lets a member update their own
--                  profile row, so a suspension stored there could be cleared
--                  with one PostgREST PATCH. This table has no insert/update/
--                  delete policy at all, so nothing but security-definer code
--                  can write it.

-- ===================== configuration =====================
-- The report threshold is a row, not a constant, so it can be tuned without a
-- deploy. No RLS policies → unreachable from the API; only the definer trigger
-- below reads it.
create table if not exists public.app_config (
  key text primary key,
  value integer not null,
  updated_at timestamptz not null default now()
);
alter table public.app_config enable row level security;

insert into public.app_config (key, value)
values ('report_suspend_threshold', 3)
on conflict (key) do nothing;

comment on table public.app_config is 'Server-side knobs. No RLS policies: security-definer functions only.';

-- ===================== blocks =====================
create table if not exists public.blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);
alter table public.blocks enable row level security;
create index if not exists blocks_blocked_idx on public.blocks (blocked_id);

-- A member sees, makes and undoes only their own blocks. The person on the
-- receiving end is never told directly.
create policy "read your own blocks" on public.blocks for select to authenticated
  using ((select auth.uid()) = blocker_id);
create policy "block as yourself" on public.blocks for insert to authenticated
  with check ((select auth.uid()) = blocker_id);
create policy "undo your own block" on public.blocks for delete to authenticated
  using ((select auth.uid()) = blocker_id);

-- Blocking hides in both directions, so the blocked side needs to know which
-- ids to leave out without being allowed to read the rows. Returns the union of
-- both directions and never says which way round it was.
create or replace function public.blocked_user_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select blocked_id from public.blocks where blocker_id = (select auth.uid())
  union
  select blocker_id from public.blocks where blocked_id = (select auth.uid())
$$;
revoke all on function public.blocked_user_ids() from public, anon;
grant execute on function public.blocked_user_ids() to authenticated;

create or replace function public.is_blocked(a uuid, b uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  );
$$;
revoke all on function public.is_blocked(uuid, uuid) from public, anon;
grant execute on function public.is_blocked(uuid, uuid) to authenticated;

-- ===================== suspensions =====================
create table if not exists public.suspensions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  suspended_at timestamptz not null default now(),
  reason text not null
);
alter table public.suspensions enable row level security;

-- Read-only, and only about yourself: the sign-in path needs to know, and the
-- member is entitled to be told. No write policy exists on purpose.
create policy "see your own suspension" on public.suspensions for select to authenticated
  using ((select auth.uid()) = user_id);

comment on table public.suspensions is
  'Written only by public.apply_report_suspension(). No write policy — a member cannot lift their own suspension.';

create or replace function public.is_suspended(p_user uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.suspensions where user_id = p_user);
$$;
revoke all on function public.is_suspended(uuid) from public, anon;
grant execute on function public.is_suspended(uuid) to authenticated;

-- ===================== reports =====================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'report_reason') then
    create type public.report_reason as enum (
      'harassment', 'spam', 'fake_profile', 'inappropriate_behavior', 'inappropriate_images'
    );
  end if;
end
$$;

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_id uuid not null references auth.users(id) on delete cascade,
  reason public.report_reason not null,
  details text,
  created_at timestamptz not null default now(),
  -- The whole point of the threshold: one member, one report, one vote.
  unique (reporter_id, reported_id),
  constraint reports_not_self check (reporter_id <> reported_id),
  constraint reports_details_len check (details is null or char_length(details) <= 1000)
);
alter table public.reports enable row level security;
create index if not exists reports_reported_idx on public.reports (reported_id);

create policy "report as yourself" on public.reports for insert to authenticated
  with check ((select auth.uid()) = reporter_id and not public.is_suspended((select auth.uid())));
create policy "read back your own reports" on public.reports for select to authenticated
  using ((select auth.uid()) = reporter_id);
-- No update or delete policy: a report cannot be edited away or withdrawn, so
-- the count the threshold is measured against can only ever grow.

-- ===================== the suspension rule =====================
-- Runs inside the reporter's insert but with definer rights, because the
-- reporter has no business writing to `suspensions`. Two ways to trip it:
-- a report of inappropriate images (immediate, regardless of the count), or
-- reaching the configured number of DISTINCT reporters.
create or replace function public.apply_report_suspension()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  threshold integer;
  reporters integer;
  why text;
begin
  select value into threshold from public.app_config where key = 'report_suspend_threshold';
  threshold := coalesce(threshold, 3);

  -- `unique (reporter_id, reported_id)` means this is a count of people, not
  -- of reports, so repeat reports from one member cannot move it.
  select count(*) into reporters from public.reports where reported_id = new.reported_id;

  if new.reason = 'inappropriate_images' then
    why := 'inappropriate_images';
  elsif reporters >= threshold then
    why := 'report_threshold';
  else
    return new;
  end if;

  insert into public.suspensions (user_id, reason)
  values (new.reported_id, why)
  on conflict (user_id) do nothing;   -- the first reason on the record stays

  return new;
end;
$$;

drop trigger if exists reports_apply_suspension on public.reports;
create trigger reports_apply_suspension
  after insert on public.reports
  for each row execute function public.apply_report_suspension();

-- ===================== blocking stops messaging =====================
-- True when the caller and anyone else in the conversation have blocked each
-- other. Household threads carry more than two people, so a block anywhere in
-- the thread closes it for the blocking pair rather than only for a 1:1 chat.
create or replace function public.conversation_has_block(p_conversation uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.conversations c
    cross join lateral (
      select c.seeker_id as uid
      union
      select l.owner_id from public.listings l where l.id = c.listing_id
      union
      select r.resident_id from public.listing_residents r where r.listing_id = c.listing_id
    ) p
    where c.id = p_conversation
      and p.uid is not null
      and p.uid <> (select auth.uid())
      and public.is_blocked((select auth.uid()), p.uid)
  );
$$;
revoke all on function public.conversation_has_block(uuid) from public, anon;
grant execute on function public.conversation_has_block(uuid) to authenticated;

-- Sending: unchanged membership rule, plus "not blocked" and "not suspended".
drop policy if exists "participants send conversation messages" on public.messages;
create policy "participants send conversation messages" on public.messages for insert to authenticated
  with check (
    (select auth.uid()) = sender_id
    and exists (select 1 from public.conversations c where c.id = conversation_id)
    and not public.conversation_has_block(conversation_id)
    and not public.is_suspended((select auth.uid()))
  );

-- Starting a new thread with someone you have blocked (or who blocked you).
drop policy if exists "seekers start conversations" on public.conversations;
create policy "seekers start conversations" on public.conversations for insert to authenticated
  with check (
    (select auth.uid()) = seeker_id
    and not public.is_suspended((select auth.uid()))
    and exists (
      select 1 from public.listings l
      where l.id = listing_id
        and l.is_active
        and l.owner_id <> (select auth.uid())
        and not public.is_blocked((select auth.uid()), l.owner_id)
    )
  );

-- ===================== a suspended member stops acting =====================
-- The app signs them out, but the API is reachable without the app, so the
-- write paths that create content are closed here too.
drop policy if exists "seekers insert their own swipes" on public.swipes;
create policy "seekers insert their own swipes" on public.swipes for insert to authenticated
  with check (seeker_id = (select auth.uid()) and not public.is_suspended((select auth.uid())));

drop policy if exists "owners insert their own listing" on public.listings;
create policy "owners insert their own listing" on public.listings for insert to authenticated
  with check (owner_id = (select auth.uid()) and not public.is_suspended((select auth.uid())));

drop policy if exists "owners update their own listing" on public.listings;
create policy "owners update their own listing" on public.listings for update to authenticated
  using (owner_id = (select auth.uid()) and not public.is_suspended((select auth.uid())));
