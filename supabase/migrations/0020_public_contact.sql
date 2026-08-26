-- 0020: other members may see a person's phone number and contact e-mail on
-- their profile page (user decision, 2026-08-26 — reverses the 0013 choice).
-- Still signed-in only: the function is security definer, executable by
-- `authenticated`, and returns nothing for anonymous callers. The default
-- hello template (`intro_template`) stays private.
-- The return type changes, so the function is dropped and recreated.
drop function if exists public.public_profile_details(uuid);

create function public.public_profile_details(p_user uuid)
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
  linkedin text,
  phone text,
  contact_email text
)
language sql
security definer
set search_path = public
stable
as $$
  select d.about, d.languages, d.diet, d.pet_details, d.lifestyle, d.wake_time, d.bed_time,
         d.shabbat, d.cooking, d.instagram, d.facebook, d.linkedin, d.phone, d.contact_email
  from public.profile_details d
  where d.user_id = p_user
    and (select auth.uid()) is not null;
$$;

revoke all on function public.public_profile_details(uuid) from public, anon;
grant execute on function public.public_profile_details(uuid) to authenticated;
