-- =============================================================================
-- Habit Tracker — manual task order
--
-- Adds tasks.position so a task can be moved to the top or bottom of its
-- column. Lists sort by position ascending.
--
-- Why a float, and why epoch seconds:
--   * New tasks default to the current time as a number, so they always land
--     below everything that exists — the same order the app showed before.
--   * "To top" writes (smallest position in the column) − 1 and "to bottom"
--     writes (largest) + 1. One row updated per move; nobody else renumbered.
--   * double precision leaves room to insert between two rows later (the
--     midpoint) if drag-to-reorder is ever added.
-- =============================================================================

alter table public.tasks
  add column position double precision;

-- Existing tasks keep their current order: creation time.
update public.tasks
set position = extract(epoch from created_at);

alter table public.tasks
  alter column position set default extract(epoch from now()),
  alter column position set not null;

comment on column public.tasks.position is
  'Sort key within a column, ascending. Defaults to creation time in epoch seconds.';

-- Every list reads one user's tasks of one type, in position order.
create index tasks_user_id_type_position_idx
  on public.tasks (user_id, type, position);
