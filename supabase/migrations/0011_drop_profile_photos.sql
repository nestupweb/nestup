-- Reverted: profiles keep a single picture (avatar_url). Undoes 0010_profile_photos.
alter table public.profiles drop column photo_urls;
