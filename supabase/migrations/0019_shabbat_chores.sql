-- 0019: Shabbat joins the Daily life table (my observance beside what I want
-- in roommates) so it can count toward the Lifestyle match, and household
-- chores become a profile field: the chores a member is happy to take on.
-- Both live on `profiles` (readable by every signed-in member, like the rest
-- of the table). `profile_details.shabbat` stays as the historical column and
-- is still written by the form, but `profiles.shabbat` is what the app reads.
alter table public.profiles
  add column if not exists shabbat text not null default ''
    check (shabbat in ('', 'observant', 'traditional', 'not_observant')),
  -- what I want in roommates; 'traditional' means traditional or observant
  add column if not exists pref_shabbat text not null default 'any'
    check (pref_shabbat in ('any', 'observant', 'traditional', 'not_observant')),
  add column if not exists chores text[] not null default '{}'
    check (cardinality(chores) <= 12);

-- Backfill from the About-me details, where Shabbat used to live.
update public.profiles p
   set shabbat = d.shabbat
  from public.profile_details d
 where d.user_id = p.user_id
   and d.shabbat <> ''
   and p.shabbat = '';

comment on column public.profiles.chores is 'Household chores this member is willing to do (from lib/constants CHORES).';
