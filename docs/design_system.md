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

**Montserrat**, loaded from Google Fonts in [`index.html`](../index.html) at
weights 400/500/600/700 with `display=swap`. That link is load-bearing:
`--font-sans` names Montserrat but does not fetch it, so removing the link
silently drops the whole product to a system fallback.

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

- **The header** holds the wordmark, the theme toggle and the account avatar —
  nothing else. The avatar is the user's photo when their sign-in provides one
  (Google), otherwise their initial on `secondary`. It opens a popover, not a
  menu (it is mostly information): a larger avatar, name, the full email on one
  line — the panel is `w-max`, sized to it, and wraps only past the screen
  width, since showing it is the point — and Sign out.
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
- **The ⋮ menu** is Edit · To top · To bottom · Delete, with Delete as the
  menu's `destructive` item behind a separator. A move that would do nothing —
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
  the database has accepted the change.
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

## 9. Motion

There is **no decorative animation.** The only motion is the primitives' own
state transitions on hover, focus and press.

`@layer base` carries a `prefers-reduced-motion: reduce` block that collapses
all animation and transition durations to ~0. It uses `!important` and has a
scoped `biome-ignore` explaining why: a reduced-motion reset that loses the
cascade silently fails to suppress motion.

---

## 10. Working rules

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
