-- Viewing hours on listings, approval-gated viewings, and photos in chat.

-- ===== listings: weekly viewing hours =====
-- [{ "day": 0..6 (Sun..Sat), "from": "HH:MM", "to": "HH:MM" }, …]; empty = any time.
alter table public.listings
  add column viewing_slots jsonb not null default '[]'::jsonb
  check (jsonb_typeof(viewing_slots) = 'array' and jsonb_array_length(viewing_slots) <= 21);

-- ===== messages: an optional photo, text may then be empty =====
alter table public.messages add column image_path text check (char_length(image_path) <= 200);
alter table public.messages drop constraint messages_content_check;
alter table public.messages add constraint messages_content_check
  check (char_length(content) <= 2000 and (char_length(content) >= 1 or image_path is not null));

-- Private bucket; the app serves photos through short-lived signed URLs.
-- Objects live under `<conversation id>/<uuid>.<ext>`, and the conversations
-- RLS policy (seeker or household) decides who may upload to / read a folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('chat-images', 'chat-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']);
create policy "participants upload chat images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'chat-images'
    and exists (select 1 from public.conversations c where c.id::text = (storage.foldername(name))[1])
  );
create policy "participants read chat images"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'chat-images'
    and exists (select 1 from public.conversations c where c.id::text = (storage.foldername(name))[1])
  );

-- ===== viewings: only the other party can approve; proposals are immutable =====
create or replace function public.viewings_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if old.status in ('declined', 'cancelled') then
      raise exception 'This viewing is closed.';
    end if;
    if new.status in ('confirmed', 'declined') then
      if old.status <> 'proposed' then
        raise exception 'Only a pending viewing can be approved or declined.';
      end if;
      if old.proposed_by = auth.uid() then
        raise exception 'The other party has to approve the viewing.';
      end if;
    end if;
  end if;
  -- Everything but status and the calendar mirror is fixed once proposed.
  new.conversation_id := old.conversation_id;
  new.proposed_by := old.proposed_by;
  new.starts_at := old.starts_at;
  new.ends_at := old.ends_at;
  new.note := old.note;
  new.created_at := old.created_at;
  return new;
end;
$$;
drop trigger if exists viewings_guard on public.viewings;
create trigger viewings_guard before update on public.viewings
  for each row execute function public.viewings_guard();

-- ===== inbox summary: + viewing hours, photo previews =====
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
  listing_viewing_slots jsonb
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
    l.viewing_slots
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
  left join public.conversation_reads r
    on r.conversation_id = c.id and r.user_id = auth.uid()
  where c.seeker_id = auth.uid() or public.is_household_member(l.id)
  order by coalesce(lm.created_at, c.created_at) desc;
$$;
revoke all on function public.my_conversations() from public, anon;
grant execute on function public.my_conversations() to authenticated;
