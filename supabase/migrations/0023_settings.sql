-- 0023: Settings (2026-08-27). Three member-controlled switches plus the
-- account-deletion path, all reached from the gear in the header.
alter table public.profiles
  add column if not exists notify_new_matches boolean not null default false;

alter table public.profile_details
  add column if not exists show_phone boolean not null default true,
  add column if not exists show_contact_email boolean not null default true;

comment on column public.profiles.notify_new_matches is 'Email me when a newly published room matches my preferences (opt-in).';
comment on column public.profile_details.show_phone is 'Other members may see my phone number.';
comment on column public.profile_details.show_contact_email is 'Other members may see my contact e-mail.';

-- Contact visibility is enforced here, not in the UI: this function is the only
-- path another member has to these columns, so a hidden value comes back null
-- for a direct PostgREST call too. Recreated (not altered) because 0020 owns it.
drop function if exists public.public_profile_details(uuid);

create function public.public_profile_details(p_user uuid)
returns table (
  about text, languages text[], diet text, pet_details text, lifestyle text,
  wake_time text, bed_time text, shabbat text, cooking text,
  instagram text, facebook text, linkedin text, phone text, contact_email text
)
language sql
security definer
set search_path = public
stable
as $$
  select d.about, d.languages, d.diet, d.pet_details, d.lifestyle, d.wake_time, d.bed_time,
         d.shabbat, d.cooking, d.instagram, d.facebook, d.linkedin,
         case when d.show_phone then d.phone else null end,
         case when d.show_contact_email then d.contact_email else null end
  from public.profile_details d
  where d.user_id = p_user
    and (select auth.uid()) is not null;
$$;

revoke all on function public.public_profile_details(uuid) from public, anon;
grant execute on function public.public_profile_details(uuid) to authenticated;

-- Closing an account. Every app table cascades from auth.users (0001), so one
-- delete is enough. security definer because `authenticated` has no rights in
-- the auth schema; the body can only ever delete the caller's own row.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
