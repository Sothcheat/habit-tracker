-- =============================================================================
-- Habit Tracker — Row Level Security, triggers and helper functions
--
-- The ERD does not model access control; these policies are the Supabase-side
-- enforcement of the "everything belongs to one user" rule the ERD implies:
--   profiles.id = auth.uid()
--   tasks.user_id / tags.user_id -> that profile
--   daily_logs / habit_logs / task_tags -> reachable only through an owned task
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Keep tasks.updated_at honest
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row
  execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Create a profile row whenever a user signs up
-- -----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Ownership helper — is this task owned by the calling user?
-- -----------------------------------------------------------------------------

create or replace function public.owns_task(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tasks t
    where t.id = p_task_id
      and t.user_id = (select auth.uid())
  );
$$;

-- -----------------------------------------------------------------------------
-- Enable RLS everywhere
-- -----------------------------------------------------------------------------

alter table public.profiles   enable row level security;
alter table public.tasks      enable row level security;
alter table public.daily_logs enable row level security;
alter table public.habit_logs enable row level security;
alter table public.tags       enable row level security;
alter table public.task_tags  enable row level security;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------

create policy "profiles: read own"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "profiles: insert own"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "profiles: delete own"
  on public.profiles for delete to authenticated
  using ((select auth.uid()) = id);

-- -----------------------------------------------------------------------------
-- tasks
-- -----------------------------------------------------------------------------

create policy "tasks: read own"
  on public.tasks for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "tasks: insert own"
  on public.tasks for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "tasks: update own"
  on public.tasks for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "tasks: delete own"
  on public.tasks for delete to authenticated
  using ((select auth.uid()) = user_id);

-- -----------------------------------------------------------------------------
-- tags
-- -----------------------------------------------------------------------------

create policy "tags: read own"
  on public.tags for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "tags: insert own"
  on public.tags for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "tags: update own"
  on public.tags for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "tags: delete own"
  on public.tags for delete to authenticated
  using ((select auth.uid()) = user_id);

-- -----------------------------------------------------------------------------
-- daily_logs — reachable only through an owned task
-- -----------------------------------------------------------------------------

create policy "daily_logs: read own"
  on public.daily_logs for select to authenticated
  using (public.owns_task(task_id));

create policy "daily_logs: insert own"
  on public.daily_logs for insert to authenticated
  with check (public.owns_task(task_id));

create policy "daily_logs: update own"
  on public.daily_logs for update to authenticated
  using (public.owns_task(task_id))
  with check (public.owns_task(task_id));

create policy "daily_logs: delete own"
  on public.daily_logs for delete to authenticated
  using (public.owns_task(task_id));

-- -----------------------------------------------------------------------------
-- habit_logs — reachable only through an owned task
-- -----------------------------------------------------------------------------

create policy "habit_logs: read own"
  on public.habit_logs for select to authenticated
  using (public.owns_task(task_id));

create policy "habit_logs: insert own"
  on public.habit_logs for insert to authenticated
  with check (public.owns_task(task_id));

create policy "habit_logs: update own"
  on public.habit_logs for update to authenticated
  using (public.owns_task(task_id))
  with check (public.owns_task(task_id));

create policy "habit_logs: delete own"
  on public.habit_logs for delete to authenticated
  using (public.owns_task(task_id));

-- -----------------------------------------------------------------------------
-- task_tags — both sides must belong to the caller
-- -----------------------------------------------------------------------------

create policy "task_tags: read own"
  on public.task_tags for select to authenticated
  using (public.owns_task(task_id));

create policy "task_tags: insert own"
  on public.task_tags for insert to authenticated
  with check (
    public.owns_task(task_id)
    and exists (
      select 1 from public.tags g
      where g.id = tag_id and g.user_id = (select auth.uid())
    )
  );

create policy "task_tags: delete own"
  on public.task_tags for delete to authenticated
  using (public.owns_task(task_id));
