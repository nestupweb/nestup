-- 0032: shared listings — a room posted by the whole household (2026-08-28).
--
-- Until now a listing had exactly one author. Real flats do not: three people
-- share the rent and all three want the room they are advertising to show up on
-- their own profile. The creator now tags the roommates who already live there,
-- and each of them is asked before anything of theirs changes.
--
-- Two facts, two tables, on purpose:
--
--   * `listing_invites`   — the ASKING. Who was tagged, by whom, and what they
--                           said. Lives for the life of the listing.
--   * `listing_residents` — the MEMBERSHIP (0006). Unchanged, and still means
--                           exactly what it meant yesterday: a confirmed member
--                           of this room's household.
--
-- Keeping them apart is what makes this safe to add. `listing_residents` is
-- read in seven migrations (0008 household chat, 0014/0015/0024 my_conversations,
-- 0027 linked_to_listing, 0029 report subjects, 0031 blocks) and four TypeScript
-- files, and every one of those readers means "household member" — chat access
-- included. Had the pending state been a `status` column on that table, each of
-- those eleven readers would have had to learn to filter it, and the one that
-- got missed would have handed an unconfirmed person the household's private
-- chats. Nothing writes `listing_residents` here until someone presses Yes, so
-- all eleven stay correct without being touched.

create type listing_invite_status as enum ('pending', 'accepted', 'declined');

create table public.listing_invites (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  invitee_id uuid not null references public.profiles(user_id) on delete cascade,
  inviter_id uuid not null references public.profiles(user_id) on delete cascade,
  status listing_invite_status not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (listing_id, invitee_id),
  constraint invite_not_self check (invitee_id <> inviter_id)
);

comment on table public.listing_invites is
  'Co-poster invitations. Written ONLY by invite_listing_roommates() and respond_to_listing_invite() — the table has no insert/update/delete policy.';
comment on column public.listing_invites.status is
  'pending until the invitee answers. accepted also wrote a listing_residents row; declined never did.';

-- The invitee's pending cards are the hot read (every Profile page load).
create index listing_invites_pending_idx on public.listing_invites (invitee_id) where status = 'pending';
create index listing_invites_by_listing_idx on public.listing_invites (listing_id);

alter table public.listing_invites enable row level security;

-- Both sides of the invitation can see it; nobody else. The creator needs their
-- own listing's rows to re-open the form with the tags still on it.
create policy "invites are visible to the invitee and the listing owner"
  on public.listing_invites for select to authenticated
  using (
    invitee_id = (select auth.uid())
    or exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = (select auth.uid()))
  );

-- No insert / update / delete policy, deliberately — the same shape `matches`
-- (0001) and `suspensions` (0029) use. A member cannot PATCH their own invite
-- to 'accepted', and cannot forge one naming somebody else; the two functions
-- below are the only way in, and each re-checks who is calling.

-- ===================== tagging (the creator) =====================
--
-- Called on every save of the listing form with the WHOLE tag list, and
-- reconciles to it:
--   * ids that are new        → a pending invite;
--   * ids that have gone      → the invite and, if they had joined, their
--                               co-poster row go too;
--   * ids that already agreed → left exactly as they are. Re-saving the form
--     never re-asks someone, and never re-asks someone who said no.
--
-- The cap lives here because here is the only place it cannot be skipped: the
-- picker and the server action check it too, but a hand-rolled POST reaches
-- this and no further. `roommates_count` is "current roommates" — the people
-- besides the creator — so one of those places is the room being advertised and
-- max_tagged = roommates_count - 1 leaves it open for the incoming seeker.
--
-- Returns how many invites are now outstanding.
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

  -- One row per person, and never the creator: the form is theirs already.
  select coalesce(array_agg(distinct x), '{}'::uuid[]) into v_ids
    from unnest(coalesce(p_invitees, '{}'::uuid[])) as x
   where x is not null and x <> v_owner;

  v_max := greatest(v_roommates - 1, 0);
  -- array_length of an empty array is null, and `null > n` is null — so an
  -- empty list passes, which is what clearing every tag has to do.
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

  -- Blocking is symmetric (0029) and beats everything else in the app; it beats
  -- this too, in both directions, so a block can never be walked around by
  -- tagging someone into your household.
  if exists (select 1 from unnest(v_ids) x where public.is_blocked(v_owner, x)) then
    raise exception 'cannot tag a blocked member' using errcode = 'check_violation';
  end if;

  -- Un-tagged: the co-poster row goes first (it is the one with consequences),
  -- then the invite. Scoped through `listing_invites`, so a resident who was
  -- never invited through this path — the seed's households — is left alone.
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

-- ===================== answering (the invitee) =====================
--
-- Yes and No are one statement each, because the answer and its consequence
-- must not come apart: an 'accepted' invite with no co-poster row would put the
-- room on someone's profile that the household cannot see them in, and a
-- co-poster row with no accepted invite is exactly the unconfirmed-member state
-- this migration exists to make impossible.
--
-- No is not a soft no: the association is removed and the row remembers only
-- that they were asked and declined — which is what stops the creator's next
-- save from asking again.
--
-- Returns the listing id, so the caller knows what to revalidate.
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
  -- Locked: two taps on Yes, or Yes in one tab and No in another, must not both
  -- get past the 'pending' check.
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
