-- =============================================================================
-- Habit Tracker — initial schema
-- Mirrors the logical + physical ERD in docs/database_schema.md
--
-- Tables: profiles, tasks, daily_logs, habit_logs, tags, task_tags
-- Enums:  task_type, priority_level, habit_direction, frequency_type,
--         log_status, tap_direction
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enum types
-- -----------------------------------------------------------------------------

create type public.task_type as enum ('habit', 'daily', 'todo');

create type public.priority_level as enum ('low', 'normal', 'essential', 'urgent');

create type public.habit_direction as enum ('positive', 'negative', 'both');

create type public.frequency_type as enum ('daily', 'weekdays', 'every_n_days');

create type public.log_status as enum ('done', 'frozen');

create type public.tap_direction as enum ('plus', 'minus');

-- -----------------------------------------------------------------------------
-- profiles — one row per authenticated user
-- -----------------------------------------------------------------------------

create table public.profiles (
  id             uuid        not null,
  display_name   text,
  timezone       text        not null default 'UTC',
  week_start     smallint    not null default 1,
  freeze_balance integer     not null default 0,
  created_at     timestamptz not null default now(),

  constraint profiles_pkey primary key (id),
  constraint profiles_id_fkey foreign key (id)
    references auth.users (id) on delete cascade,
  constraint profiles_week_start_check check (week_start between 0 and 6),
  constraint profiles_freeze_balance_check check (freeze_balance >= 0)
);

comment on table  public.profiles is 'Application profile for an auth.users row.';
comment on column public.profiles.week_start is '0 = Sunday .. 6 = Saturday.';
comment on column public.profiles.freeze_balance is 'Streak freezes the user may spend; never negative.';

-- -----------------------------------------------------------------------------
-- tasks — habits, dailies and todos share one table, discriminated by `type`
-- -----------------------------------------------------------------------------

create table public.tasks (
  id            uuid        not null default gen_random_uuid(),
  user_id       uuid        not null,
  type          public.task_type not null,
  title         text        not null,
  notes         text,
  priority      public.priority_level,
  direction     public.habit_direction,
  frequency     public.frequency_type,
  repeat_days   smallint[],
  every_n_days  integer,
  start_date    date,
  due_date      date,
  completed_at  timestamptz,
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint tasks_pkey primary key (id),
  constraint tasks_user_id_fkey foreign key (user_id)
    references public.profiles (id) on delete cascade,

  constraint tasks_title_check check (length(trim(title)) > 0),

  constraint tasks_every_n_days_check check (every_n_days >= 1),

  constraint tasks_repeat_days_check check (
    repeat_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
  ),

  -- type = 'habit' requires direction
  constraint tasks_habit_requires_direction_check check (
    type <> 'habit' or direction is not null
  ),

  -- type = 'daily' requires frequency and start_date
  constraint tasks_daily_requires_schedule_check check (
    type <> 'daily' or (frequency is not null and start_date is not null)
  ),

  -- frequency = 'weekdays' requires repeat_days;
  -- frequency = 'every_n_days' requires every_n_days
  constraint tasks_frequency_payload_check check (
    (frequency is distinct from 'weekdays'     or repeat_days  is not null)
    and
    (frequency is distinct from 'every_n_days' or every_n_days is not null)
  ),

  -- completed_at and due_date only when type = 'todo'
  constraint tasks_todo_only_fields_check check (
    type = 'todo' or (due_date is null and completed_at is null)
  )
);

create index tasks_user_id_type_idx on public.tasks (user_id, type);

comment on table  public.tasks is 'Habits, dailies and todos, discriminated by `type`.';
comment on column public.tasks.direction    is 'habit only';
comment on column public.tasks.frequency    is 'daily only';
comment on column public.tasks.repeat_days  is 'daily only; weekday numbers 0-6';
comment on column public.tasks.every_n_days is 'daily only';
comment on column public.tasks.start_date   is 'daily only';
comment on column public.tasks.due_date     is 'todo only';
comment on column public.tasks.completed_at is 'todo only';
comment on column public.tasks.archived_at  is 'Soft delete: non-null means hidden from active lists.';

-- -----------------------------------------------------------------------------
-- daily_logs — one row per daily task per date
-- -----------------------------------------------------------------------------

create table public.daily_logs (
  id         uuid        not null default gen_random_uuid(),
  task_id    uuid        not null,
  log_date   date        not null,
  status     public.log_status not null default 'done',
  created_at timestamptz not null default now(),

  constraint daily_logs_pkey primary key (id),
  constraint daily_logs_task_id_fkey foreign key (task_id)
    references public.tasks (id) on delete cascade,
  constraint daily_logs_task_id_log_date_key unique (task_id, log_date)
);

comment on table  public.daily_logs is 'Completion record for tasks of type `daily`; at most one per (task, date).';
comment on column public.daily_logs.status is '`frozen` means a streak freeze was spent instead of completing the task.';

-- -----------------------------------------------------------------------------
-- habit_logs — one row per habit tap (many per day allowed)
-- -----------------------------------------------------------------------------

create table public.habit_logs (
  id        uuid        not null default gen_random_uuid(),
  task_id   uuid        not null,
  direction public.tap_direction not null,
  log_date  date        not null,
  logged_at timestamptz not null default now(),

  constraint habit_logs_pkey primary key (id),
  constraint habit_logs_task_id_fkey foreign key (task_id)
    references public.tasks (id) on delete cascade
);

create index habit_logs_task_id_log_date_idx on public.habit_logs (task_id, log_date);

comment on table  public.habit_logs is 'One row per habit tap for tasks of type `habit`.';
comment on column public.habit_logs.log_date is 'The user''s local date, resolved client-side from profiles.timezone.';

-- -----------------------------------------------------------------------------
-- tags — user-scoped labels
-- -----------------------------------------------------------------------------

create table public.tags (
  id         uuid        not null default gen_random_uuid(),
  user_id    uuid        not null,
  name       text        not null,
  color      text,
  created_at timestamptz not null default now(),

  constraint tags_pkey primary key (id),
  constraint tags_user_id_fkey foreign key (user_id)
    references public.profiles (id) on delete cascade,
  constraint tags_user_id_name_key unique (user_id, name)
);

comment on table public.tags is 'User-scoped labels; tag names are unique per user.';

-- -----------------------------------------------------------------------------
-- task_tags — resolves tasks <-> tags many-to-many
-- -----------------------------------------------------------------------------

create table public.task_tags (
  task_id uuid not null,
  tag_id  uuid not null,

  constraint task_tags_pkey primary key (task_id, tag_id),
  constraint task_tags_task_id_fkey foreign key (task_id)
    references public.tasks (id) on delete cascade,
  constraint task_tags_tag_id_fkey foreign key (tag_id)
    references public.tags (id) on delete cascade
);

create index task_tags_tag_id_idx on public.task_tags (tag_id);

comment on table public.task_tags is 'Join table resolving the tasks <-> tags many-to-many relationship.';
