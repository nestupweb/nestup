-- 0040: a shared listing outlives the member who created it (2026-08-29).
--
-- Closing an account used to take the listing with it, because everything
-- cascades from `auth.users` (0001). That was right while a listing belonged to
-- one person. Since 0033 a confirmed roommate co-owns it — they can edit it,
-- pause it and take it down — so deleting the creator's account was quietly
-- deleting a room out from under the people still living in it.
--
-- The rule now: if anyone else is confirmed on the listing, it changes hands
-- instead of dying. One roommate takes it automatically; several, and the
-- member says who; nobody, and it goes as before.
--
-- All of it happens inside `delete_own_account()`, which is one statement from
-- the caller's side and therefore one transaction: the handover and the account
-- deletion either both happen or neither does.

-- ============ 1. the one sanctioned way for a listing to change hands ============
--
-- 0033's trigger is the guard that makes co-ownership safe: without it a
-- co-owner could set `owner_id` to themselves, and RLS would allow it because
-- they are a household member both before and after. That stays true. What is
-- added is a single, transaction-local escape hatch that only the handover
-- below opens — `set_config(..., true)` means it dies with the transaction, and
-- nothing else in the schema ever sets it.
create or replace function public.listings_owner_is_permanent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.owner_id is distinct from old.owner_id
     and coalesce(current_setting('app.owner_handover', true), '') <> 'on' then
    raise exception 'a listing cannot change hands' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- ==================== 2. who could take the listing on ====================
--
-- The confirmed roommates of the caller's own listing, and whether each one
-- could actually hold it. `one_active_listing_per_owner` (0001) is a unique
-- index, so a roommate who already has a live room of their own cannot be
-- handed a second live one — "one person, one home" (0033) makes that rare, but
-- rare is not never, and a unique-violation at delete time would be a dreadful
-- way to find out. They are returned all the same, flagged, so the picker can
-- say why they aren't on offer instead of silently dropping them.
--
-- Definer because it reads `listing_residents` and `profiles` for a listing the
-- caller owns; it answers for the caller only.
create or replace function public.listing_heirs()
returns table (
  resident_id uuid,
  full_name text,
  avatar_url text,
  eligible boolean,
  listing_id uuid,
  listing_title text
)
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select l.id, l.title, l.is_active
      from public.listings l
     where l.owner_id = (select auth.uid())
       and l.removed_at is null
     order by l.created_at desc
     limit 1
  )
  select r.resident_id,
         p.full_name,
         p.avatar_url,
         -- Only a live room can clash with a live room.
         not (mine.is_active and exists (
           select 1 from public.listings o
            where o.owner_id = r.resident_id
              and o.is_active
              and o.removed_at is null
         )) as eligible,
         mine.id,
         mine.title
    from mine
    join public.listing_residents r on r.listing_id = mine.id
    join public.profiles p on p.user_id = r.resident_id
   where r.resident_id <> (select auth.uid())
   order by p.full_name;
$$;

comment on function public.listing_heirs() is
  'Confirmed roommates who could take over the caller''s listing when they close their account, each flagged with whether they can actually hold it.';

revoke all on function public.listing_heirs() from public, anon;
grant execute on function public.listing_heirs() to authenticated;

-- ==================== 3. closing the account, with the handover ====================
--
-- The old signature has to go rather than be overloaded: `delete_own_account()`
-- and `delete_own_account(uuid default null)` would both match a no-argument
-- call and Postgres would refuse it as ambiguous.
drop function if exists public.delete_own_account();

create or replace function public.delete_own_account(p_heir uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_listing uuid;
  v_heirs uuid[];
  v_heir uuid;
begin
  if v_me is null then
    raise exception 'not authenticated';
  end if;

  -- The room this member created and has not taken down. At most one is live
  -- (`one_active_listing_per_owner`); a paused or taken one still belongs to
  -- the household and is still worth handing on.
  select l.id into v_listing
    from public.listings l
   where l.owner_id = v_me
     and l.removed_at is null
   order by l.created_at desc
   limit 1;

  if v_listing is not null then
    -- Only roommates who could actually hold it: see `listing_heirs()`.
    select coalesce(array_agg(h.resident_id order by h.full_name), '{}'::uuid[])
      into v_heirs
      from public.listing_heirs() h
     where h.eligible;

    if cardinality(v_heirs) = 1 then
      -- One roommate: no question to ask, so none is asked.
      v_heir := v_heirs[1];
    elsif cardinality(v_heirs) > 1 then
      if p_heir is null then
        raise exception 'choose who takes over the listing'
          using errcode = 'data_exception', hint = 'pick_heir';
      end if;
      if not (p_heir = any(v_heirs)) then
        raise exception 'that member cannot take over this listing'
          using errcode = 'data_exception', hint = 'bad_heir';
      end if;
      v_heir := p_heir;
    end if;

    if v_heir is not null then
      perform set_config('app.owner_handover', 'on', true);
      update public.listings
         set owner_id = v_heir,
             updated_at = now()
       where id = v_listing;
      -- The creator is never their own resident (0032), so the row that made
      -- them a roommate goes when they become the owner.
      delete from public.listing_residents
       where listing_id = v_listing
         and resident_id = v_heir;
      perform set_config('app.owner_handover', 'off', true);
    end if;
  end if;

  -- Everything else the member is on, including any room they were a roommate
  -- in, goes with the account by cascade (0001). Their own residency rows are
  -- removed here too, explicitly, so the handover above cannot leave the
  -- departing member listed on a room they no longer belong to.
  delete from public.listing_residents where resident_id = v_me;

  delete from auth.users where id = v_me;
end;
$$;

comment on function public.delete_own_account(uuid) is
  'Closes the caller''s account. A listing with confirmed roommates changes hands first — automatically when there is one, to p_heir when there are several — all in the one transaction.';

revoke all on function public.delete_own_account(uuid) from public, anon;
grant execute on function public.delete_own_account(uuid) to authenticated;
