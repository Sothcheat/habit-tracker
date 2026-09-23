import type { Task } from "@/lib/tasks/api";
import { formatDate } from "@/lib/tasks/dates";

/**
 * Whether this browser can open the system share sheet.
 *
 * The Web Share API needs a secure context and is absent from several desktop
 * browsers, so the caller hides the action rather than offering something that
 * cannot happen. It is a property of the browser, not of the moment, so
 * reading it during render is stable.
 */
export function canShare(): boolean {
  return (
    typeof navigator !== "undefined" && typeof navigator.share === "function"
  );
}

type ShareOutcome = "shared" | "copied" | "dismissed" | "failed";

/**
 * Opens the system share sheet, or copies to the clipboard where there is
 * none — most desktop browsers, and any page not on a secure origin.
 *
 * Dismissing the sheet rejects with an `AbortError`, which is the user doing
 * exactly what the sheet is for: it is reported as its own outcome, never as
 * a failure, so nothing appears for a change of mind. A sheet that fails for
 * any other reason falls back to the clipboard too — the point is to get the
 * text to the user, not to insist on one route.
 *
 * Must be called straight from a click: both APIs want transient user
 * activation, and an `await` before them spends it.
 */
export async function share(data: ShareData): Promise<ShareOutcome> {
  if (canShare()) {
    try {
      await navigator.share(data);
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return "dismissed";
      }
      console.error(error);
      // Fall through: the sheet failed, the clipboard may not.
    }
  }
  return copy([data.text, data.url].filter(Boolean).join("\n"));
}

async function copy(text: string): Promise<ShareOutcome> {
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch (error) {
    // Denied permission, an insecure origin, or a browser that wants the
    // write closer to the gesture than this one ended up being.
    console.error(error);
    return "failed";
  }
}

/** What a card knows about itself, for the line that gets shared. */
export type TaskFacts = {
  /** Habits: taps recorded today. */
  plusToday?: number;
  /** Dailies: consecutive days done. */
  streak?: number;
};

/**
 * The sentence the share sheet carries.
 *
 * It states what the task is doing now, because a bare title is not worth
 * sending: a habit brings today's count, a daily its streak, a to-do its due
 * date or that it is finished. Everything here is already on the card — this
 * shares what the user can see, and never a note, a tag or anything else the
 * card keeps to itself.
 */
export function taskShareText(task: Task, facts: TaskFacts = {}): string {
  const detail = describe(task, facts);
  return detail ? `${task.title} — ${detail}` : task.title;
}

function describe(task: Task, facts: TaskFacts): string | null {
  if (task.type === "habit") {
    const taps = facts.plusToday ?? 0;
    if (taps === 0) return null;
    return `${taps} ${taps === 1 ? "time" : "times"} today`;
  }
  if (task.type === "daily") {
    const streak = facts.streak ?? 0;
    return streak > 0 ? `${streak} day streak` : null;
  }
  if (task.completed_at) return "done";
  return task.due_date ? `due ${formatDate(task.due_date)}` : null;
}
