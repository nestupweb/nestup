-- 0017: a seeker's own default "hello" for Swipe likes.
-- Lives on profile_details (owner-only RLS from 0012) and is NOT part of
-- public_profile_details(), so nobody else can read it. Empty = built-in text.
-- {name} in the template is replaced with the host's first name in the app.
alter table public.profile_details
  add column intro_template text not null default ''
    constraint profile_details_intro_template_len check (char_length(intro_template) <= 500);

comment on column public.profile_details.intro_template is
  'Default message offered after liking a room on Swipe; {name} = host first name; empty = app default.';
