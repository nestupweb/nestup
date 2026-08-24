-- Product change: chat no longer requires a mutual match. Messages hang off
-- conversations (listing_id, seeker_id); a seeker may message any active
-- listing's owner. The messages table is empty at this point, so the column
-- swap is safe.

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  seeker_id uuid not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (listing_id, seeker_id)
);

-- The match-based policies reference match_id, so drop them before the column.
drop policy "participants read match messages" on public.messages;
drop policy "participants send messages as themselves" on public.messages;

alter table public.messages drop column match_id;
alter table public.messages add column conversation_id uuid not null references public.conversations(id) on delete cascade;
create index messages_conversation_idx on public.messages (conversation_id, created_at);

alter table public.conversations enable row level security;

create policy "participants read conversations" on public.conversations for select
  using (
    (select auth.uid()) = seeker_id
    or (select auth.uid()) = (select l.owner_id from public.listings l where l.id = listing_id)
  );

create policy "seekers start conversations" on public.conversations for insert
  with check (
    (select auth.uid()) = seeker_id
    and exists (
      select 1 from public.listings l
      where l.id = listing_id and l.is_active and l.owner_id <> (select auth.uid())
    )
  );

-- Conversation-based replacements for the dropped messages policies.
create policy "participants read conversation messages"
  on public.messages for select to authenticated
  using (exists (
    select 1 from public.conversations c
    join public.listings l on l.id = c.listing_id
    where c.id = conversation_id
      and ((select auth.uid()) = c.seeker_id or (select auth.uid()) = l.owner_id)
  ));

create policy "participants send conversation messages"
  on public.messages for insert to authenticated
  with check (
    (select auth.uid()) = sender_id
    and exists (
      select 1 from public.conversations c
      join public.listings l on l.id = c.listing_id
      where c.id = conversation_id
        and ((select auth.uid()) = c.seeker_id or (select auth.uid()) = l.owner_id)
    )
  );
