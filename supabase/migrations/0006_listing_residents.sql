-- Additional roommates shown under "Who lives here" (beyond the listing owner).
create table public.listing_residents (
  listing_id uuid not null references public.listings(id) on delete cascade,
  resident_id uuid not null references public.profiles(user_id) on delete cascade,
  primary key (listing_id, resident_id)
);

alter table public.listing_residents enable row level security;

-- Same visibility rule as profiles: signed-in users only (anon sees a sign-in prompt).
create policy "authenticated read listing residents" on public.listing_residents
  for select using ((select auth.uid()) is not null);
