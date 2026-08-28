-- 0033: confirmed roommates are co-owners, not guests (2026-08-28).
--
-- 0032 let a roommate join a listing but kept every button with its creator.
-- This migration finishes the idea the user asked for: once someone has said
-- Yes, the listing is *theirs too*. They can edit it, mark the room taken,
-- re-open it and take it down, exactly as the creator can, and because there
-- is only ever one `listings` row, whatever any of them does is what all of
-- them see.
--
-- Three things change:
--   1. a member may not be invited to a second home (one person, one home);
--   2. UPDATE and DELETE on `listings` open to the whole household;
--   3. `mark_listing_taken` and `remove_listing` follow.
--
-- `is_household_member(listing)` (0008) already means "creator or confirmed
-- resident", and 0032 guarantees a `listing_residents` row only exists after a
-- Yes — so that is the right *idea* of co-ownership. It is the wrong function
-- to reuse here, though: it is SECURITY INVOKER and reads `public.listings`
-- through RLS, so it answers "no" for any row the caller cannot already SELECT.
-- A paused or taken room is exactly such a row for a co-owner — which would
-- have left them unable to re-open the very room they had just closed. So
-- co-ownership gets its own definer function that reads the tables directly and
-- gives the same answer whatever the room's state. (Using a definer function
-- inside a policy is also what keeps the policy from re-entering the table it
-- guards.)
create or replace function public.can_manage_listing(p_listing uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
           select 1 from public.listings l
            where l.id = p_listing and l.owner_id = (select auth.uid())
         )
      or exists (
           select 1 from public.listing_residents r
            where r.listing_id = p_listing and r.resident_id = (select auth.uid())
         );
$$;

comment on function public.can_manage_listing(uuid) is
  'Creator or confirmed roommate: the co-ownership test for UPDATE/DELETE on listings. Definer, so it holds for paused and taken rooms too.';

revoke all on function public.can_manage_listing(uuid) from public, anon;
grant execute on function public.can_manage_listing(uuid) to authenticated;

-- ===================== 1. a listing never changes hands =====================
--
-- This is the load-bearing guard of the whole migration. Opening UPDATE to the
-- household means a co-owner's write is checked by a policy that asks "are you
-- in this household?" — and that stays true no matter what the row is changed
-- *to*. Without this trigger a co-owner could set `owner_id` to themselves and
-- take the listing, and RLS would happily allow it, because they really are a
-- household member both before and after. RLS `with check` cannot see the old
-- row, so the rule has to live in a trigger.
--
-- It applies to the creator too: nobody hands a listing to somebody else. The
-- one active-listing-per-owner index assumes an owner it can trust.
create or replace function public.listings_owner_is_permanent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.owner_id is distinct from old.owner_id then
    raise exception 'a listing cannot change hands' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists listings_owner_is_permanent on public.listings;
create trigger listings_owner_is_permanent
  before update on public.listings
  for each row execute function public.listings_owner_is_permanent();

-- ===================== 2. the household manages the room =====================
--
-- Same shape as the policies they replace (0001, hardened in 0002/0029) — the
-- suspension guard is kept verbatim — with `owner_id = auth.uid()` widened to
-- `can_manage_listing(id)`.
--
-- One SELECT policy is added alongside them. The creator could always read
-- their own room whatever its state (`owner_id = auth.uid()` in "active
-- listings are public"), but a co-owner had no such clause: once the room was
-- paused or taken it stopped being readable to them, which would have hidden it
-- from their My Listings and — worse — made `remove_listing`'s own SELECT come
-- up empty and report "already gone". Co-ownership has to include reading.
create policy "the household reads their listing"
  on public.listings for select to authenticated
  using (
    exists (
      select 1 from public.listing_residents r
       where r.listing_id = id and r.resident_id = (select auth.uid())
    )
  );

drop policy if exists "owners update their own listing" on public.listings;
create policy "the household updates their listing"
  on public.listings for update to authenticated
  using (public.can_manage_listing(id) and not public.is_suspended((select auth.uid())))
  with check (public.can_manage_listing(id) and not public.is_suspended((select auth.uid())));

drop policy if exists "owners delete their own listing" on public.listings;
create policy "the household deletes their listing"
  on public.listings for delete to authenticated
  using (public.can_manage_listing(id));

-- A co-owner should see who else was tagged on the room they now share.
-- Read-only: tagging itself stays with the creator (see the function below).
drop policy if exists "invites are visible to the invitee and the listing owner" on public.listing_invites;
create policy "invites are visible to the invitee and the household"
  on public.listing_invites for select to authenticated
  using (invitee_id = (select auth.uid()) or public.can_manage_listing(listing_id));

-- ===================== 3. taken / removed follow ownership =====================
--
-- Both are SECURITY INVOKER and lean on the caller's own UPDATE policy, which
-- now admits the household — but each also carries its own `owner_id` test,
-- which would silently return -1 for a co-owner and look like "already done".
-- Same bodies as 0025 / 0028 with that one test widened.
create or replace function public.mark_listing_taken(p_listing uuid, p_message text)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_told integer;
begin
  if coalesce(btrim(p_message), '') = '' then
    raise exception 'a message is required';
  end if;

  update public.listings
     set is_active = false,
         taken_at = now(),
         updated_at = now()
   where id = p_listing
     and public.can_manage_listing(p_listing)
     and taken_at is null;

  if not found then
    return -1;
  end if;

  insert into public.messages (conversation_id, sender_id, content, client_id)
  select c.id, (select auth.uid()), btrim(p_message), gen_random_uuid()
    from public.conversations c
   where c.listing_id = p_listing;

  get diagnostics v_told = row_count;
  return v_told;
end;
$$;

revoke all on function public.mark_listing_taken(uuid, text) from public, anon;
grant execute on function public.mark_listing_taken(uuid, text) to authenticated;

create or replace function public.remove_listing(p_listing uuid, p_message text)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_told integer;
  v_was_taken timestamptz;
begin
  if coalesce(btrim(p_message), '') = '' then
    raise exception 'a message is required';
  end if;

  select l.taken_at into v_was_taken
    from public.listings l
   where l.id = p_listing
     and public.can_manage_listing(p_listing)
     and l.removed_at is null;

  if not found then
    return -1;
  end if;

  update public.listings l
     set is_active = false,
         removed_at = now(),
         taken_at = coalesce(l.taken_at, now()),
         updated_at = now()
   where l.id = p_listing
     and public.can_manage_listing(p_listing)
     and l.removed_at is null;

  if not found then
    return -1;
  end if;

  if v_was_taken is not null then
    return -2;
  end if;

  insert into public.messages (conversation_id, sender_id, content, client_id)
  select c.id, (select auth.uid()), btrim(p_message), gen_random_uuid()
    from public.conversations c
   where c.listing_id = p_listing;

  get diagnostics v_told = row_count;
  return v_told;
end;
$$;

revoke all on function public.remove_listing(uuid, text) from public, anon;
grant execute on function public.remove_listing(uuid, text) to authenticated;

-- ===================== 4. one person, one home =====================
--
-- A member who already has a home of their own — one they posted, or one they
-- have already confirmed as a roommate — cannot be invited into a second.
-- Enforced here so it holds for the REST route and the form alike; the picker
-- filters the same people out so nobody is offered and then refused.
--
-- Their *current* listing is what disqualifies them, so only live rooms count:
-- a paused, taken or deleted listing leaves someone free to be tagged again.
-- The room being tagged is excluded from the resident test, so re-saving a form
-- whose roommates have already joined is not mistaken for a second home.
create or replace function public.invite_listing_roommates(p_listing uuid, p_invitees uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_roommates int;
  v_max int;
  v_ids uuid[];
  v_busy text;
begin
  select l.owner_id, l.roommates_count into v_owner, v_roommates
    from public.listings l
   where l.id = p_listing and l.removed_at is null;
  if not found then
    raise exception 'listing not found';
  end if;
  if v_owner is distinct from (select auth.uid()) then
    raise exception 'only the listing owner may tag roommates';
  end if;

  select coalesce(array_agg(distinct x), '{}'::uuid[]) into v_ids
    from unnest(coalesce(p_invitees, '{}'::uuid[])) as x
   where x is not null and x <> v_owner;

  v_max := greatest(v_roommates - 1, 0);
  if array_length(v_ids, 1) > v_max then
    raise exception 'at most % roommate(s) can be tagged when there are % current roommates', v_max, v_roommates
      using errcode = 'check_violation';
  end if;

  if exists (
    select 1 from unnest(v_ids) x
     where not exists (select 1 from public.profiles p where p.user_id = x)
  ) then
    raise exception 'tagged member not found';
  end if;

  if exists (select 1 from unnest(v_ids) x where public.is_blocked(v_owner, x)) then
    raise exception 'cannot tag a blocked member' using errcode = 'check_violation';
  end if;

  -- Named, because "someone you tagged" is not enough to act on when the
  -- picker holds several people.
  select p.full_name into v_busy
    from unnest(v_ids) x
    join public.profiles p on p.user_id = x
   where exists (
           select 1 from public.listings l
            where l.owner_id = x and l.is_active and l.removed_at is null
         )
      or exists (
           select 1 from public.listing_residents r
             join public.listings l on l.id = r.listing_id
            where r.resident_id = x
              and r.listing_id <> p_listing
              and l.is_active and l.removed_at is null
         )
   limit 1;
  if v_busy is not null then
    raise exception '% already has an active listing', v_busy using errcode = 'check_violation';
  end if;

  delete from public.listing_residents r
   where r.listing_id = p_listing
     and r.resident_id in (
       select i.invitee_id from public.listing_invites i
        where i.listing_id = p_listing and not (i.invitee_id = any (v_ids))
     );
  delete from public.listing_invites i
   where i.listing_id = p_listing and not (i.invitee_id = any (v_ids));

  insert into public.listing_invites (listing_id, invitee_id, inviter_id)
  select p_listing, x, v_owner from unnest(v_ids) as x
  on conflict (listing_id, invitee_id) do nothing;

  return (
    select count(*)::int from public.listing_invites i
     where i.listing_id = p_listing and i.status = 'pending'
  );
end;
$$;

revoke all on function public.invite_listing_roommates(uuid, uuid[]) from public, anon;
grant execute on function public.invite_listing_roommates(uuid, uuid[]) to authenticated;

-- The same rule on the way in: an invitation raised before the invitee took a
-- room of their own must not become a second home when they finally answer it.
-- Checked at Yes only — declining is always allowed.
create or replace function public.respond_to_listing_invite(p_invite uuid, p_accept boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_listing uuid;
  v_invitee uuid;
  v_status public.listing_invite_status;
begin
  select i.listing_id, i.invitee_id, i.status
    into v_listing, v_invitee, v_status
    from public.listing_invites i
   where i.id = p_invite
     for update;
  if not found then
    raise exception 'invite not found';
  end if;
  if v_invitee is distinct from (select auth.uid()) then
    raise exception 'only the invited member may answer this';
  end if;
  if v_status <> 'pending' then
    raise exception 'this invite was already answered' using errcode = 'check_violation';
  end if;

  if p_accept and (
    exists (
      select 1 from public.listings l
       where l.owner_id = v_invitee and l.is_active and l.removed_at is null
    )
    or exists (
      select 1 from public.listing_residents r
        join public.listings l on l.id = r.listing_id
       where r.resident_id = v_invitee
         and r.listing_id <> v_listing
         and l.is_active and l.removed_at is null
    )
  ) then
    raise exception 'you already have an active listing' using errcode = 'check_violation';
  end if;

  update public.listing_invites
     set status = (case when p_accept then 'accepted' else 'declined' end)::public.listing_invite_status,
         responded_at = now()
   where id = p_invite;

  if p_accept then
    insert into public.listing_residents (listing_id, resident_id)
    values (v_listing, v_invitee)
    on conflict (listing_id, resident_id) do nothing;
  else
    delete from public.listing_residents
     where listing_id = v_listing and resident_id = v_invitee;
  end if;

  return v_listing;
end;
$$;

revoke all on function public.respond_to_listing_invite(uuid, boolean) from public, anon;
grant execute on function public.respond_to_listing_invite(uuid, boolean) to authenticated;

-- ===================== 5. everyone sees the same room =====================
--
-- One row is what makes the state shared — there is no copy to keep in step.
-- Putting `listings` on the realtime publication is what makes it *immediate*:
-- a co-owner with the page open hears the change instead of finding out on
-- their next navigation. Readers are already limited by the SELECT policies
-- above, which realtime honours.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'listings'
  ) then
    alter publication supabase_realtime add table public.listings;
  end if;
end;
$$;
