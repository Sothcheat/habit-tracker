# Database Schema

Supabase / PostgreSQL schema for the habit tracker. This document is the written
form of the ERD: the logical model, the physical model, and the reasoning behind
the parts of the SQL that the ERD could not show.

Source of truth is the SQL itself:

| File | Contents |
| --- | --- |
| [`supabase/migrations/20260922000100_init_schema.sql`](../supabase/migrations/20260922000100_init_schema.sql) | Enums, tables, constraints, indexes, comments |
| [`supabase/migrations/20260922000200_rls_and_triggers.sql`](../supabase/migrations/20260922000200_rls_and_triggers.sql) | Row Level Security, triggers, helper functions |
| [`supabase/migrations/20260923000100_seed_default_tags.sql`](../supabase/migrations/20260923000100_seed_default_tags.sql) | Default tags for every account |
| [`supabase/migrations/20260923000200_task_position.sql`](../supabase/migrations/20260923000200_task_position.sql) | `tasks.position` — manual order within a column |

---

## 1. Logical model

Six entities. Every row in the system is ultimately owned by exactly one user.

```
profiles ──1:0..many──> tasks ──1:0..many──> daily_logs
    │                     │
    │                     ├──1:0..many──> habit_logs
    │                     │
    │                     └──1:0..many──> task_tags <──0..many:1── tags
    │                                                               ▲
    └───────────────────────1:0..many───────────────────────────────┘
```

| Parent | Child | Cardinality | Rule |
| --- | --- | --- | --- |
| `profiles` | `tasks` | 1 to 0..many | Each task belongs to one user |
| `profiles` | `tags` | 1 to 0..many | Each tag belongs to one user |
| `tasks` | `daily_logs` | 1 to 0..many | Only tasks with type `daily`; one per date |
| `tasks` | `habit_logs` | 1 to 0..many | Only tasks with type `habit`; one per tap |
| `tasks` | `task_tags` | 1 to 0..many | Resolves tasks ↔ tags many-to-many |
| `tags` | `task_tags` | 1 to 0..many | Resolves tasks ↔ tags many-to-many |

### Why one `tasks` table

Habits, dailies and todos share most of their shape — title, notes, priority,
tags, archival. They differ only in how they are scheduled and how completion is
recorded. A single table discriminated by `type` keeps the shared queries
(today's list, tag filters, archive) to one scan, and pushes the differences
into nullable columns guarded by check constraints. The alternative — three
tables — would triple every shared query and every tag join.

The cost is that the type-specific columns are nullable at the column level. The
check constraints in §3 are what make them safe.

### Why two log tables

They record genuinely different things:

- A **daily** is either done on a date or it is not — so `daily_logs` is unique
  on `(task_id, log_date)` and carries a status (`done` or `frozen`).
- A **habit** is tapped any number of times a day, in either direction — so
  `habit_logs` has no uniqueness at all, only an index, and each row carries the
  tap's direction.

Merging them would mean a table whose uniqueness rule depends on the parent's
type, which no single constraint can express.

---

## 2. Enum types

| Type | Values |
| --- | --- |
| `task_type` | `'habit'`, `'daily'`, `'todo'` |
| `priority_level` | `'low'`, `'normal'`, `'essential'`, `'urgent'` |
| `habit_direction` | `'positive'`, `'negative'`, `'both'` |
| `frequency_type` | `'daily'`, `'weekdays'`, `'every_n_days'` |
| `log_status` | `'done'`, `'frozen'` |
| `tap_direction` | `'plus'`, `'minus'` |

Adding a value later is `alter type ... add value`, which cannot run inside a
transaction block in older PostgreSQL — put it in its own migration.

---

## 3. Physical model

### `profiles`

One row per authenticated user, keyed by the `auth.users` id.

| Column | Type | Null | Default | Constraint / note |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | — | PK; FK → `auth.users(id)` on delete cascade |
| `display_name` | `text` | yes | — | |
| `timezone` | `text` | no | `'UTC'` | |
| `week_start` | `smallint` | no | `1` | check between 0 and 6 |
| `freeze_balance` | `integer` | no | `0` | check >= 0 |
| `created_at` | `timestamptz` | no | `now()` | |

`id` is both the primary key and the foreign key — the profile *is* the user, so
there is no separate surrogate key and no way to have two profiles for one
account. `week_start` is 0 = Sunday through 6 = Saturday, matching the values
stored in `tasks.repeat_days`.

### `tasks`

| Column | Type | Null | Default | Constraint / note |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` | PK |
| `user_id` | `uuid` | no | — | FK → `profiles(id)` on delete cascade |
| `type` | `task_type` | no | — | |
| `title` | `text` | no | — | check `length(trim(title)) > 0` |
| `notes` | `text` | yes | — | |
| `priority` | `priority_level` | yes | — | |
| `direction` | `habit_direction` | yes | — | habit only |
| `frequency` | `frequency_type` | yes | — | daily only |
| `repeat_days` | `smallint[]` | yes | — | daily only; values 0–6 |
| `every_n_days` | `integer` | yes | — | daily only; check >= 1 |
| `start_date` | `date` | yes | — | daily only |
| `due_date` | `date` | yes | — | todo only |
| `completed_at` | `timestamptz` | yes | — | todo only |
| `archived_at` | `timestamptz` | yes | — | |
| `created_at` | `timestamptz` | no | `now()` | |
| `updated_at` | `timestamptz` | no | `now()` | maintained by trigger |
| `position` | `double precision` | no | epoch seconds of `now()` | sort key within a column, ascending |

Check constraints:

- `type = 'habit'` requires `direction`
- `type = 'daily'` requires `frequency` and `start_date`
- `frequency = 'weekdays'` requires `repeat_days`;
  `frequency = 'every_n_days'` requires `every_n_days`
- `completed_at` and `due_date` only when `type = 'todo'`

Index: `(user_id, type)` — every list screen filters by both.
Index: `(user_id, type, position)` — and reads them in position order.

`position` is the task's place in its column. New tasks default to the current
time as a number, so they land below everything that exists. "To top" writes
the column's smallest position minus 1 and "to bottom" its largest plus 1 —
one row changes per move, nothing is renumbered. It is a float so a
drag-to-reorder could later write the midpoint between two neighbours. The
migration backfilled existing rows from `created_at`, keeping their order.

`priority` (`low` / `normal` / `essential` / `urgent`, nullable) is set in the
task editor and shown on the card when present. It does not reorder anything;
order is `position` alone.

`repeat_days` is enforced with array containment
(`repeat_days <@ array[0,1,2,3,4,5,6]::smallint[]`), which is null-safe: the
check passes when the column is null, so non-daily tasks are unaffected.

`archived_at` is a soft delete. Non-null means the task is hidden from active
lists but its logs survive, so historical streaks stay intact.

### `daily_logs`

| Column | Type | Null | Default | Constraint / note |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` | PK |
| `task_id` | `uuid` | no | — | FK → `tasks(id)` on delete cascade |
| `log_date` | `date` | no | — | |
| `status` | `log_status` | no | `'done'` | |
| `created_at` | `timestamptz` | no | `now()` | |

Unique: `(task_id, log_date)`.

The unique constraint is what makes "mark today done" idempotent — a double tap
raises a duplicate-key error rather than inflating a streak. `status = 'frozen'`
records that the user spent a freeze from `profiles.freeze_balance` instead of
completing the task, which keeps the streak alive without claiming it was done.

### `habit_logs`

| Column | Type | Null | Default | Constraint / note |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` | PK |
| `task_id` | `uuid` | no | — | FK → `tasks(id)` on delete cascade |
| `direction` | `tap_direction` | no | — | |
| `log_date` | `date` | no | — | user's local date |
| `logged_at` | `timestamptz` | no | `now()` | |

Index: `(task_id, log_date)`.

Deliberately no unique constraint — a habit can be tapped many times a day.
`log_date` is stored separately from `logged_at` because "which day does this
tap belong to" is a question about the user's wall clock, not UTC. The client
resolves it from `profiles.timezone` before inserting; deriving it from
`logged_at` in SQL would put a tap just after local midnight on the wrong day.

### `tags`

| Column | Type | Null | Default | Constraint / note |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` | PK |
| `user_id` | `uuid` | no | — | FK → `profiles(id)` on delete cascade |
| `name` | `text` | no | — | |
| `color` | `text` | yes | — | |
| `created_at` | `timestamptz` | no | `now()` | |

Unique: `(user_id, name)` — tag names are unique per user, not globally.

Every account starts with seven tags — Work, Exercise, Health + Wellness,
School, Teams, Chores, Creativity — seeded by a trigger on `profiles` (see §6).
The app lists tags in `created_at` order, so new ones land at the end; the
seed spaces its rows 1 ms apart, because rows inserted in one statement would
otherwise share `now()` and have no stable order.

### `task_tags`

| Column | Type | Null | Default | Constraint / note |
| --- | --- | --- | --- | --- |
| `task_id` | `uuid` | no | — | FK → `tasks(id)` on delete cascade |
| `tag_id` | `uuid` | no | — | FK → `tags(id)` on delete cascade |

Primary key: `(task_id, tag_id)`. Index: `(tag_id)`.

The composite primary key both prevents duplicate pairs and serves lookups in
the `task_id` direction. The extra index on `tag_id` covers the other direction
("every task carrying this tag"), which the composite key's leading column
cannot serve.

---

## 4. Deletion behaviour

Every foreign key cascades, so the graph collapses from a single delete:

```
auth.users → profiles → tasks → daily_logs
                     │       ├→ habit_logs
                     │       └→ task_tags
                     └→ tags ──────┘
```

Deleting an `auth.users` row removes the profile, every task and tag, and every
log and tag link beneath them. This is what makes account deletion a one-liner
and keeps the database free of orphans.

---

## 5. Row Level Security

The ERD does not model access control. These policies are the Supabase-side
enforcement of the ownership rule the ERD implies.

RLS is enabled on all six tables. Every policy targets the `authenticated` role.
With RLS on and no policy matching, PostgreSQL denies by default, so anonymous
clients see nothing.

| Table | Ownership test |
| --- | --- |
| `profiles` | `auth.uid() = id` |
| `tasks` | `auth.uid() = user_id` |
| `tags` | `auth.uid() = user_id` |
| `daily_logs` | `owns_task(task_id)` |
| `habit_logs` | `owns_task(task_id)` |
| `task_tags` | `owns_task(task_id)`; insert also requires the tag be the caller's |

`public.owns_task(uuid)` is a `stable security definer` function that checks
whether a task belongs to the caller. It exists so the child tables do not each
repeat a subquery against `tasks`, and so that check does not itself have to
pass `tasks` RLS.

Two details worth keeping if these policies are edited:

- `auth.uid()` is wrapped as `(select auth.uid())`. PostgreSQL then evaluates it
  once per query instead of once per row, which is a large difference on list
  screens.
- `update` policies carry both `using` and `with check`. Without `with check`, a
  user could update a row they own into one they do not — reassigning
  `user_id` to somebody else.

`task_tags` has no update policy, by design: the table is nothing but its
primary key, so a change is a delete plus an insert.

---

## 6. Triggers and functions

| Object | Purpose |
| --- | --- |
| `public.set_updated_at()` + `tasks_set_updated_at` | Sets `tasks.updated_at` to `now()` on every update |
| `public.handle_new_user()` + `on_auth_user_created` | Inserts a `profiles` row when an `auth.users` row is created |
| `public.owns_task(uuid)` | Ownership test shared by the RLS policies |
| `public.seed_default_tags()` + `on_profile_created_seed_tags` | Inserts the seven default tags when a `profiles` row is created |

`handle_new_user` is `security definer` because it writes to `public.profiles`
from a trigger on `auth.users`, where the inserting role has no rights of its
own. It takes `display_name` from the signup metadata, falling back to the
email, and is `on conflict do nothing` so a retried signup is harmless.

`seed_default_tags` is deliberately **not** `security definer`. It runs as
whoever created the profile — the signup trigger, already privileged, or a
signed-in user through the app, whose own RLS insert policy on `tags` allows
exactly these rows. It uses `on conflict do nothing`, so a user who already
has a tag by one of these names keeps it.

All four functions set `search_path = ''` and use fully qualified names. A
`security definer` function without a pinned `search_path` can be hijacked by a
caller who puts a malicious table earlier in their own path.

---

## 7. Applying the migrations

With the Supabase CLI, against a local stack:

```bash
supabase start
supabase db reset          # replays every migration from scratch
```

Against a linked remote project:

```bash
supabase link --project-ref <project-ref>
supabase db push
```

Or paste each file, in filename order, into the SQL editor in the Supabase
dashboard. Order matters — the second migration references objects the first
one creates.

[`src/types/database.types.ts`](../src/types/database.types.ts) is hand-derived
from these migrations so the app can be typed before the project is reachable
from the CLI. Once the schema is live and you can log in, replace it with the
generated file rather than editing it by hand:

```bash
pnpm dlx supabase gen types typescript \
  --project-id artbewwpnuznjnkmvdxg > src/types/database.types.ts
```

---

## 8. Verification

Both migrations were applied to a throwaway PostgreSQL 16 instance with a
stubbed `auth` schema (`auth.users`, `auth.uid()`, the `authenticated` role) and
exercised:

- All six enums, six tables, two unique constraints, two indexes created cleanly.
- Every check constraint rejected the bad row it guards: `week_start = 7`,
  `freeze_balance = -1`, a whitespace-only title, a habit with no direction, a
  daily with no frequency or start date, `weekdays` with no `repeat_days`,
  `every_n_days` with no interval, `every_n_days = 0`, `repeat_days` containing
  `7`, a habit carrying a `due_date`, and a daily carrying a `completed_at`.
- Valid rows of all three task types inserted successfully.
- `daily_logs` rejected a second log for the same `(task_id, log_date)`, while
  `habit_logs` accepted several taps on one day.
- `tags` rejected a duplicate name for the same user; `task_tags` rejected a
  duplicate pair.
- The `updated_at` trigger bumped the column on update.
- Deleting the `auth.users` row emptied all six tables via cascade.
- Under RLS, a second user saw none of the first user's tasks, logs or tags,
  and was refused both a task insert spoofing the other's `user_id` and a log
  insert against the other's task.

Re-run it by starting any PostgreSQL 16 instance, creating the `auth` stub, and
applying the two migration files in order.

### Live audit against the real project

The same guarantees were re-checked against the hosted database with two real
accounts, A and B, each in its own authenticated session:

- B reading `tasks`, `habit_logs`, `daily_logs`, `tags` and `task_tags` gets an
  **empty list, not an error** — including when asking for A's habit by id —
  and cannot read A's profile.
- B updating or deleting A's habit affects 0 rows. B inserting a task with
  A's `user_id`, logging a tap or a daily on A's task, or tagging A's task is
  refused with `42501`. B cannot move its own row to A either — the `update`
  policy's `with check` refuses it.
- A signed-out visitor reads nothing.
- A deleting a habit that has logs succeeds and leaves no logs behind. That
  success is itself the proof of `ON DELETE CASCADE`: without it, the logs'
  foreign key would block the delete with `23503`.

Re-checking a live cascade by reading the logs afterwards proves nothing on
its own — once the task is gone, `owns_task()` hides its logs whether or not
they still exist. To look directly, run as the project owner in the SQL editor:

```sql
select count(*) from habit_logs l
where not exists (select 1 from tasks t where t.id = l.task_id);  -- expect 0
```

---

## 9. How the app queries it

All tracker queries live in
[`src/lib/tasks/api.ts`](../src/lib/tasks/api.ts). RLS is the guarantee;
the queries are **also** scoped to the signed-in user, so intent is readable
at the call site and a loosened policy would not silently widen what the app
reads.

| Table | Scoped by |
| --- | --- |
| `profiles` | `.eq("id", userId)` — the profile id *is* the user id |
| `tasks`, `tags` | `.eq("user_id", userId)`; single-row writes add `.eq("id", taskId)` |
| `habit_logs`, `daily_logs` (read) | `tasks!inner(user_id)` join + `.eq("tasks.user_id", userId)` |
| `habit_logs`, `daily_logs` (write) | `task_id` of a task already loaded for this user; RLS checks it |
| `task_tags` | `.eq("task_id", taskId)` + `.in("tag_id", …)`; RLS checks both sides |

- Writes return the row (`.select().single()`), and the UI only updates from
  that — never from what it hoped would happen. A `.single()` that matches
  nothing (`PGRST116`) means the row is gone or not yours.
- Deletes select the deleted ids, so "deleted nothing" is detectable rather
  than looking like success.
- Marking a daily done is an **upsert** on `(task_id, log_date)`, so a
  double-click cannot trip the unique constraint.
- Log history is loaded in a window — 30 days for habit strength, 90 for daily
  streaks — because it grows without bound.
- `profiles.timezone` defaults to `'UTC'`, which is nobody's real choice. On
  first load the app replaces that default with the device's zone, then uses
  it to decide what "today" is for every `log_date`.
- A missing profile row is created on load (an upsert that ignores
  duplicates), since every task references one.

---

## 10. Notes for future changes

- **The type-specific columns are a trade-off.** If a fourth task type arrives
  and brings its own columns, revisit the single-table decision rather than
  adding a fifth check constraint.
- **`repeat_days` is an array, not a join table.** It is bounded at seven small
  integers and is always read whole, so an array is right. Do not reach for it
  as a pattern for unbounded lists.
- **Streak calculation is not in the database.** There is no materialized streak
  column; streaks are derived from the log tables. If that becomes slow, cache
  it rather than denormalizing — a stored streak that drifts from the logs is
  worse than a slow query.
- **Freeze spending is two writes** — a `daily_logs` row with
  `status = 'frozen'` and a decrement of `profiles.freeze_balance`. Nothing
  currently makes them atomic. If freezes become important, wrap them in a
  `security definer` function so a client cannot do one without the other.
