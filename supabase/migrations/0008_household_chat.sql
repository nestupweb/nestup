-- A listing's chat is with the whole household: the host (listing owner) AND
-- the roommates listed in listing_residents can read and reply. The seeker
-- side is unchanged (one thread per listing + seeker).

-- Everyone in the household of a listing (host or resident)?
create or replace function public.is_household_member(p_listing uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (select 1 from public.listings l where l.id = p_listing and l.owner_id = auth.uid())
      or exists (select 1 from public.listing_residents r where r.listing_id = p_listing and r.resident_id = auth.uid());
$$;
revoke all on function public.is_household_member(uuid) from public, anon;
grant execute on function public.is_household_member(uuid) to authenticated;

-- conversations: residents join the readers. Insert policy (seekers) unchanged.
drop policy "participants read conversations" on public.conversations;
create policy "participants read conversations" on public.conversations for select to authenticated
  using ((select auth.uid()) = seeker_id or public.is_household_member(listing_id));

-- messages: delegate membership to the conversations policy above (same
-- pattern conversation_reads / viewings already use).
drop policy "participants read conversation messages" on public.messages;
create policy "participants read conversation messages" on public.messages for select to authenticated
  using (exists (select 1 from public.conversations c where c.id = conversation_id));
drop policy "participants send conversation messages" on public.messages;
create policy "participants send conversation messages" on public.messages for insert to authenticated
  with check (
    (select auth.uid()) = sender_id
    and exists (select 1 from public.conversations c where c.id = conversation_id)
  );

-- ===== inbox summary: now with the household (host first, then roommates) =====
drop function public.my_conversations();
create function public.my_conversations()
returns table (
  id uuid,
  listing_id uuid,
  listing_title text,
  listing_city text,
  listing_address text,
  listing_rent int,
  listing_photo text,
  seeker_id uuid,
  owner_id uuid,
  other_user_id uuid,
  other_name text,
  other_avatar text,
  last_message text,
  last_message_at timestamptz,
  last_sender_id uuid,
  unread_count bigint,
  created_at timestamptz,
  household jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    c.id,
    l.id,
    l.title,
    l.city,
    l.address,
    l.rent,
    l.photo_urls[1],
    c.seeker_id,
    l.owner_id,
    case when c.seeker_id = auth.uid() then l.owner_id else c.seeker_id end,
    p.full_name,
    p.avatar_url,
    lm.content,
    lm.created_at,
    lm.sender_id,
    (
      select count(*) from public.messages m
      where m.conversation_id = c.id
        and m.sender_id <> auth.uid()
        and m.created_at > coalesce(r.last_read_at, 'epoch'::timestamptz)
    ),
    c.created_at,
    coalesce((
      select jsonb_agg(
        jsonb_build_object('user_id', h.user_id, 'full_name', h.full_name, 'avatar_url', h.avatar_url)
        order by (h.user_id = l.owner_id) desc, h.full_name
      )
      from public.profiles h
      where h.user_id = l.owner_id
         or h.user_id in (select rr.resident_id from public.listing_residents rr where rr.listing_id = l.id)
    ), '[]'::jsonb)
  from public.conversations c
  join public.listings l on l.id = c.listing_id
  left join public.profiles p
    on p.user_id = case when c.seeker_id = auth.uid() then l.owner_id else c.seeker_id end
  left join lateral (
    select m.content, m.created_at, m.sender_id
    from public.messages m
    where m.conversation_id = c.id
    order by m.created_at desc
    limit 1
  ) lm on true
  left join public.conversation_reads r
    on r.conversation_id = c.id and r.user_id = auth.uid()
  where c.seeker_id = auth.uid() or public.is_household_member(l.id)
  order by coalesce(lm.created_at, c.created_at) desc;
$$;
revoke all on function public.my_conversations() from public, anon;
grant execute on function public.my_conversations() to authenticated;

create or replace function public.my_unread_count()
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)
  from public.messages m
  join public.conversations c on c.id = m.conversation_id
  join public.listings l on l.id = c.listing_id
  left join public.conversation_reads r on r.conversation_id = c.id and r.user_id = auth.uid()
  where (c.seeker_id = auth.uid() or public.is_household_member(l.id))
    and m.sender_id <> auth.uid()
    and m.created_at > coalesce(r.last_read_at, 'epoch'::timestamptz);
$$;

-- Calendar invites: the seeker invites the host; anyone in the household invites the seeker.
create or replace function public.conversation_partner_email(p_conversation uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_seeker uuid;
  v_owner uuid;
  v_listing uuid;
  v_other uuid;
begin
  select c.seeker_id, l.owner_id, l.id into v_seeker, v_owner, v_listing
  from public.conversations c
  join public.listings l on l.id = c.listing_id
  where c.id = p_conversation;
  if not found then return null; end if;
  if auth.uid() = v_seeker then v_other := v_owner;
  elsif auth.uid() = v_owner
     or exists (select 1 from public.listing_residents r where r.listing_id = v_listing and r.resident_id = auth.uid())
  then v_other := v_seeker;
  else return null;
  end if;
  return (select u.email from auth.users u where u.id = v_other);
end;
$$;
