import {
  CalendarDays,
  ChevronsRight,
  Flag,
  Minus,
  Plus,
  Repeat,
  Tag as TagIcon,
} from "lucide-react";
import { TaskCard, type Tone } from "@/components/tracker/TaskCard";
import { Checkbox } from "@/components/ui/checkbox";
import type { Task } from "@/lib/tasks/api";
import { formatDate } from "@/lib/tasks/dates";
import type { HabitStrength } from "@/lib/tasks/schedule";
import { cn } from "@/lib/utils";

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STRENGTH_TONE: Record<HabitStrength, Tone> = {
  strong: "positive",
  weak: "caution",
  neutral: "neutral",
};

export const PRIORITY_LABEL = {
  low: "Low",
  normal: "Normal",
  essential: "Essential",
  urgent: "Urgent",
} as const;

function TagCount({ task }: { task: Task }) {
  const count = task.task_tags.length;
  if (!count) return null;
  return (
    <span className="flex items-center gap-1">
      <TagIcon className="size-3.5" aria-hidden="true" />
      {count}
      <span className="sr-only">{count === 1 ? " tag" : " tags"}</span>
    </span>
  );
}

/** The priority, when set: a flag and its name. The top two levels read louder. */
function PriorityMark({ task }: { task: Task }) {
  if (!task.priority) return null;
  const loud = task.priority === "essential" || task.priority === "urgent";
  return (
    <span
      className={cn(
        "flex items-center gap-1",
        loud && "font-medium text-foreground",
      )}
    >
      <Flag className="size-3.5" aria-hidden="true" />
      <span className="sr-only">Priority: </span>
      {PRIORITY_LABEL[task.priority]}
    </span>
  );
}

/** The strip's checkbox. 28px from 10px down: centred on the title's first line. */
function StripCheckbox({
  checked,
  disabled,
  label,
  onToggle,
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  onToggle: (done: boolean) => void;
}) {
  return (
    <Checkbox
      checked={checked}
      onCheckedChange={(on) => onToggle(on === true)}
      disabled={disabled}
      aria-label={label}
      className="mt-0.5 size-7 border-muted-foreground bg-card dark:bg-card [&_svg]:size-5"
    />
  );
}

// ─── Habit ──────────────────────────────────────────────────────────────────

function TapButton({
  direction,
  tone,
  title,
  disabled,
  onTap,
}: {
  direction: "plus" | "minus";
  tone: Tone;
  title: string;
  disabled: boolean;
  onTap: () => void;
}) {
  const Icon = direction === "plus" ? Plus : Minus;
  return (
    <button
      type="button"
      onClick={onTap}
      disabled={disabled}
      aria-label={
        direction === "plus"
          ? `Log a good one for "${title}"`
          : `Log a slip for "${title}"`
      }
      className={cn(
        "flex size-8 items-center justify-center rounded-full outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
        tone === "positive" &&
          "bg-positive text-positive-foreground hover:bg-positive/85",
        tone === "caution" &&
          "bg-caution text-caution-foreground hover:bg-caution/85",
        tone === "neutral" &&
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}

/** Stands in for a direction this habit doesn't track. Not a control. */
function TapPlaceholder({ direction }: { direction: "plus" | "minus" }) {
  const Icon = direction === "plus" ? Plus : Minus;
  return (
    <span
      aria-hidden="true"
      className="flex size-8 items-center justify-center rounded-full border border-foreground/15 text-muted-foreground/60"
    >
      <Icon className="size-4" />
    </span>
  );
}

export function HabitCard({
  task,
  strength,
  plusToday,
  minusToday,
  pending,
  onTap,
  onOpen,
  menu,
}: {
  task: Task;
  strength: HabitStrength;
  plusToday: number;
  minusToday: number;
  pending: boolean;
  onTap: (direction: "plus" | "minus") => void;
  onOpen: () => void;
  menu: React.ReactNode;
}) {
  const tracksPlus = task.direction !== "negative";
  const tracksMinus = task.direction !== "positive";
  const tone = STRENGTH_TONE[strength];

  return (
    <TaskCard
      title={task.title}
      notes={task.notes}
      pending={pending}
      leftTone={tracksPlus ? tone : "neutral"}
      rightTone={tracksMinus ? tone : "neutral"}
      onOpen={onOpen}
      menu={menu}
      left={
        tracksPlus ? (
          <TapButton
            direction="plus"
            tone={tone}
            title={task.title}
            disabled={pending}
            onTap={() => onTap("plus")}
          />
        ) : (
          <TapPlaceholder direction="plus" />
        )
      }
      right={
        tracksMinus ? (
          <TapButton
            direction="minus"
            tone={tone}
            title={task.title}
            disabled={pending}
            onTap={() => onTap("minus")}
          />
        ) : (
          <TapPlaceholder direction="minus" />
        )
      }
      meta={
        <>
          <span className="mr-auto">
            <PriorityMark task={task} />
          </span>
          <TagCount task={task} />
          <span className="flex items-center gap-1 tabular-nums">
            <ChevronsRight className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Today: </span>
            {tracksPlus && <span>+{plusToday}</span>}
            {tracksPlus && tracksMinus && (
              <span aria-hidden="true" className="text-border">
                |
              </span>
            )}
            {tracksMinus && <span>−{minusToday}</span>}
          </span>
        </>
      }
    />
  );
}

// ─── Daily ──────────────────────────────────────────────────────────────────

export function describeSchedule(task: Task): string {
  switch (task.frequency) {
    case "daily":
      return "Every day";
    case "weekdays":
      return (task.repeat_days ?? [])
        .toSorted((a, b) => a - b)
        .map((day) => WEEKDAY_SHORT[day])
        .join(", ");
    case "every_n_days":
      return task.every_n_days === 1
        ? "Every day"
        : `Every ${task.every_n_days} days`;
    default:
      return "";
  }
}

export function DailyCard({
  task,
  dueToday,
  doneToday,
  streak,
  pending,
  onToggle,
  onOpen,
  menu,
}: {
  task: Task;
  dueToday: boolean;
  doneToday: boolean;
  streak: number;
  pending: boolean;
  onToggle: (done: boolean) => void;
  onOpen: () => void;
  menu: React.ReactNode;
}) {
  return (
    <TaskCard
      title={task.title}
      notes={task.notes}
      done={doneToday}
      pending={pending}
      leftTone={dueToday && !doneToday ? "caution" : "neutral"}
      onOpen={onOpen}
      menu={menu}
      left={
        <StripCheckbox
          checked={doneToday}
          disabled={pending}
          label={`Mark "${task.title}" done for today`}
          onToggle={onToggle}
        />
      }
      meta={
        <>
          <span className="mr-auto">
            <PriorityMark task={task} />
          </span>
          <TagCount task={task} />
          <span className="flex items-center gap-1">
            <Repeat className="size-3.5" aria-hidden="true" />
            {dueToday ? describeSchedule(task) : "Not due today"}
          </span>
          <span className="flex items-center gap-1 tabular-nums">
            <ChevronsRight className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Streak: </span>
            {streak}
          </span>
        </>
      }
    />
  );
}

// ─── To do ──────────────────────────────────────────────────────────────────

export function TodoCard({
  task,
  overdue,
  pending,
  onToggle,
  onOpen,
  menu,
}: {
  task: Task;
  overdue: boolean;
  pending: boolean;
  onToggle: (done: boolean) => void;
  onOpen: () => void;
  menu: React.ReactNode;
}) {
  const done = task.completed_at !== null;
  return (
    <TaskCard
      title={task.title}
      notes={task.notes}
      done={done}
      pending={pending}
      leftTone={overdue ? "caution" : "neutral"}
      onOpen={onOpen}
      menu={menu}
      left={
        <StripCheckbox
          checked={done}
          disabled={pending}
          label={`Mark "${task.title}" complete`}
          onToggle={onToggle}
        />
      }
      meta={
        task.due_date || task.task_tags.length || task.priority ? (
          <>
            {/* One left group, so date and flag sit together instead of
                each claiming the free space and floating mid-row. */}
            <span className="mr-auto flex items-center gap-3">
              {task.due_date && (
                <span
                  className={cn(
                    "flex items-center gap-1",
                    overdue && "font-medium text-foreground",
                  )}
                >
                  <CalendarDays className="size-3.5" aria-hidden="true" />
                  {overdue && "Overdue · "}
                  {formatDate(task.due_date)}
                </span>
              )}
              <PriorityMark task={task} />
            </span>
            <TagCount task={task} />
          </>
        ) : null
      }
    />
  );
}
