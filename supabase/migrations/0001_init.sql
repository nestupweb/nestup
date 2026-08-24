-- ===== enums =====
create type sleep_schedule as enum ('early','late','flexible');
create type guests_freq as enum ('rare','sometimes','often');
create type swipe_direction as enum ('like','skip');
create type lister_response as enum ('pending','liked','skipped');

-- ===== profiles =====
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 60),
  age int not null check (age between 18 and 120),
  occupation text not null default '',
  bio text not null default '' check (char_length(bio) <= 500),
  avatar_url text,
  smoker boolean not null default false,
  has_pet boolean not null default false,
  cleanliness int not null default 3 check (cleanliness between 1 and 5),
  sleep_schedule sleep_schedule not null default 'flexible',
  guests_freq guests_freq not null default 'sometimes',
  interests text[] not null default '{}',
  ok_with_smoker boolean not null default true,
  ok_with_pets boolean not null default true,
  budget_min int not null default 0 check (budget_min >= 0),
  budget_max int not null default 0 check (budget_max >= 0),
  preferred_cities text[] not null default '{}',
  earliest_move_in date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (budget_max = 0 or budget_max >= budget_min)
);

-- ===== listings =====
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(user_id) on delete cascade,
  title text not null check (char_length(title) between 5 and 80),
  description text not null default '' check (char_length(description) <= 2000),
  city text not null,
  neighborhood text not null default '',
  rent int not null check (rent > 0),
  available_from date not null,
  roommates_count int not null check (roommates_count between 0 and 10),
  pets_allowed boolean not null default false,
  smoking_allowed boolean not null default false,
  balcony boolean not null default false,
  air_conditioning boolean not null default false,
  parking boolean not null default false,
  elevator boolean not null default false,
  furnished boolean not null default false,
  photo_urls text[] not null default '{}' check (array_length(photo_urls, 1) is null or array_length(photo_urls, 1) <= 5),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- one ACTIVE listing per user (v1 rule)
create unique index one_active_listing_per_owner on public.listings (owner_id) where is_active;
create index listings_browse_idx on public.listings (city, rent, available_from) where is_active;

-- ===== swipes =====
create table public.swipes (
  id uuid primary key default gen_random_uuid(),
  seeker_id uuid not null references public.profiles(user_id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  direction swipe_direction not null,
  lister_response lister_response not null default 'pending',
  created_at timestamptz not null default now(),
  unique (seeker_id, listing_id)
);
create index swipes_likes_by_listing_idx on public.swipes (listing_id) where direction = 'like';
create index swipes_by_seeker_idx on public.swipes (seeker_id);

-- ===== matches =====
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  seeker_id uuid not null references public.profiles(user_id) on delete cascade,
  lister_id uuid not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (listing_id, seeker_id)
);
create index matches_by_seeker_idx on public.matches (seeker_id);
create index matches_by_lister_idx on public.matches (lister_id);

-- ===== messages =====
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  sender_id uuid not null references public.profiles(user_id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index messages_by_match_idx on public.messages (match_id, created_at);

-- ===== RLS =====
alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.swipes enable row level security;
alter table public.matches enable row level security;
alter table public.messages enable row level security;

-- profiles: readable by signed-in users; writable only by the owner
create policy "profiles are readable by authenticated users"
  on public.profiles for select to authenticated using (true);
create policy "users insert their own profile"
  on public.profiles for insert to authenticated with check (user_id = (select auth.uid()));
create policy "users update their own profile"
  on public.profiles for update to authenticated using (user_id = (select auth.uid()));

-- listings: PUBLIC read of active listings (approved rule); owner manages own
create policy "active listings are public"
  on public.listings for select to anon, authenticated
  using (is_active or owner_id = (select auth.uid()));
create policy "owners insert their own listing"
  on public.listings for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "owners update their own listing"
  on public.listings for update to authenticated using (owner_id = (select auth.uid()));
create policy "owners delete their own listing"
  on public.listings for delete to authenticated using (owner_id = (select auth.uid()));

-- swipes: seeker creates own; visible to seeker and to the listing's owner.
-- No UPDATE policy: lister_response changes ONLY via respond_to_interest().
create policy "seekers insert their own swipes"
  on public.swipes for insert to authenticated with check (seeker_id = (select auth.uid()));
create policy "swipes visible to seeker and listing owner"
  on public.swipes for select to authenticated
  using (
    seeker_id = (select auth.uid())
    or exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = (select auth.uid()))
  );

-- matches: participants read; NOBODY inserts directly (only the function below)
create policy "participants read their matches"
  on public.matches for select to authenticated
  using (seeker_id = (select auth.uid()) or lister_id = (select auth.uid()));

-- messages: participants of the match read and write as themselves
create policy "participants read match messages"
  on public.messages for select to authenticated
  using (exists (
    select 1 from public.matches m
    where m.id = match_id and (m.seeker_id = (select auth.uid()) or m.lister_id = (select auth.uid()))
  ));
create policy "participants send messages as themselves"
  on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1 from public.matches m
      where m.id = match_id and (m.seeker_id = (select auth.uid()) or m.lister_id = (select auth.uid()))
    )
  );

-- ===== match creation: single transaction, server-authoritative =====
create or replace function public.respond_to_interest(p_swipe_id uuid, p_response lister_response)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_swipe swipes%rowtype;
  v_listing listings%rowtype;
  v_match_id uuid;
begin
  if p_response not in ('liked','skipped') then
    raise exception 'response must be liked or skipped';
  end if;

  select * into v_swipe from swipes where id = p_swipe_id;
  if not found then raise exception 'swipe not found'; end if;

  select * into v_listing from listings where id = v_swipe.listing_id;
  if v_listing.owner_id is distinct from auth.uid() then
    raise exception 'only the listing owner may respond';
  end if;
  if v_swipe.direction <> 'like' then
    raise exception 'can only respond to likes';
  end if;

  update swipes set lister_response = p_response where id = p_swipe_id;

  if p_response = 'liked' then
    insert into matches (listing_id, seeker_id, lister_id)
    values (v_listing.id, v_swipe.seeker_id, v_listing.owner_id)
    on conflict (listing_id, seeker_id) do nothing;
    select id into v_match_id from matches
      where listing_id = v_listing.id and seeker_id = v_swipe.seeker_id;
  end if;

  return v_match_id;
end;
$$;
revoke all on function public.respond_to_interest from public;
grant execute on function public.respond_to_interest to authenticated;

-- ===== storage buckets & policies =====
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);
insert into storage.buckets (id, name, public) values ('listing-photos', 'listing-photos', true);

create policy "users upload to their own avatar folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "users replace their own avatars"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "users delete their own avatars"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "users upload to their own listing-photos folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "users delete their own listing photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ===== realtime for chat =====
alter publication supabase_realtime add table public.messages;
