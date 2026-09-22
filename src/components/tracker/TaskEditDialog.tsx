import { ChevronDown, Minus, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { PRIORITY_LABEL } from "@/components/tracker/cards";
import {
  DeleteTaskDialog,
  TASK_KIND,
} from "@/components/tracker/DeleteTaskDialog";
import { STRIP_TONE, type Tone } from "@/components/tracker/TaskCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Tag, Task, TaskType } from "@/lib/tasks/api";
import type { Tracker } from "@/lib/tasks/useTracker";
import { cn } from "@/lib/utils";
import type { Enums, TablesUpdate } from "@/types/database.types";

const WEEKDAYS = [
  { day: 0, short: "S", long: "Sunday" },
  { day: 1, short: "M", long: "Monday" },
  { day: 2, short: "T", long: "Tuesday" },
  { day: 3, short: "W", long: "Wednesday" },
  { day: 4, short: "T", long: "Thursday" },
  { day: 5, short: "F", long: "Friday" },
  { day: 6, short: "S", long: "Saturday" },
];

// "none" stands in for a null priority: Select values must be strings.
const PRIORITY_ITEMS = [
  { value: "none", label: "None" },
  ...(
    Object.entries(PRIORITY_LABEL) as [Enums<"priority_level">, string][]
  ).map(([value, label]) => ({ value, label })),
];

const DESCRIPTION: Record<Task["type"], string> = {
  habit: "Habits have no schedule — log them whenever they happen.",
  daily: "Dailies repeat on a schedule you choose.",
  todo: "To-dos are done once. A due date is optional.",
};

type Errors = Partial<
  Record<"title" | "startDate" | "days" | "interval", string>
>;

/** Select values are strings; "none" stands for a null priority. */
const asPriority = (value: string): Enums<"priority_level"> | null =>
  value === "none" ? null : (value as Enums<"priority_level">);

type Mode =
  | { kind: "edit"; task: Task; tone: Tone }
  | { kind: "create"; type: TaskType };

/** The dialog frame both modes share. Focus lands in Title on open. */
function TaskDialogShell({
  open,
  onClose,
  titleRef,
  children,
}: {
  open: boolean;
  onClose: () => void;
  titleRef: React.RefObject<HTMLInputElement | null>;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton={false}
        initialFocus={titleRef}
        className="max-h-[calc(100svh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-lg"
      >
        {children}
      </DialogContent>
    </Dialog>
  );
}

/** Edit an existing habit, daily or to-do. */
function TaskEditDialog({
  task,
  tone,
  tracker,
  onClose,
}: {
  task: Task | null;
  /** The card's state tone; the header band wears it, like the card's strips. */
  tone: Tone;
  tracker: Tracker;
  onClose: () => void;
}) {
  const titleRef = useRef<HTMLInputElement>(null);
  return (
    <TaskDialogShell open={task !== null} onClose={onClose} titleRef={titleRef}>
      {/* key: a fresh form — and fresh state — for each task opened. */}
      {task && (
        <TaskForm
          key={task.id}
          mode={{ kind: "edit", task, tone }}
          tracker={tracker}
          titleRef={titleRef}
          onClose={onClose}
        />
      )}
    </TaskDialogShell>
  );
}

/** Create a habit, daily or to-do — the same form, starting empty. */
function TaskCreateDialog({
  type,
  tracker,
  onClose,
}: {
  /** Which kind to create; null keeps the dialog closed. */
  type: TaskType | null;
  tracker: Tracker;
  onClose: () => void;
}) {
  const titleRef = useRef<HTMLInputElement>(null);
  return (
    <TaskDialogShell open={type !== null} onClose={onClose} titleRef={titleRef}>
      {type && (
        <TaskForm
          key={type}
          mode={{ kind: "create", type }}
          tracker={tracker}
          titleRef={titleRef}
          onClose={onClose}
        />
      )}
    </TaskDialogShell>
  );
}

/**
 * The one form behind both dialogs. Create and edit differ only in where the
 * values start, what Save calls, and the footer — so the two can't drift.
 */
function TaskForm({
  mode,
  tracker,
  titleRef,
  onClose,
}: {
  mode: Mode;
  tracker: Tracker;
  titleRef: React.RefObject<HTMLInputElement | null>;
  onClose: () => void;
}) {
  const task = mode.kind === "edit" ? mode.task : null;
  const type = mode.kind === "edit" ? mode.task.type : mode.type;
  const creating = mode.kind === "create";

  const [title, setTitle] = useState(task?.title ?? "");
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [tracksPlus, setTracksPlus] = useState(task?.direction !== "negative");
  const [tracksMinus, setTracksMinus] = useState(
    task?.direction !== "positive",
  );
  const [priority, setPriority] = useState<string>(task?.priority ?? "none");
  const [frequency, setFrequency] = useState<Enums<"frequency_type">>(
    task?.frequency ?? "daily",
  );
  const [startDate, setStartDate] = useState(task?.start_date ?? tracker.today);
  const [days, setDays] = useState<number[]>(task?.repeat_days ?? []);
  const [everyN, setEveryN] = useState(String(task?.every_n_days ?? 2));
  const [dueDate, setDueDate] = useState(task?.due_date ?? "");
  const [tagIds, setTagIds] = useState<string[]>(
    task?.task_tags.map((link) => link.tag_id) ?? [],
  );

  const [errors, setErrors] = useState<Errors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const kind = TASK_KIND[type];

  function validate(): Errors {
    const next: Errors = {};
    if (!title.trim()) next.title = "Give it a name.";
    if (type === "daily") {
      if (!startDate) next.startDate = "Choose a start date.";
      if (frequency === "weekdays" && days.length === 0) {
        next.days = "Pick at least one day.";
      }
      const n = Number(everyN);
      if (frequency === "every_n_days" && (!Number.isInteger(n) || n < 1)) {
        next.interval = "Use a whole number, 1 or more.";
      }
    }
    return next;
  }

  /** Everything but the title, in the shape both insert and update take. */
  function buildFields() {
    const fields: Omit<TablesUpdate<"tasks">, "title"> = {
      notes: notes.trim() || null,
      priority: asPriority(priority),
    };
    if (type === "habit") {
      fields.direction =
        tracksPlus && tracksMinus
          ? "both"
          : tracksPlus
            ? "positive"
            : "negative";
    }
    if (type === "daily") {
      fields.frequency = frequency;
      fields.start_date = startDate;
      // Clear whichever schedule field the chosen frequency doesn't use, so a
      // switch from weekdays to every-n-days leaves no stale day list behind.
      fields.repeat_days =
        frequency === "weekdays" ? days.toSorted((a, b) => a - b) : null;
      fields.every_n_days =
        frequency === "every_n_days" ? Number(everyN) : null;
    }
    if (type === "todo") fields.due_date = dueDate || null;
    return fields;
  }

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) {
      document
        .getElementById(next.title ? "task-title" : "task-start")
        ?.focus();
      return;
    }

    setSaving(true);
    setSaveError(null);
    const result = task
      ? await tracker.editTask(
          task.id,
          { title: title.trim(), ...buildFields() },
          tagIds,
        )
      : await tracker.addTask(type, title, buildFields(), tagIds);
    setSaving(false);
    if (result.error) setSaveError(result.error);
    else onClose();
  }

  const busy = saving || (task ? tracker.pendingIds.has(task.id) : false);
  // Create waits for a title, like the reference; edit always allows Save and
  // explains what's missing instead, since the task already has a title.
  const submitDisabled = busy || (creating && !title.trim());
  const submitLabel = creating
    ? saving
      ? "Creating…"
      : "Create"
    : saving
      ? "Saving…"
      : "Save";

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col">
      {/* ── Header band: what the task is ── */}
      <div
        className={cn(
          "flex flex-col gap-5 px-6 pt-5 pb-6",
          STRIP_TONE[mode.kind === "edit" ? mode.tone : "neutral"],
        )}
      >
        <div className="flex items-center justify-between gap-4">
          <DialogTitle className="font-semibold text-xl tracking-tight">
            {creating ? "Create" : "Edit"} {kind}
          </DialogTitle>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitDisabled}>
              {submitLabel}
            </Button>
          </div>
        </div>
        <DialogDescription className="sr-only">
          {DESCRIPTION[type]}
        </DialogDescription>

        <Field id="task-title" label="Title" required error={errors.title}>
          <Input
            id="task-title"
            ref={titleRef}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={creating ? "Add a title" : undefined}
            aria-required="true"
            aria-invalid={errors.title ? true : undefined}
            aria-describedby={errors.title ? "task-title-error" : undefined}
            className="h-10 border-transparent bg-card shadow-xs"
          />
        </Field>

        <Field id="task-notes" label="Notes">
          <Textarea
            id="task-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Add notes"
            rows={3}
            className="border-transparent bg-card shadow-xs"
          />
        </Field>
      </div>

      {/* ── Body: how it behaves ── */}
      <div className="flex flex-col gap-6 px-6 py-6">
        {type === "habit" && (
          <DirectionToggles
            plus={tracksPlus}
            minus={tracksMinus}
            onPlus={setTracksPlus}
            onMinus={setTracksMinus}
          />
        )}

        {type === "daily" && (
          <DailySchedule
            startDate={startDate}
            onStartDate={setStartDate}
            frequency={frequency}
            onFrequency={setFrequency}
            days={days}
            onDays={setDays}
            everyN={everyN}
            onEveryN={setEveryN}
            errors={errors}
          />
        )}

        {type === "todo" && (
          <Field id="task-due" label="Due date">
            <div className="flex items-center gap-2">
              <Input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="h-9 w-44"
              />
              {dueDate && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setDueDate("")}
                >
                  Clear
                </Button>
              )}
            </div>
          </Field>
        )}

        <div className="flex flex-col gap-2">
          <Label id="task-priority-label">Priority</Label>
          <Select
            value={priority}
            onValueChange={(value) => setPriority(value ?? "none")}
            items={PRIORITY_ITEMS}
          >
            <SelectTrigger
              aria-labelledby="task-priority-label"
              className="h-9 w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <TagSelect
          tags={tracker.data?.tags ?? []}
          selected={tagIds}
          onChange={setTagIds}
        />

        <p aria-live="polite" className="text-destructive text-sm empty:hidden">
          {saveError}
        </p>
      </div>

      {/* ── Footer: create repeats its action; edit keeps delete apart ── */}
      <div className="flex justify-center border-border border-t px-6 py-3">
        {task ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setConfirmingDelete(true)}
            disabled={busy}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 aria-hidden="true" />
            Delete this {kind}
          </Button>
        ) : (
          <Button type="submit" variant="outline" disabled={submitDisabled}>
            {submitLabel}
          </Button>
        )}
      </div>

      {task && (
        <DeleteTaskDialog
          task={confirmingDelete ? task : null}
          onOpenChange={setConfirmingDelete}
          onDelete={tracker.removeTask}
          onDeleted={onClose}
        />
      )}
    </form>
  );
}

// ─── Habit: which directions it counts ──────────────────────────────────────

function DirectionToggles({
  plus,
  minus,
  onPlus,
  onMinus,
}: {
  plus: boolean;
  minus: boolean;
  onPlus: (on: boolean) => void;
  onMinus: (on: boolean) => void;
}) {
  const options = [
    {
      key: "plus",
      label: "Positive",
      Icon: Plus,
      on: plus,
      set: onPlus,
      other: minus,
    },
    {
      key: "minus",
      label: "Negative",
      Icon: Minus,
      on: minus,
      set: onMinus,
      other: plus,
    },
  ];
  return (
    <fieldset className="flex flex-col items-center gap-3">
      <legend className="sr-only">What this habit counts</legend>
      <div className="flex justify-center gap-10">
        {options.map(({ key, label, Icon, on, set, other }) => {
          // A habit must count something: the last one on can't be turned off.
          const locked = on && !other;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={on}
              aria-disabled={locked || undefined}
              title={
                locked
                  ? "A habit has to count at least one direction"
                  : undefined
              }
              onClick={() => !locked && set(!on)}
              className="group/toggle flex flex-col items-center gap-2 rounded-lg p-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span
                className={cn(
                  "flex size-12 items-center justify-center rounded-full transition-colors",
                  on
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground group-hover/toggle:text-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span
                className={cn(
                  "font-medium text-sm",
                  on ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-center text-muted-foreground text-xs leading-relaxed">
        Positive counts the good; negative counts the slips. Keep both on to
        count each way.
      </p>
    </fieldset>
  );
}

// ─── Daily: its schedule ────────────────────────────────────────────────────

function DailySchedule({
  startDate,
  onStartDate,
  frequency,
  onFrequency,
  days,
  onDays,
  everyN,
  onEveryN,
  errors,
}: {
  startDate: string;
  onStartDate: (value: string) => void;
  frequency: Enums<"frequency_type">;
  onFrequency: (value: Enums<"frequency_type">) => void;
  days: number[];
  onDays: (update: (current: number[]) => number[]) => void;
  everyN: string;
  onEveryN: (value: string) => void;
  errors: Errors;
}) {
  return (
    <>
      <Field id="task-start" label="Start date" error={errors.startDate}>
        <Input
          id="task-start"
          type="date"
          value={startDate}
          onChange={(event) => onStartDate(event.target.value)}
          aria-invalid={errors.startDate ? true : undefined}
          aria-describedby={errors.startDate ? "task-start-error" : undefined}
          className="h-9"
        />
      </Field>

      <ChoiceGroup
        legend="Repeats"
        name="frequency"
        value={frequency}
        onChange={onFrequency}
        options={[
          { value: "daily", label: "Every day" },
          { value: "weekdays", label: "On certain days" },
          { value: "every_n_days", label: "Every few days" },
        ]}
      />

      {frequency === "weekdays" && (
        <fieldset
          className="flex flex-col gap-2"
          aria-describedby={errors.days ? "task-days-error" : undefined}
        >
          <legend className="mb-2 font-medium text-sm">On these days</legend>
          <div className="flex gap-1.5">
            {WEEKDAYS.map(({ day, short, long }) => (
              <label key={day} title={long}>
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={days.includes(day)}
                  onChange={(event) =>
                    onDays((current) =>
                      event.target.checked
                        ? [...current, day]
                        : current.filter((d) => d !== day),
                    )
                  }
                />
                <span className="flex size-9 cursor-pointer items-center justify-center rounded-lg border border-border font-medium text-muted-foreground text-sm transition-colors hover:text-foreground peer-checked:border-transparent peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50">
                  <span aria-hidden="true">{short}</span>
                  <span className="sr-only">{long}</span>
                </span>
              </label>
            ))}
          </div>
          {errors.days && (
            <p id="task-days-error" className="text-destructive text-sm">
              {errors.days}
            </p>
          )}
        </fieldset>
      )}

      {frequency === "every_n_days" && (
        <Field
          id="task-everyN"
          label="Every how many days?"
          error={errors.interval}
        >
          <Input
            id="task-everyN"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={everyN}
            onChange={(event) => onEveryN(event.target.value)}
            aria-invalid={errors.interval ? true : undefined}
            aria-describedby={errors.interval ? "task-everyN-error" : undefined}
            className="h-9 w-28"
          />
        </Field>
      )}
    </>
  );
}

// ─── Tags: pick from the ones that already exist ────────────────────────────

/**
 * Attaches existing tags. Creating, renaming and deleting tags lives in one
 * place — the Tags panel in the header — so there's a single source of truth
 * for the list.
 */
function TagSelect({
  tags,
  selected,
  onChange,
}: {
  tags: Tag[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const chosen = tags.filter((tag) => selected.includes(tag.id));
  return (
    <div className="flex flex-col gap-2">
      <Label id="task-tags-label">Tags</Label>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-labelledby="task-tags-label"
          className="flex min-h-9 w-full items-center gap-2 rounded-lg border border-input bg-transparent py-1.5 pr-2 pl-2.5 text-left text-sm outline-none transition-colors hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        >
          <span className="flex min-w-0 flex-1 flex-wrap gap-1">
            {chosen.length === 0 ? (
              <span className="text-muted-foreground">Add tags…</span>
            ) : (
              chosen.map((tag) => (
                <span
                  key={tag.id}
                  className="rounded-full bg-secondary px-2 py-0.5 font-medium text-secondary-foreground text-xs"
                >
                  {tag.name}
                </span>
              ))
            )}
          </span>
          <ChevronDown
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {tags.length === 0 ? (
            <DropdownMenuItem disabled>
              No tags yet — make them from Tags in the header.
            </DropdownMenuItem>
          ) : (
            tags.map((tag) => (
              <DropdownMenuCheckboxItem
                key={tag.id}
                checked={selected.includes(tag.id)}
                onCheckedChange={(on) =>
                  onChange(
                    on
                      ? [...selected, tag.id]
                      : selected.filter((id) => id !== tag.id),
                  )
                }
              >
                {tag.name}
              </DropdownMenuCheckboxItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ─── Small form pieces ──────────────────────────────────────────────────────

function Field({
  id,
  label,
  required,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>
        {label}
        {required && (
          <span aria-hidden="true" className="-ml-1.5 text-muted-foreground">
            *
          </span>
        )}
      </Label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

/** A single-choice group on real radio inputs, drawn as a segmented control. */
function ChoiceGroup<V extends string>({
  legend,
  name,
  value,
  onChange,
  options,
}: {
  legend: string;
  name: string;
  value: V;
  onChange: (value: V) => void;
  options: { value: V; label: string }[];
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 font-medium text-sm">{legend}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <label key={option.value}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="peer sr-only"
            />
            <span className="flex h-9 cursor-pointer items-center rounded-lg border border-border px-3 text-muted-foreground text-sm transition-colors hover:text-foreground peer-checked:border-transparent peer-checked:bg-secondary peer-checked:font-medium peer-checked:text-secondary-foreground peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50">
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export { TaskCreateDialog, TaskEditDialog };
