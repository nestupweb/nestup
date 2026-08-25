-- ===== optimistic, idempotent sends =====
-- The browser stamps every message with a client-generated id. A retried send
-- (flaky network, double submit) hits the unique index instead of creating a
-- duplicate, and the thread replaces its optimistic bubble by this id.
alter table public.messages add column client_id uuid;
create unique index messages_client_id_uniq
  on public.messages (conversation_id, client_id)
  where client_id is not null;

-- ===== inbox summary: + next upcoming confirmed viewing =====
-- Drives the ring on the chat thumbnail and the "Viewing scheduled" chip.
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
  next_viewing_ends_at timestamptz
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
    ), '[]'::jsonb),
    l.viewing_slots,
    nv.starts_at,
    nv.ends_at
  from public.conversations c
  join public.listings l on l.id = c.listing_id
  left join public.profiles p
    on p.user_id = case when c.seeker_id = auth.uid() then l.owner_id else c.seeker_id end
  left join lateral (
    select m.content, m.image_path, m.created_at, m.sender_id
    from public.messages m
    where m.conversation_id = c.id
    order by m.created_at desc
    limit 1
  ) lm on true
  left join lateral (
    select v.starts_at, v.ends_at
    from public.viewings v
    where v.conversation_id = c.id and v.status = 'confirmed' and v.ends_at > now()
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
