-- =============================================================================
-- Habit Tracker — default tags
--
-- Every account starts with the same seven tags. A trigger on profiles seeds
-- them for each new account; the backfill at the bottom seeds the accounts
-- that already exist.
--
-- Tags are listed in creation order, which is the order the app shows them in.
-- Each gets created_at nudged 1ms apart, because every row inserted in one
-- statement would otherwise share now() and have no stable order.
-- =============================================================================

create or replace function public.seed_default_tags()
returns trigger
language plpgsql
-- Deliberately NOT security definer. The trigger runs as whoever inserted the
-- profile: the signup trigger (already privileged) or the signed-in user via
-- the app, whose own RLS insert policy on tags allows exactly these rows.
set search_path = ''
as $$
begin
  insert into public.tags (user_id, name, created_at)
  select new.id, d.name, now() + d.ord * interval '1 millisecond'
  from unnest(array[
    'Work', 'Exercise', 'Health + Wellness', 'School',
    'Teams', 'Chores', 'Creativity'
  ]) with ordinality as d(name, ord)
  on conflict (user_id, name) do nothing;
  return new;
end;
$$;

create trigger on_profile_created_seed_tags
  after insert on public.profiles
  for each row
  execute function public.seed_default_tags();

-- Backfill existing accounts. `on conflict do nothing` keeps any tag a user
-- already made with one of these names, so this is safe to run more than once.
insert into public.tags (user_id, name, created_at)
select p.id, d.name, now() + d.ord * interval '1 millisecond'
from public.profiles p
cross join unnest(array[
  'Work', 'Exercise', 'Health + Wellness', 'School',
  'Teams', 'Chores', 'Creativity'
]) with ordinality as d(name, ord)
on conflict (user_id, name) do nothing;
