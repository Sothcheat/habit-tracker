import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Each browser words an unreachable network differently — Chrome "Failed to
 * fetch", Firefox "NetworkError when attempting to fetch resource", Safari
 * "Load failed" — and matching only the first two would leave Safari users
 * told "Something went wrong" for a dropped connection.
 */
const NETWORK_MESSAGE =
  /failed to fetch|networkerror|load failed|network request failed/i;

/**
 * Whether a response failed because the request never reached the server.
 *
 * postgrest-js does not throw on a dead connection: it resolves with an error
 * and `status: 0`, which no HTTP reply can produce, so that is the reliable
 * signal. The message is a fallback for the clients that don't set a status.
 *
 * This is the question the outbox asks — a write that never left the device
 * can be replayed, while one the database refused cannot.
 */
export function isNetworkFailure(response: {
  status?: number;
  error: { message?: string } | null;
}): boolean {
  if (!response.error) return false;
  if (response.status === 0) return true;
  return NETWORK_MESSAGE.test(response.error.message ?? "");
}

/**
 * Turns a PostgREST / Postgres error into a sentence a person can act on.
 * The raw error still goes to the console for debugging.
 */
export function describeDataError(error: PostgrestError | Error): string {
  console.error(error);

  const code = "code" in error ? error.code : "";
  const message = error.message ?? "";

  if (NETWORK_MESSAGE.test(message)) {
    return "Can't reach the server. Check your connection and try again.";
  }

  switch (code) {
    // The app expects a column the database doesn't have: a migration in
    // supabase/migrations/ hasn't been applied to this project yet.
    case "42703":
    case "PGRST204":
      return "The database is missing an update. Run the latest migration in Supabase.";
    // Row-level security refused the write.
    case "42501":
      return "You don't have permission to change that.";
    // .single() matched no row — deleted elsewhere, or not yours.
    case "PGRST116":
    // A foreign key points at something that no longer exists.
    case "23503":
      return "That item no longer exists. Refresh to see the latest.";
    case "23505":
      return "That already exists.";
    case "23514":
      return describeCheckViolation(message);
    default:
      return "Something went wrong. Please try again.";
  }
}

/** Check constraints from supabase/migrations/…_init_schema.sql, by name. */
function describeCheckViolation(message: string): string {
  if (message.includes("tasks_title_check")) return "A title can't be blank.";
  if (message.includes("tasks_daily_requires_schedule_check")) {
    return "A daily needs a start date and a repeat schedule.";
  }
  if (message.includes("tasks_frequency_payload_check")) {
    return "Choose which days this daily repeats on.";
  }
  if (message.includes("tasks_every_n_days_check")) {
    return "Repeat every 1 day or more.";
  }
  if (message.includes("tasks_repeat_days_check")) {
    return "Pick days of the week only.";
  }
  if (message.includes("tasks_todo_only_fields_check")) {
    return "Only to-dos can have a due date or be completed.";
  }
  return "That change isn't valid.";
}
