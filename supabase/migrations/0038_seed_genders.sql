-- 0038: give the demo members a gender, so the new filters have data (2026-08-29).
--
-- Data only, no schema. Two rules make it safe to keep:
--
--   * `@nestup.dev` only. A real member's gender is theirs to state; guessing
--     it from their first name and writing it to their profile is exactly the
--     thing not to do. They see an empty field and choose.
--   * `gender is null` only, so re-running never overwrites a choice.
--
-- The genders come from the seeded first names. Names that are unisex in
-- Hebrew — Tal, Or, Gal, Noam, Ariel and the rest — cannot be read off the
-- name, so they are spread deterministically from the user id: a stable split
-- with a slice of "other" and "prefer not to say", so all four options exist
-- in the demo data and every screen has something to show.
--
-- This is add-only in the sense that matters (see scripts/seed-data.ts): it
-- fills a new column and touches no name, photo, listing or fingerprint.
with named as (
  select p.user_id,
         lower(split_part(p.full_name, ' ', 1)) as first_name
    from public.profiles p
    join auth.users u on u.id = p.user_id
   where p.gender is null
     and u.email like '%@nestup.dev'
),
classified as (
  select user_id,
         case
           when first_name in ('yonatan','itai','nadav','ido','ori','guy','roee','tomer','amir',
                               'eyal','nir','alon','ben','dor','erez','matan','uri','asaf','shai',
                               'yoav','elad','ran','idan','oren','barak','gilad','dean','ronen',
                               'lidor','yotam','omri','yaniv','kfir','ohad','avi','eitan','omer',
                               'daniel')
             then 'male'::public.gender
           when first_name in ('maya','yael','dana','hila','lihi','inbar','shani','efrat','liat',
                               'keren','talia','ella','yuli','sivan','ayelet','noga','eden','romi',
                               'lian','nofar','hodaya','adva','tzlil','shirel','alona','michal',
                               'noa','shira','tamar','neta','netta','mika')
             then 'female'::public.gender
           -- Unisex, or a name we do not know: spread it, stably.
           else (array['male','female','male','female','male','female','male','female',
                       'male','female','male','female','male','female','male','female',
                       'male','female','male','female','male','female','other',
                       'prefer_not_to_say'])[
                  -- bit(16) casts to a plain 0..65535, never negative: a
                  -- signed bit(32) would index the array from 0 or below and
                  -- silently hand back NULL.
                  1 + (('x' || substr(md5(user_id::text), 1, 4))::bit(16)::int % 24)
                ]::public.gender
         end as g
    from named
)
update public.profiles p
   set gender = c.g
  from classified c
 where p.user_id = c.user_id;
