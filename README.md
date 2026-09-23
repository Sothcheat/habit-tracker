# Cadence

A calm habit tracker for the things you repeat. Track **habits** you log any
number of times a day, **dailies** that repeat on a schedule, and **to-dos**
you finish once.

Built with React 19, TypeScript and Vite, with Supabase for accounts and data.

**Live demo:** [habit-tracker-bay-sigma.vercel.app](https://habit-tracker-bay-sigma.vercel.app/)
— create an account to try it; each account sees only its own tasks.

## Features

- **Accounts:** email sign-up and sign-in with validation. The tracker sits
  behind a protected route, so signed-out visitors are redirected to `/login`.
- **Habits:** log a good or bad tap, see today's count, and see whether a habit
  is going strong or slipping.
- **Dailies:** repeat every day, on certain weekdays, or every few days, with a
  streak.
- **To-dos:** optional due dates, with overdue ones flagged.
- **Organise:** priority, tags, search and a tag filter. Move any task to the
  top or bottom of its column.
- **Works offline:** the app opens to your tasks with no connection, and
  anything you do — add, edit, delete, tap, tick — is kept and synced when
  you're back. The header counts what's still waiting.
- **Share:** send a task and how it's going to anything on your phone, through
  the system share sheet. Hidden on browsers without the Web Share API.
- **Themes:** light, dark, or follow the system.
- **Built for a phone:** one column, 44px touch targets, laid out for a 320px
  screen upwards.

## Getting started

You need Node 22+, [pnpm](https://pnpm.io) and a free
[Supabase](https://supabase.com) project.

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **Add your Supabase keys.** Copy `.env.example` to `.env.local` and fill in
   the project URL and **anon** key from *Project Settings → API Keys*:

   ```bash
   cp .env.example .env.local
   ```

   `.env.local` is gitignored. Never put the `service_role` key here: anything
   in a `VITE_` variable ships to the browser.

3. **Create the database.** In the Supabase SQL editor, run each file in
   `supabase/migrations/` **in filename order**:

   | File | What it does |
   | --- | --- |
   | `…_init_schema.sql` | Tables, enums and check constraints |
   | `…_rls_and_triggers.sql` | Row-level security policies and triggers |
   | `…_seed_default_tags.sql` | Seven starter tags for every account |
   | `…_task_position.sql` | Manual task order within a column |

4. **Turn off email confirmation** (optional, for local development). Under
   *Authentication → Sign In / Providers → Email*, disable **Confirm email** so
   new accounts can sign in straight away.

5. **Run it**

   ```bash
   pnpm dev
   ```

## Deploying to Vercel

1. Import the repository in Vercel. It detects Vite and pnpm; the default
   build command (`pnpm build`) and output folder (`dist`) are correct.
2. Under **Settings → Environment Variables**, add `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` for Production and Preview. You don't need
   Vercel's Supabase integration: it creates differently named variables that
   Vite won't read. Vite bakes these values in at build time, so redeploy
   after changing them.
3. In **Supabase → Authentication → URL Configuration**, set the **Site URL**
   to your Vercel address and add it to **Redirect URLs**, so email links
   point to the live site instead of `localhost`.

`vercel.json` sends every path to `index.html`. Routes like `/login` exist
only inside the app, so without it, refreshing one of them would return a 404.
Real files are always served directly, and `/assets/` is excluded from the
rewrite: after a redeploy, a tab still asking for an old code file gets a
clean 404 instead of the HTML page served as JavaScript. If a build fails on
the Node version, set Node 22.x under **Settings → General**.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Start the dev server |
| `pnpm build` | Typecheck and build for production |
| `pnpm preview` | Serve the production build locally |
| `pnpm lint` | Lint with Biome |
| `pnpm check` | Lint, format and organise imports, applying fixes |
| `pnpm typecheck` | Typecheck without emitting |

## Security

Every table has row-level security enabled. A user can read and change only
their own rows (`auth.uid() = user_id`). Log and tag rows are checked through
the task they belong to, so nobody can attach data to someone else's task. The
app also scopes every query to the signed-in user, but that is a courtesy: the
policies in the database are the real guarantee.

**What if RLS were disabled?** With RLS off, anyone could copy the public anon
key out of the deployed JavaScript bundle and use Supabase's REST API directly
to read, change or delete every user's habits, logs, tags and profiles, with no
sign-in at all.

## Limitations

Known gaps in what's built today:

- **Password reset is half done.** "Forgot password?" sends the email, but
  there's no page to choose a new password yet: the link signs the user in and
  lands on the tracker.
- **Google and Apple sign-in** buttons are shown, but those providers aren't
  enabled in Supabase, so they return an error.
- **No live sync.** Changes made in another tab or device appear after a
  reload, not instantly.
- **"Today" doesn't roll over** at midnight while the page stays open. Reload
  to start the new day.
- **History is windowed.** Habit strength looks at the last 30 days of logs,
  and a daily's streak counts back at most 90 days.
- **Reordering is To top / To bottom only.** There's no drag and drop, and
  priority doesn't change the order.
- **Some fields exist in the database but have no UI yet:** streak freezes
  (`freeze_balance`, the `frozen` log status), archiving (`archived_at`), tag
  colours, and the week-start setting. Time zone is taken from the device on
  first load and can't be changed in the app.
- **Each tap waits for the server.** Writes are confirmed rather than
  optimistic, so nothing shows as saved until it is. The trade-off is a short
  delay on slow connections.
- **Offline sync is last-write-wins.** Changes made offline are replayed in
  order when the connection returns, and overwrite whatever another device did
  in the meantime. There is no merge and no conflict prompt.
- **Tags are not queued.** Creating, renaming and deleting tags needs a
  connection; tasks and their logs do not.

## Project structure

```
src/
  components/auth/      sign-in and sign-up forms
  components/routing/   ProtectedRoute and GuestRoute
  components/tracker/   the tracker: columns, cards, dialogs, tag panel
  components/ui/        shadcn/ui primitives
  lib/tasks/            every Supabase query, tracker state, schedule logic
  lib/                  auth, theme, validation and the Supabase client
supabase/migrations/    the database schema, applied in filename order
```

## Tech stack

React 19 with the React Compiler · TypeScript · Vite · Tailwind CSS v4 ·
shadcn/ui on Base UI · React Router · Supabase (Postgres, Auth, RLS) · Biome
