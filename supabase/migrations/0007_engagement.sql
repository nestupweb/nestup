-- Profile tabs (Liked / History), WhatsApp-style inbox (per-user read markers,
-- unread counts), viewings scheduled from chat, and Google Calendar tokens.

-- ===== saved (liked) listings — replaces the localStorage-only heart =====
create table public.saved_listings (
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
create index saved_listings_by_listing_idx on public.saved_listings (listing_id);
alter table public.saved_listings enable row level security;
create policy "users read their saved listings" on public.saved_listings
  for select to authenticated using (user_id = (select auth.uid()));
create policy "users save listings" on public.saved_listings
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "users unsave listings" on public.saved_listings
  for delete to authenticated using (user_id = (select auth.uid()));

-- ===== recently viewed listings (profile › History) =====
create table public.listing_views (
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
create index listing_views_recent_idx on public.listing_views (user_id, viewed_at desc);
alter table public.listing_views enable row level security;
create policy "users read their view history" on public.listing_views
  for select to authenticated using (user_id = (select auth.uid()));
create policy "users record views" on public.listing_views
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "users refresh views" on public.listing_views
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ===== per-participant read marker (unread badges) =====
-- The conversations subquery runs under the caller's RLS, so only participants pass.
create table public.conversation_reads (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
alter table public.conversation_reads enable row level security;
create policy "users read their read markers" on public.conversation_reads
  for select to authenticated using (user_id = (select auth.uid()));
create policy "participants create read markers" on public.conversation_reads
  for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.conversations c where c.id = conversation_id));
create policy "users update their read markers" on public.conversation_reads
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ===== viewings proposed inside a chat =====
create table public.viewings (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  proposed_by uuid not null references auth.users(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'proposed' check (status in ('proposed','confirmed','declined','cancelled')),
  note text not null default '' check (char_length(note) <= 300),
  google_event_id text,
  google_event_link text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index viewings_by_conversation_idx on public.viewings (conversation_id, created_at);
alter table public.viewings enable row level security;
create policy "participants read viewings" on public.viewings
  for select to authenticated using (exists (select 1 from public.conversations c where c.id = conversation_id));
create policy "participants propose viewings" on public.viewings
  for insert to authenticated
  with check (proposed_by = (select auth.uid()) and exists (select 1 from public.conversations c where c.id = conversation_id));
create policy "participants update viewings" on public.viewings
  for update to authenticated
  using (exists (select 1 from public.conversations c where c.id = conversation_id))
  with check (exists (select 1 from public.conversations c where c.id = conversation_id));

-- ===== Google Calendar OAuth tokens (owner-only; never exposed to other users) =====
create table public.google_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null,
  access_token text not null,
  expires_at timestamptz not null,
  email text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.google_tokens enable row level security;
create policy "users read their google token" on public.google_tokens
  for select to authenticated using (user_id = (select auth.uid()));
create policy "users store their google token" on public.google_tokens
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "users refresh their google token" on public.google_tokens
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "users disconnect google" on public.google_tokens
  for delete to authenticated using (user_id = (select auth.uid()));

-- ===== inbox summary: one row per conversation the caller participates in =====
-- SECURITY INVOKER: every table read below is filtered by the caller's RLS.
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
  created_at timestamptz
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
    c.created_at
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
  where c.seeker_id = auth.uid() or l.owner_id = auth.uid()
  order by coalesce(lm.created_at, c.created_at) desc;
$$;

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
  where (c.seeker_id = auth.uid() or l.owner_id = auth.uid())
    and m.sender_id <> auth.uid()
    and m.created_at > coalesce(r.last_read_at, 'epoch'::timestamptz);
$$;

-- The other participant's sign-in email, for calendar invites. SECURITY DEFINER
-- because auth.users is not readable by clients; gated to conversation participants.
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
  v_other uuid;
begin
  select c.seeker_id, l.owner_id into v_seeker, v_owner
  from public.conversations c
  join public.listings l on l.id = c.listing_id
  where c.id = p_conversation;
  if not found then return null; end if;
  if auth.uid() = v_seeker then v_other := v_owner;
  elsif auth.uid() = v_owner then v_other := v_seeker;
  else return null;
  end if;
  return (select u.email from auth.users u where u.id = v_other);
end;
$$;

revoke all on function public.my_conversations() from public, anon;
revoke all on function public.my_unread_count() from public, anon;
revoke all on function public.conversation_partner_email(uuid) from public, anon;
grant execute on function public.my_conversations() to authenticated;
grant execute on function public.my_unread_count() to authenticated;
grant execute on function public.conversation_partner_email(uuid) to authenticated;

-- Viewing proposals/responses stream to open chats like messages do.
alter publication supabase_realtime add table public.viewings;

-- Read marker stamped by the database clock (never behind a just-inserted
-- message, regardless of app-server clock skew). SECURITY INVOKER: the insert
-- still passes through conversation_reads RLS, so only participants succeed.
create or replace function public.mark_conversation_read(p_conversation uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.conversation_reads (conversation_id, user_id, last_read_at)
  values (
    p_conversation,
    auth.uid(),
    greatest(
      now(),
      coalesce((select max(m.created_at) from public.messages m where m.conversation_id = p_conversation), now())
    )
  )
  on conflict (conversation_id, user_id) do update set last_read_at = excluded.last_read_at;
$$;
revoke all on function public.mark_conversation_read(uuid) from public, anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
