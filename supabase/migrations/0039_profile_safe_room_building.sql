-- The seeker-side mamad choice becomes "in the building" rather than "in the
-- apartment" (user request, 2026-08-29). Browse still offers both places; a
-- member's own preference asks only how far they'll walk to it.
--
-- No row held 'apartment' when this ran (843 profiles, all 'any'), but the
-- update is here so the constraint can never reject an existing row.
update public.profiles set pref_safe_room = 'has' where pref_safe_room = 'apartment';

alter table public.profiles drop constraint if exists profiles_pref_safe_room_check;
alter table public.profiles
  add constraint profiles_pref_safe_room_check
    check (pref_safe_room in ('any', 'has', 'building'));

comment on column public.profiles.pref_safe_room is
  'Mamad this member is looking for (lib/constants PREF_SAFE_ROOMS); any = no preference, has = anywhere, building = shared in the building.';
