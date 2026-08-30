-- Photos AND videos in chat, in whatever format the phone produced.
--
-- The `chat-images` bucket was created in 0014 with a three-entry MIME
-- allow-list and a 5 MB ceiling, so a .mov — or even a .gif or a .heic — was
-- refused by storage before it ever reached a policy. Both limits move here.

-- `image/*` and `video/*` are wildcard patterns, which storage matches on the
-- prefix; anything that is not media is still refused. 50 MB is the video
-- ceiling (photos leave the browser re-encoded to a few hundred KB) and is
-- mirrored by MAX_CHAT_MEDIA_BYTES in lib/chat-media.ts.
update storage.buckets
   set allowed_mime_types = array['image/*', 'video/*'],
       file_size_limit = 52428800
 where id = 'chat-images';

-- The two policies from 0014 read `storage.foldername(name)[1]` and are left
-- alone deliberately: videos are stored one level deeper, under
-- `<conversation>/video/<uuid>.<ext>`, so element 1 is still the conversation
-- id and the same "must be a participant" check applies to both kinds.

-- ===== inbox preview: say which one it was =====
-- Unchanged from 0024 except the `last_message` expression, which said
-- "📷 Photo" for every attachment.
create or replace function public.my_conversations()
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
    case
      when lm.content <> '' then lm.content
      when lm.image_path like '%/video/%' then '🎥 Video'
      when lm.image_path is not null then '📷 Photo'
      else lm.content
    end,
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
