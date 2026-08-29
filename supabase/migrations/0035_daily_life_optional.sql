-- 0035: an unanswered Daily life row is NULL, not a guess (2026-08-29).
--
-- Every one of these columns was NOT NULL with a default, so a member who had
-- never opened the questionnaire still "said" they were tidy enough, flexible,
-- fine with guests and happy to live with a smoker. The profile showed those
-- answers as theirs and the match scores counted them.
--
-- NULL now means "not answered yet". `is_daily_life_complete` is what the swipe
-- deck checks: scores come from this table, so swiping before filling it in
-- ranks rooms against answers nobody gave.
--
-- The DEFAULTS ARE DELIBERATELY KEPT. A default only applies to an INSERT that
-- omits the column, which is every path except the profile form — the seed
-- script, and anything else that writes a partial row, keep behaving exactly as
-- before. The form always sends all sixteen columns explicitly, so it is the
-- one writer that can store a NULL.
alter table public.profiles
  alter column smoker           drop not null,
  alter column has_pet          drop not null,
  alter column cleanliness      drop not null,
  alter column sleep_schedule   drop not null,
  alter column guests_freq      drop not null,
  alter column noise_level      drop not null,
  alter column diet             drop not null,
  alter column shabbat          drop not null,
  alter column ok_with_smoker   drop not null,
  alter column ok_with_pets     drop not null,
  alter column pref_cleanliness drop not null,
  alter column pref_sleep       drop not null,
  alter column pref_guests      drop not null,
  alter column pref_noise       drop not null,
  alter column pref_diet        drop not null,
  alter column pref_shabbat     drop not null;

comment on column public.profiles.cleanliness is
  'Daily life: how I live. NULL = not answered yet (0035); the swipe deck is closed until every row is answered.';

-- The same question the app asks in `isDailyLifeComplete` (lib/daily-life.ts),
-- available to SQL so a check never has to fetch the whole row.
--
-- `shabbat` is complete at the empty string: "prefer not to say" is a real
-- answer there and scores as neutral, so only NULL means unanswered.
create or replace function public.is_daily_life_complete(p_user uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(bool_and(x is not null), false)
    from public.profiles p,
         lateral (values
           (p.smoker::text), (p.has_pet::text), (p.cleanliness::text),
           (p.sleep_schedule::text), (p.guests_freq::text), (p.noise_level),
           (p.diet), (p.shabbat), (p.ok_with_smoker::text), (p.ok_with_pets::text),
           (p.pref_cleanliness::text), (p.pref_sleep), (p.pref_guests),
           (p.pref_noise), (p.pref_diet), (p.pref_shabbat)
         ) as answers(x)
   where p.user_id = p_user;
$$;

comment on function public.is_daily_life_complete(uuid) is
  'True when every Daily life answer is filled in — what /swipe requires (0035).';
