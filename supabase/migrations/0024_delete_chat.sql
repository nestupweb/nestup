-- 0024: Delete chat (2026-08-27). WhatsApp semantics, exactly: "Delete chat"
-- takes the thread out of *your* Chats and hides everything said up to that
-- moment — for you only. The other side keeps the conversation untouched, and
-- the next message they send brings the row back, carrying that message alone.
-- Nothing is destroyed: one timestamp per (conversation, member) is the cutoff
-- every read path filters by.

create table public.conversation_deletes (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  cleared_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
comment on table public.conversation_deletes is 'Per-member "delete chat" cutoff: messages and viewings at or before cleared_at are hidden from this member only.';

alter table public.conversation_deletes enable row level security;

-- Same shape as conversation_reads: your own row, and only for a conversation
-- you take part in (the subquery runs under the caller's RLS).
create policy "users read their chat cutoffs" on public.conversation_deletes
  for select to authenticated using (user_id = (select auth.uid()));
create policy "participants delete their chat" on public.conversation_deletes
  for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.conversations c where c.id = conversation_id));
create policy "users move their chat cutoff" on public.conversation_deletes
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- The cutoff is stamped by the database clock, never behind a message that
-- landed the same instant (same guard mark_conversation_read uses), so a chat
-- deleted mid-conversation cannot come back holding a message the member
-- already saw. SECURITY INVOKER: the insert still goes through the policies above.
create or replace function public.clear_conversation(p_conversation uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.conversation_deletes (conversation_id, user_id, cleared_at)
  values (
    p_conversation,
    auth.uid(),
    greatest(
      now(),
      coalesce((select max(m.created_at) from public.messages m where m.conversation_id = p_conversation), now())
    )
  )
  on conflict (conversation_id, user_id) do update set cleared_at = excluded.cleared_at;
$$;
revoke all on function public.clear_conversation(uuid) from public, anon;
grant execute on function public.clear_conversation(uuid) to authenticated;

-- ===== inbox summary: everything now reads past the caller's cutoff =====
-- The row itself is still returned (the thread page looks a conversation up
-- here, and a member who re-opens a deleted chat from a listing gets an empty
-- one rather than a 404) — `cleared_at` with no `last_message_at` is what the
-- inbox list treats as "deleted", and one new message undoes it on its own.
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
  household jsonb,
  listing_viewing_slots jsonb,
  next_viewing_starts_at timestamptz,
  next_viewing_ends_at timestamptz,
  cleared_at timestamptz
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
    case when lm.content = '' and lm.image_path is not null then '📷 Photo' else lm.content end,
    lm.created_at,
    lm.sender_id,
    (
      select count(*) from public.messages m
      where m.conversation_id = c.id
        and m.sender_id <> auth.uid()
        and m.created_at > greatest(
          coalesce(r.last_read_at, 'epoch'::timestamptz),
          coalesce(d.cleared_at, 'epoch'::timestamptz)
        )
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
    ), '[]'::jsonb),
    l.viewing_slots,
    nv.starts_at,
    nv.ends_at,
    d.cleared_at
  from public.conversations c
  join public.listings l on l.id = c.listing_id
  -- Joined before the laterals below so they can read the cutoff.
  left join public.conversation_deletes d
    on d.conversation_id = c.id and d.user_id = auth.uid()
  left join public.profiles p
    on p.user_id = case when c.seeker_id = auth.uid() then l.owner_id else c.seeker_id end
  left join lateral (
    select m.content, m.image_path, m.created_at, m.sender_id
    from public.messages m
    where m.conversation_id = c.id
      and m.created_at > coalesce(d.cleared_at, 'epoch'::timestamptz)
    order by m.created_at desc
    limit 1
  ) lm on true
  left join lateral (
    select v.starts_at, v.ends_at
    from public.viewings v
    where v.conversation_id = c.id and v.status = 'confirmed' and v.ends_at > now()
      and v.created_at > coalesce(d.cleared_at, 'epoch'::timestamptz)
    order by v.starts_at
    limit 1
  ) nv on true
  left join public.conversation_reads r
    on r.conversation_id = c.id and r.user_id = auth.uid()
  where c.seeker_id = auth.uid() or public.is_household_member(l.id)
  order by coalesce(lm.created_at, c.created_at) desc;
$$;
revoke all on function public.my_conversations() from public, anon;
grant execute on function public.my_conversations() to authenticated;

-- The header badge counts the same messages the inbox would show.
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
  left join public.conversation_deletes d on d.conversation_id = c.id and d.user_id = auth.uid()
  where (c.seeker_id = auth.uid() or public.is_household_member(l.id))
    and m.sender_id <> auth.uid()
    and m.created_at > greatest(
      coalesce(r.last_read_at, 'epoch'::timestamptz),
      coalesce(d.cleared_at, 'epoch'::timestamptz)
    );
$$;
