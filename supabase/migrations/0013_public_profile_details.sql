-- Roommate names link to a public profile page. The "About me" details stay
-- owner-only at the table level (0012); this function hands other signed-in
-- members the shareable subset — never phone or contact e-mail (the in-app
-- chat is the contact channel).

create or replace function public.public_profile_details(p_user uuid)
returns table (
  about text,
  languages text[],
  diet text,
  pet_details text,
  lifestyle text,
  wake_time text,
  bed_time text,
  shabbat text,
  cooking text,
  instagram text,
  facebook text,
  linkedin text
)
language sql
security definer
set search_path = public
stable
as $$
  select d.about, d.languages, d.diet, d.pet_details, d.lifestyle, d.wake_time, d.bed_time,
         d.shabbat, d.cooking, d.instagram, d.facebook, d.linkedin
  from public.profile_details d
  where d.user_id = p_user
    and (select auth.uid()) is not null;
$$;

revoke all on function public.public_profile_details(uuid) from public, anon;
grant execute on function public.public_profile_details(uuid) to authenticated;
