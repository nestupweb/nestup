-- "About me": an extended introduction plus personal details. Kept apart from
-- `profiles` (readable by every signed-in user) because it carries contact
-- data — owner-only RLS.
create table public.profile_details (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  about text not null default '' check (char_length(about) <= 3000),
  languages text[] not null default '{}',
  diet text not null default '' check (char_length(diet) <= 120),
  pet_details text not null default '' check (char_length(pet_details) <= 120),
  lifestyle text not null default '' check (char_length(lifestyle) <= 200),
  wake_time text not null default '' check (wake_time = '' or wake_time ~ '^\d{2}:\d{2}$'),
  bed_time text not null default '' check (bed_time = '' or bed_time ~ '^\d{2}:\d{2}$'),
  shabbat text not null default '' check (shabbat in ('', 'observant', 'traditional', 'not_observant')),
  cooking text not null default '' check (char_length(cooking) <= 120),
  phone text not null default '' check (char_length(phone) <= 30),
  contact_email text not null default '' check (char_length(contact_email) <= 120),
  instagram text not null default '' check (char_length(instagram) <= 120),
  facebook text not null default '' check (char_length(facebook) <= 160),
  linkedin text not null default '' check (char_length(linkedin) <= 160),
  updated_at timestamptz not null default now()
);
alter table public.profile_details enable row level security;
create policy "users read their own details" on public.profile_details
  for select to authenticated using (user_id = (select auth.uid()));
create policy "users create their own details" on public.profile_details
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "users update their own details" on public.profile_details
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
