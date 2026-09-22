import { addDays, diffDays, type ISODate, weekdayOf } from "@/lib/tasks/dates";
import type { Tables } from "@/types/database.types";

type Task = Tables<"tasks">;
type LogStatus = Tables<"daily_logs">["status"];

export type Schedule = Pick<
  Task,
  "frequency" | "repeat_days" | "every_n_days" | "start_date"
>;

/** Whether a daily is scheduled on `date`. Nothing is due before it starts. */
export function isDueOn(task: Schedule, date: ISODate): boolean {
  if (!task.start_date || date < task.start_date) return false;

  switch (task.frequency) {
    case "daily":
      return true;
    case "weekdays":
      return (task.repeat_days ?? []).includes(weekdayOf(date));
    case "every_n_days": {
      const interval = Math.max(1, task.every_n_days ?? 1);
      return diffDays(task.start_date, date) % interval === 0;
    }
    default:
      return false;
  }
}

/**
 * Consecutive scheduled days completed, counting back from today.
 *
 * - Today counts if it is already done, but an unfinished today does not
 *   break the streak — the day is not over.
 * - Days the daily was not scheduled are skipped, not counted as misses.
 * - A `frozen` day holds the streak without adding to it.
 * - The walk stops at `windowDays`, the extent of the history loaded.
 */
export function dailyStreak(
  task: Schedule,
  statusByDate: ReadonlyMap<ISODate, LogStatus>,
  today: ISODate,
  windowDays = 90,
): number {
  let streak = 0;

  if (isDueOn(task, today) && statusByDate.get(today) === "done") {
    streak += 1;
  }

  for (let offset = 1; offset <= windowDays; offset += 1) {
    const date = addDays(today, -offset);
    if (task.start_date && date < task.start_date) break;
    if (!isDueOn(task, date)) continue;

    const status = statusByDate.get(date);
    if (status === "done") streak += 1;
    else if (status !== "frozen") break;
  }

  return streak;
}

export function isOverdue(
  todo: Pick<Task, "due_date" | "completed_at">,
  today: ISODate,
): boolean {
  return !todo.completed_at && !!todo.due_date && todo.due_date < today;
}

export type HabitStrength = "strong" | "weak" | "neutral";

/**
 * A habit's recent direction: more good taps than bad is strong, the reverse
 * weak. Measured over whatever window of logs the caller passes in.
 */
export function habitStrength(
  logs: readonly { direction: "plus" | "minus" }[],
): HabitStrength {
  let net = 0;
  for (const log of logs) net += log.direction === "plus" ? 1 : -1;
  if (net > 0) return "strong";
  if (net < 0) return "weak";
  return "neutral";
}
