-- Daily life, two columns: how I live vs. what I want in flatmates. The
-- "mine" side already had smoker / has_pet / cleanliness / sleep_schedule /
-- guests_freq; this adds noise and diet, plus the "want" side for every row
-- (smoking and pets already had ok_with_smoker / ok_with_pets). All feed
-- lib/compatibility.ts. Lives on `profiles` (readable by signed-in members)
-- because the scores are computed for every pair. Non-volatile defaults, so
-- the ADD COLUMNs rewrite nothing.
alter table public.profiles
  add column if not exists noise_level text not null default 'moderate'
    check (noise_level in ('quiet', 'moderate', 'lively')),
  add column if not exists diet text not null default 'none'
    check (diet in ('none', 'kosher', 'vegetarian', 'vegan', 'halal', 'gluten_free', 'other')),
  -- tidiness I expect of flatmates, 1 = anything goes … 5 = spotless
  add column if not exists pref_cleanliness smallint not null default 1
    check (pref_cleanliness between 1 and 5),
  add column if not exists pref_sleep text not null default 'any'
    check (pref_sleep in ('any', 'early', 'late')),
  -- the most guests I'm comfortable with: 'rare' < 'sometimes' < 'any' (often is fine)
  add column if not exists pref_guests text not null default 'any'
    check (pref_guests in ('any', 'rare', 'sometimes')),
  -- the most noise I'm comfortable with: 'quiet' < 'moderate' < 'any'
  add column if not exists pref_noise text not null default 'any'
    check (pref_noise in ('any', 'quiet', 'moderate')),
  add column if not exists pref_diet text not null default 'any'
    check (pref_diet in ('any', 'kosher', 'vegetarian', 'vegan'));
