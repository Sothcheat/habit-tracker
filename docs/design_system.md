# Design System

Every visual decision in Cadence comes from tokens defined in
[`src/index.css`](../src/index.css). That file is the source of truth; this
document explains what the tokens mean and when to reach for each one.

Two rules carry the rest:

1. **Never write a raw colour, radius or shadow in a component.** If a value is
   missing, add a token and document it here.
2. **If you change the system, change this document in the same edit.** A doc
   that describes a palette the code no longer uses is worse than no doc.

---

## 1. The intent

Clean, modern and professional, but calm — a tool you open every day and
should never feel shouted at by.

The mechanism is **restraint in chroma**. Saturation is what makes an interface
feel loud, so the palette holds every colour below **C = 0.09** except
`--destructive`. Emphasis comes from contrast, weight and spacing instead.

There is **one surface**, themed light and dark. An earlier version had a
separate fixed "brand canvas" for auth — a deep purple starfield. It is gone:
it made the product's first impression louder than the product itself, and a
second surface meant every component needed two sets of colours.

---

## 2. Colour

All colours are `oklch()`. Perceptual lightness means `--primary` at L=0.52 and
a hover shade at L=0.47 differ by the amount they look like they differ, which
is not true of `hsl()`.

The palette sits on **hue ≈ 282–288**, a violet, with a blue-leaning `--accent`
at 280 and `--destructive` alone off-family at 25.5.

| Role | Use for |
| --- | --- |
| `background` / `foreground` | Page base and default text |
| `card` / `card-foreground` | Raised panels — the auth card, dashboard cards |
| `primary` / `primary-foreground` | The one main action on a screen |
| `secondary`, `muted` | Supporting fills; `muted-foreground` for quiet text |
| `accent` | The soft wash behind the auth page; hover tints |
| `destructive` | Delete and other irreversible actions, and error text |
| `positive` / `positive-foreground` | Task state: a habit going well |
| `caution` / `caution-foreground` | Task state: needs you today — due, overdue, slipping |
| `border`, `input`, `ring` | Edges and focus rings |
| `chart-1` … `chart-5` | Series colour, in that order |

Reference values, light theme:

| Token | Value | C |
| --- | --- | --- |
| `--background` | `oklch(0.9846 0.0034 286.15)` | 0.003 |
| `--foreground` | `oklch(0.3035 0.0242 282.42)` | 0.024 |
| `--primary` | `oklch(0.5224 0.0812 288.03)` | 0.081 |
| `--muted-foreground` | `oklch(0.5516 0.0228 284.74)` | 0.023 |
| `--border` | `oklch(0.9268 0.0072 285.96)` | 0.007 |
| `--destructive` | `oklch(0.5788 0.1394 25.5)` | 0.139 |
| `--positive` | `oklch(0.7262 0.0812 165)` | 0.081 |
| `--caution` | `oklch(0.8124 0.0862 78)` | 0.086 |

### Task-state colours

`--positive` (sage) and `--caution` (soft amber) exist for one job: telling a
glance at the tracker what is going well and what wants attention. They are
the only colours outside the violet family besides `--destructive`, and they
stay under the chroma ceiling like everything else.

They are **tints, not paint.** A card's side strip uses them at 25–30%
(`bg-positive/25`, `bg-caution/30`); only the small control inside the strip
is filled, with its `-foreground` pair for contrast. They never colour text on
a card, and they are not for general success or warning messages — errors stay
`destructive`, confirmations stay quiet.

**Priority has no colour.** It was tried as a strip colour and dropped: it
competed with task state for the same strip. Priority is shown as a flag and
its name on the card, and nowhere else.

**To de-emphasise something, drop chroma — never reach for grey.** A neutral
grey next to these violets reads as a rendering bug. `--muted` at C=0.006 is
effectively grey but still carries the hue.

### Contrast

Measured, not estimated. Every pair below clears WCAG AA:

| Pair | Light | Dark |
| --- | --- | --- |
| `foreground` on `background` | 12.9:1 | 14.4:1 |
| `muted-foreground` on `card` | 4.8:1 | 6.0:1 |
| `primary-foreground` on `primary` | 5.5:1 | 7.3:1 |
| `destructive` on `card` | 4.6:1 | 4.9:1 |
| `positive-foreground` on `positive` | 7.0:1 | 8.2:1 |
| `caution-foreground` on `caution` | 7.3:1 | 9.9:1 |
| `muted-foreground` as a checkbox border on `card` | 4.8:1 | 6.0:1 |
| `muted-foreground` as a checkbox border on `card` | 4.8:1 | 6.0:1 |

`--muted-foreground` is the tightest at 4.6–4.8:1. It has no headroom, so it
must not be lightened further, and any new quiet-text colour needs measuring
before it ships.

---

## 3. Theming

Dark mode is the `.dark` class on `<html>`. The user picks **Light, System or
Dark** from [`ThemeToggle`](../src/components/ThemeToggle.tsx), shown top-right
on the auth page and in the home header. The choice is stored in
`localStorage` under `cadence-theme`; "System" follows `prefers-color-scheme`
and keeps following it live.

Two pieces apply it, and they must agree:

- An inline script in [`index.html`](../index.html) sets the class **before
  first paint**. Deferring that to React would flash the wrong theme on load.
- [`ThemeProvider`](../src/lib/theme.tsx) owns it from then on.

The storage key and the precedence (stored choice, else OS) live in both.
Change one, change the other.

**Every app colour must be defined twice — `:root` and `.dark`.** A token
defined once silently fails in the other theme.

---

## 4. Typography

**Montserrat**, self-hosted at `public/fonts/montserrat-latin-variable.woff2`
and declared with `@font-face` in [`src/index.css`](../src/index.css) at
weights 400/500/600 with `display=swap`. Those rules are load-bearing:
`--font-sans` names Montserrat but does not fetch it, so removing them
silently drops the whole product to a system fallback.

It was on Google Fonts until the load chain showed the cost — document, then
`fonts.googleapis.com` for a stylesheet, then `fonts.gstatic.com` for the
file, 900ms before text could paint in its real face. Self-hosted it is one
same-origin request, preloaded from [`index.html`](../index.html) because a
font declared in CSS is discovered a round trip too late, and the service
worker precaches it — so the app reads correctly offline rather than falling
back to a system sans.

**700 is not loaded**, which is what makes the rule below enforceable rather
than advisory: `font-bold` now renders as a synthesised weight, not Montserrat
Bold. One file covers 400–600; Google returns the same URL for every weight,
which it only does for a variable font.

Montserrat is geometric and gets shouty above 600. The system stops at 600 for
headings and 500 for emphasis; **do not use 700+ for UI text.**

| Context | Classes |
| --- | --- |
| Wordmark | `font-semibold text-lg tracking-tight` |
| Page/card title | `font-semibold text-xl tracking-tight` |
| Column heading | `font-semibold text-lg tracking-tight` |
| Column filter tabs | `text-xs` (the primitive's default is `text-sm`) |
| Task title on a card | `font-medium text-base leading-6` |
| Card meta (streak, due date) | `text-xs text-muted-foreground` |
| Field label | `font-medium text-sm` |
| Auth input text | `text-base` at every width (see §6) |
| Button | `font-medium text-sm` |
| Body | `text-sm` |
| Secondary text | `text-sm text-muted-foreground leading-relaxed` |

`leading-relaxed` on prose is part of the calm: tight leading on explanatory
text is what makes a form feel dense.

---

## 5. Shape, depth and spacing

- **Radius** derives from `--radius: 0.75rem`: `radius-sm` (−4px), `radius-md`
  (−2px), `radius-lg` (=), `radius-xl` (+4px). Inputs and buttons use
  `rounded-lg`, cards `rounded-xl`. The softer corner is doing real work here —
  it is most of the difference between "professional" and "severe".
- **Shadows** are one family, `shadow-2xs` through `shadow-2xl`, all two-layer
  (a tight contact shadow plus a wide diffuse one) cast straight down in
  `--shadow-color`, a blue-violet rather than black. Opacities top out at 0.18.
  Do not write a custom `box-shadow`. The auth card uses `shadow-sm`; depth
  here comes from the border, not the shadow.
- **Spacing** is the Tailwind 0.25rem scale. In a form, `gap-2` binds a label to
  its input, `gap-4` separates fields, `gap-6` separates blocks. Keeping those
  three steps distinct is what makes grouping legible without dividers.

---

## 6. Control sizing

The shadcn primitives in `src/components/ui/` are **compact by default** —
`Button` and `Input` are `h-8`. That suits the dense app surface behind the
login wall and is too tight for auth, where controls are `h-11` and full width.

Auth overrides sizing at the call site rather than forking the primitive — see
[`AuthField`](../src/components/auth/AuthField.tsx) and
[`AuthSubmit`](../src/components/auth/AuthSubmit.tsx). Primitives stay
regenerable by the shadcn CLI; the auth look lives in the wrappers.

**Auth text is 16px at every width, not just below `md`.** The primitive is
`text-base md:text-sm`; auth overrides both halves. 14px in a 44px field
leaves it looking under-filled, and a password mask at 14px is a row of ~4px
dots — Montserrat's bullet is a small glyph, and the mask has no word shapes
to help it read. The password field also spreads to `tracking-[0.18em]` once
it has content, so the dots can be counted; the placeholder is words rather
than bullets, so the spacing is held back until there is something to space.

Beware the merge when overriding a responsive default: `cn("text-base
md:text-sm", "text-sm")` keeps **both**, pinning every width to 14px. Override
the modifier you mean — `md:text-base` — or the variant you left alone wins
from `md` up.

### On a phone

**The base screen is 320px** — an iPhone SE, first generation. Everything is
laid out for that width first and allowed to relax upwards; there is no
narrower case to design for.

The columns follow `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`: one on a
phone, two on a tablet with the third wrapping under them, three once all
three fit. Two things change with the single column:

- **The card gives its title room back.** Strips go `w-12` and the body
  `px-3`, against `w-14` / `px-4` from `sm` up. At 320px a habit's two strips
  and its padding left the title 96px, which wrapped a four-word habit onto
  three lines.
- **Columns size to their contents.** The `28rem` floor applies from `sm`
  only: stacked, three empty columns meant scrolling three empty screens to
  reach To-dos.
- **The header is width-budgeted, not wrapped.** It has to hold the wordmark,
  a status chip, a three-way theme toggle and an avatar, which comes to 379px
  — more than the 288px a 320px screen offers, so it used to wrap onto two
  rows. Two things give way instead, in order of how little they cost:

  | | `<400px` | `400–639px` | `≥640px` |
  | --- | --- | --- | --- |
  | Wordmark | mark only | mark + name | mark + name |
  | Offline chip | icon (+ count) | icon (+ count) | full words |

  Both hide their text with `sr-only`, never `hidden`, so the `h1` still reads
  "Cadence" and the live region still announces the full sentence at every
  width. That leaves 62px spare at 320px and 49px at 400px. **Anything new in
  the header has to come out of that budget** — or replace something.

- **The toolbar takes two rows.** Search spans the first on its own; Tags and
  **Add task** share the second, keeping find-on-the-left and make-on-the-right
  within that row. Letting the three wrap naturally put Search and Tags
  together and stranded Add task alone on a row, which read as a mistake.

**Every control a finger uses gets 44px, and most of them do it invisibly.**
`tap-target` in [`src/index.css`](../src/index.css) lays a 44px box over a
control's centre on coarse pointers only, so the habit buttons, the checkbox,
the ⋮ button and the alert's dismiss keep the compact sizing the dense surface
wants while the thumb gets the area Apple asks for. Apply it only where 44px
of clearance actually exists — overlapping hit boxes on adjacent controls are
worse than a small target.

The checkbox does **not** carry it: the `Checkbox` primitive already expands
its own hit area with `after:-inset-x-3 after:-inset-y-2`, which at the
tracker's `size-7` is 52×44 before anything is added. Check a primitive for
that pattern before reaching for `tap-target`; two stacked hit layers help
nobody.

Where growing the control costs nothing, it grows instead: the toolbar's
search, **Tags** and **Add task**, and each column's add field, are `h-11`
below `sm` and compact above it.

**The theme toggle is the deliberate exception** — its segments stay 28px.
Three 44px segments plus the wordmark and the avatar do not fit one 320px row,
and a header that wraps to two rows costs every screen more than a rarely used
control costs a thumb. 28px still clears the 24px WCAG 2.5.8 floor.

**Inputs stay `text-base` below `md`.** iOS zooms the page when a field under
16px takes focus, and never zooms back out. The `Input` primitive already
carries `text-base md:text-sm`; keep it that way.

---

## 7. Forms and validation

Rules live in [`src/lib/validation.ts`](../src/lib/validation.ts); Supabase
error codes are translated in
[`src/lib/auth-errors.ts`](../src/lib/auth-errors.ts). Components never show a
raw server message they could have translated.

- **Our messages, not the browser's.** Forms set `noValidate`; native bubbles
  differ per browser and can't be styled.
- **Errors sit under their field** in `text-destructive`, linked by
  `aria-describedby`. Setting `aria-invalid` is enough to turn the input's
  border and ring destructive — the primitive already styles it.
- **Don't scold early.** A field validates on blur only if something was typed,
  on submit always, and live on every keystroke once it has an error or the
  form has been submitted — so fixing a mistake clears it immediately.
- **Show requirements before they're failed.** The sign-up password checklist is
  visible from the start in `muted-foreground`; met rules go to `foreground`
  with a check, unmet rules turn `destructive` only after a submit. It
  deliberately does not use `--positive`: that token means task state, and
  contrast alone carries "met".
- **Say a thing once.** When a hint already explains the error, mark the field
  `invalid` without repeating it as a sentence.
- **Move focus to the first invalid field**, after the re-render commits — see
  [`useFocusRequest`](../src/hooks/useFocusRequest.ts). Focusing
  inline fails silently while the field is still `disabled` from a request.
- **Never reveal which credential was wrong.** Sign-in says "Incorrect email or
  password", matching Supabase's own refusal to confirm an account exists.

---

## 8. The tracker

Three columns — Habits, Dailies, To-dos — each built from
[`TaskColumn`](../src/components/tracker/TaskColumn.tsx): a heading with a
count badge, `line`-variant tabs as filters, an add input, the list, and a
standing explainer at the foot of the column. On `lg` they sit side by side
and fill the viewport height; below that they stack.

- **The header** holds the wordmark, the theme toggle and the account avatar,
  plus the offline chip when there is something to say. The wordmark is the
  page's `h1` here (`<Wordmark heading />`) — the column headings are `h2`, so
  without it the tracker would start at level two. On the auth pages the card
  titles itself, so the wordmark stays a `div` rather than making a second
  `h1`. The avatar is the
  user's uploaded photo, failing that one their
  sign-in provides (Google), failing both their initial on `secondary`. It
  opens a popover, not a menu (it is mostly information): a larger avatar,
  name, the full email on one line — the panel is `w-max`, sized to it, and
  wraps only past the screen width, since showing it is the point — then the
  photo controls, then Sign out.
- **The offline chip** ([`OfflineIndicator`](../src/components/OfflineIndicator.tsx))
  sits before the theme toggle: an icon and the word *Offline* on `secondary`,
  at `h-8` so it lines up with the controls beside it. It also counts writes
  the outbox is holding — *Offline · 3 waiting*, or just *3 waiting* once the
  connection is back and they are going out. **Below `sm` it loses its
  words**, keeping the icon and, if there is one, a bare count; see the header
  budget under §6. See §9 for why it is neither
  `destructive` nor `caution`.
- **The photo controls** are a bordered band between the identity block and
  Sign out: an `outline` **Add photo** / **Change photo**, and a muted `ghost`
  **Remove** shown only when there is a photo to remove. Removing a photo is
  reversible — the image re-uploads — so it is not `destructive` red, the same
  reasoning that keeps Clear all filters a plain ghost button. Errors appear
  under the buttons in `destructive`, in a live region that is always rendered
  and collapses with `empty:hidden`. Buttons disable while a request is in
  flight and say what they are doing ("Saving…"), matching the
  confirmed-not-optimistic rule the cards follow. The controls are absent
  entirely until the tracker has loaded, since there is no profile to edit yet.
- **Choosing a photo is not uploading it.** A valid file replaces the large
  avatar with its preview and the band's buttons become a `primary` **Save
  photo** and a `ghost` **Cancel** — so the confirmation is of something the
  user can see rather than a filename, and a mistaken pick costs nothing. A
  rejected file never reaches the preview: it shows its reason in the live
  region and leaves any existing choice alone. A failed save keeps the preview
  up so Save can be pressed again without re-picking.
- **The toolbar** sits above the columns, not in the header: Search and Tags on
  the left find things, **Add task** on the right makes them. The header holds
  only the wordmark, theme toggle and Sign out. Add task is the page's one
  `primary` button; its menu uses the same icons as each column's explainer.
- **Create and edit are one form** — `TaskForm` in
  [`TaskEditDialog`](../src/components/tracker/TaskEditDialog.tsx) — so they
  cannot drift. They differ only in where values start, the title ("Create" /
  "Edit"), the submit label, the header band (neutral when creating, the card's
  tone when editing) and the footer (a repeat of Create, or "Delete this …").
  Create is disabled until there is a title; focus opens in Title.
- **The badge counts what still wants attention** — dailies left today, open
  to-dos — not the total. Habits have no "done", so theirs is the total.
- **Cards** ([`TaskCard`](../src/components/tracker/TaskCard.tsx)) have a
  control strip on the left, an optional one on the right, and a body that is
  one real button opening the editor. Controls sit beside the body, never in
  it: interactive elements nested in a button are invalid.
- **Strip tone** follows task state: a strong habit `positive`, a weak habit or
  an unfinished due daily or overdue to-do `caution`, everything else `muted`.
  A habit direction the task doesn't track shows an outlined placeholder that
  is `aria-hidden`, not a disabled button.
- **One alignment line.** The title's first line is centred 24px from the card
  top (12px padding + half a 24px line), and every strip control is centred on
  it: a 32px habit button from 8px down, a 28px checkbox from 10px down. Align
  to the first line, not the card's middle, so multi-line titles stay right.
- **Hover or focus lifts a card**: its border goes to `ring/70` and a ⋮
  **Options** button appears top-right (with an `Options` tooltip). The button
  is `opacity-0`, never `hidden`, so it stays in the tab order and shows on
  focus; on touch screens (`hover: none`), where nothing can hover, it is
  always shown. Tailwind v4 already limits `hover:` to hover-capable devices.
- **The ⋮ menu** is Edit · Share · To top · To bottom · Delete, with Delete as
  the menu's `destructive` item behind a separator. **Share** opens the
  system's own share sheet through the Web Share API, and where there is none
  — most desktop browsers — copies to the clipboard instead and says so in the
  column, quietly. What it sends is one line of what the card already shows:
  the title, plus a habit's taps today, a daily's streak, or a to-do's due
  date. Never a note, a tag or anything the card keeps to itself. Dismissing
  the sheet is a decision, not an error, so nothing follows it — and nothing
  is copied behind the user's back either. A move that would do nothing —
  To top on the first card — is disabled, not hidden.
- **The editor** has a header band tinted with the card's own tone (the same
  `STRIP_TONE`), holding the title, Cancel and Save, and the Title and Notes
  fields on `bg-card`. Below it: the type's own settings — Positive/Negative
  toggles for a habit (at least one must stay on), the schedule for a daily,
  the due date for a to-do — then Priority and Tags. "Delete this …" sits
  alone in the footer.
- **Tags in the editor pick from existing tags only.** Creating, renaming and
  deleting tags happens in one place, the Tags panel, so the list has a single
  source of truth.
- **Priority** shows on a card only when set, as a flag and its name; the top
  two levels (essential, urgent) in `foreground`, the rest muted. It adds no
  colour.
- **Checkboxes stay square.** Use the primitive's own radius — at this size our
  larger radius turns a checkbox into a circle, which reads as a radio. Their
  border is `muted-foreground` on cards; the primitive's default `input`
  border falls below the 3:1 a control boundary needs.
- **Writes are confirmed, not optimistic.** A card fades to 60% and its
  controls disable while its request is in flight; the screen only changes once
  the database has accepted the change. **Except when the network is
  unreachable**: the change is then kept in the outbox and shown as done, and
  the header chip counts what is waiting. The rule bends for a connection that
  will come back, never for a database that said no — a refused write still
  fails in its column, in red.
- **Offline, the app opens to what it last showed.** A failed refresh with a
  snapshot on screen produces no error at all: the chip in the header already
  says the connection is gone, and a red alert over tasks the user can still
  work with would be noise. The error screen is only for having nothing.
- **Confirmations are not alerts.** The same live region also carries a quiet
  `secondary` notice — "Copied to clipboard." — which clears itself after a
  few seconds. Red is for something the user did that failed; a confirmation
  has been read by the time it matters and should not leave them something to
  tidy up.
- **Errors stay in their column**, in a dismissible `destructive` alert inside
  an always-present live region. The add input keeps its text on failure — the
  request failed, not the typing. The editor shows its errors inline.
- **Deleting always confirms**, in one shared
  [`DeleteTaskDialog`](../src/components/tracker/DeleteTaskDialog.tsx) used by
  both the ⋮ menu and the editor, so the wording cannot drift. Its button is a
  plain `Button`, not `AlertDialogAction`, because the action closes the dialog
  before the delete has succeeded or failed.
- **The Tags panel** is a `Popover`, not a `DropdownMenu` — menus swallow
  typing for keyboard navigation, and edit mode needs text fields. It has two
  modes. *Filter*: a two-column checkbox grid; ticks apply live, **Cancel**
  restores the selection from when the panel opened, and **Clear all filters**
  clears the search too. *Edit tags*: every tag becomes a field with a remove
  button, with a **New tag** field last where Enter adds to the list. Nothing
  is written until **Save edits**; Cancel or closing the panel discards it all.
  Clearing filters is not destructive, so it is a plain ghost button, not
  `destructive` red.
- Controls here are the compact primitives (`h-8`–`h-10`): this is the dense,
  daily surface.

---

## 9. When a section breaks

Three different failures, three different treatments, and they are not
interchangeable:

- **A request failed** — the data never arrived, the write was refused. These
  are values, not exceptions: the tracker's `Result` type carries the message
  to a `destructive` alert inside the column, or inline in a form. The UI is
  intact; only the data is missing.
- **The connection is gone** — nothing has failed *yet*, but everything is
  about to. The offline chip in the header states it once, quietly, on
  `secondary`. It is not `destructive`, because the user did nothing that
  failed and red here would outrank the real refusals the columns raise; it is
  not `caution`, because that token means task state and would read as "this
  daily is due". It says only what the browser knows: `navigator.onLine` is
  trustworthy when false and merely hopeful when true, so the chip appears on
  a certain offline and never claims the reverse.
- **A render threw** — a component hit something it could not draw. React
  unmounts the whole tree unless a boundary catches it, so
  [`ErrorBoundary`](../src/components/ErrorBoundary.tsx) wraps each section
  that can fail alone: the account menu, the toolbar, and each of the three
  columns separately. A bad row in To-dos costs you To-dos.

The fallback is deliberately plain — a dashed `border` box, the section named
in `foreground`, one `muted-foreground` line, and an `outline` **Try again**.
It uses no `destructive` red: red is for a thing the user did that failed, and
a crash is the app's fault, not theirs. **The raw error is never shown** — it
is written for a developer and can carry internals. It goes to the console
with its component stack.

**Try again remounts, it does not just re-render.** The boundary bumps a key
so the subtree is rebuilt from scratch; clearing the error alone would restore
the same state that threw and fail identically.

The header's boundary uses the `inline` variant — one quiet row with a small
Try again — because a card in the middle of the bar would be louder than the
control it replaced.

### Not a failure: the update prompt

A new build **waits** rather than activating under the user
(`registerType: "prompt"`), and
[`UpdateToast`](../src/components/UpdateToast.tsx) offers it: "New version
available", a `primary` **Refresh**, and a `ghost` **Later**. It sits at the
bottom of the screen on `card` — full width on a phone, bottom-right from
`sm` — in a live region that is always rendered and collapses with
`empty:hidden`, like every other status message here.

It asks because this app holds unsaved state: a half-typed task, a dialog
mid-edit, an outbox still draining. Reloading the page without asking would
throw that away, which is exactly the thing the offline work exists to
prevent.

---

## 10. Motion

There is **no decorative animation.** The only motion is the primitives' own
state transitions on hover, focus and press.

**The dialogs are lazily loaded, and stay mounted once opened.** They are a
fifth of the tracker's bundle and none is on screen when it loads, so they are
split out — but they close with `animate-out`, and a dialog rendered only
while its task is non-null unmounts the instant it closes and never plays it.
Render them behind a sticky "has been opened" flag, never behind the open
state itself.

`@layer base` carries a `prefers-reduced-motion: reduce` block that collapses
all animation and transition durations to ~0. It uses `!important` and has a
scoped `biome-ignore` explaining why: a reduced-motion reset that loses the
cascade silently fails to suppress motion.

---

## 11. Working rules

1. **Tokens, not values.** No hex, no `rgb()`, no ad-hoc `box-shadow`.
2. **Semantic name over appearance.** `text-muted-foreground`, not
   `text-neutral-500` — the first survives a theme change.
3. **Both themes, always.** A new colour means two definitions.
4. **Stay under C = 0.09.** Anything more saturated needs a reason, and
   `--destructive` is the only standing exception.
5. **Compose with `cn()`** from `@/lib/utils`, so later classes win.
6. **Measure contrast** for any new foreground/background pair. AA (4.5:1) is
   the floor.
7. **Decorative elements get `aria-hidden`** — the accent wash on the auth page
   is a div with no meaning.
8. **Status messages need a live region that already exists.** Render the
   `aria-live` element unconditionally and fill its text later; a region added
   at the same moment as its text is announced unreliably. It collapses with
   `empty:hidden` so it reserves no space when silent.
9. **Focus is never removed.** Primitives ship `focus-visible:ring-3`;
   overrides may recolour that ring, never drop it.
