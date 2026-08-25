-- Extra profile pictures beyond the avatar (the round "+" circles on /profile/edit).
alter table public.profiles
  add column photo_urls text[] not null default '{}'
  check (array_length(photo_urls, 1) is null or array_length(photo_urls, 1) <= 6);
