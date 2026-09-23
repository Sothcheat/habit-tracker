/**
 * Every Supabase query the tracker makes, in one place.
 *
 * Two layers of protection, on purpose:
 *
 * 1. Row-level security in the database is the real guarantee. Even a
 *    tampered client cannot read or write another user's rows.
 * 2. Every query here is ALSO scoped to the signed-in user explicitly. That
 *    makes intent readable at the call site, keeps queries correct if a policy
 *    is ever loosened by mistake, and lets Postgres use the (user_id, type)
 *    index instead of relying on the policy filter alone.
 *
 * Tables with a user_id column are scoped with .eq("user_id", userId).
 * The log tables have no user_id — ownership flows through their task — so
 * reads join to tasks with `tasks!inner(user_id)` and filter on that.
 */

import { supabase } from "@/lib/supabase";
import type { ISODate } from "@/lib/tasks/dates";
import type {
  Enums,
  Tables,
  TablesInsert,
  TablesUpdate,
} from "@/types/database.types";

export type TaskType = Enums<"task_type">;
export type Task = Tables<"tasks"> & { task_tags: { tag_id: string }[] };
export type Tag = Tables<"tags">;
export type HabitLog = Pick<
  Tables<"habit_logs">,
  "id" | "task_id" | "direction" | "log_date"
>;
export type DailyLog = Pick<
  Tables<"daily_logs">,
  "id" | "task_id" | "log_date" | "status"
>;

// Tasks always come back with their tag ids so the list can filter by tag.
const TASK_COLUMNS = "*, task_tags(tag_id)";

// ─── Reads ──────────────────────────────────────────────────────────────────

export function fetchProfile(userId: string) {
  return supabase
    .from("profiles")
    .select("id, timezone, avatar_url")
    .eq("id", userId) // profiles.id IS the user id
    .maybeSingle();
}

/**
 * Creates the profile if the signup trigger never did (e.g. an account made
 * before the trigger existed). Every task row needs one — tasks.user_id
 * references profiles(id). ignoreDuplicates makes this a no-op if it exists.
 */
export function ensureProfile(userId: string, timezone: string) {
  return supabase
    .from("profiles")
    .upsert(
      { id: userId, timezone },
      { onConflict: "id", ignoreDuplicates: true },
    );
}

export function updateProfileTimezone(userId: string, timezone: string) {
  return supabase.from("profiles").update({ timezone }).eq("id", userId); // only ever my own profile row
}

// ─── Avatars ────────────────────────────────────────────────────────────────
//
// The image lives in the public `avatars` bucket at `<userId>/<uuid>.<ext>`.
// That first path segment is what the storage policies check, so every path
// built here starts with the signed-in user's id — the same explicit scoping
// the table queries use.
//
// profiles.avatar_url holds the path, not a URL: the public prefix belongs to
// the project rather than the user, so storing it per row would mean rewriting
// every row if the bucket ever moved.

const AVATAR_BUCKET = "avatars";

/** Resolves a stored path to the URL an <img> can use. */
export function avatarPublicUrl(path: string) {
  return supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;
}

/**
 * Uploads to a fresh uuid every time rather than overwriting one fixed name.
 * A public bucket is served through a CDN, and reusing the path would keep
 * serving the previous image after a change — a stale avatar that no cache
 * header we control can reliably fix.
 */
export function uploadAvatar(userId: string, blob: Blob, extension: string) {
  const path = `${userId}/${crypto.randomUUID()}.${extension}`;
  return supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, blob, { contentType: blob.type, upsert: false })
    .then((result) => ({ ...result, path }));
}

export function updateProfileAvatar(userId: string, avatarUrl: string | null) {
  return supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", userId) // only ever my own profile row
    .select("avatar_url")
    .single();
}

/**
 * Best-effort cleanup of a replaced image. The profile row is the source of
 * truth; an object left behind is 50 KB of litter, so a failure here is not
 * worth failing the change the user asked for.
 */
export function deleteAvatarObject(path: string) {
  return supabase.storage.from(AVATAR_BUCKET).remove([path]);
}

export function fetchTasks(userId: string) {
  return supabase
    .from("tasks")
    .select(TASK_COLUMNS)
    .eq("user_id", userId) // only my tasks
    .is("archived_at", null) // archived tasks stay out of the active lists
    .order("created_at", { ascending: true });
}

export function fetchTags(userId: string) {
  return (
    supabase
      .from("tags")
      .select("*")
      .eq("user_id", userId) // only my tags
      // Creation order, so new tags land at the end and the default set keeps
      // its seeded order. Name breaks ties between rows made in one statement.
      .order("created_at", { ascending: true })
      .order("name", { ascending: true })
  );
}

export function fetchHabitLogs(userId: string, since: ISODate) {
  return supabase
    .from("habit_logs")
    .select("id, task_id, direction, log_date, tasks!inner(user_id)")
    .eq("tasks.user_id", userId) // only logs whose parent task is mine
    .gte("log_date", since); // bounded window — history grows forever;
}

export function fetchDailyLogs(userId: string, since: ISODate) {
  return supabase
    .from("daily_logs")
    .select("id, task_id, log_date, status, tasks!inner(user_id)")
    .eq("tasks.user_id", userId) // only logs whose parent task is mine
    .gte("log_date", since);
}

// ─── Tasks ──────────────────────────────────────────────────────────────────

/**
 * The schema's check constraints require type-specific fields: a habit needs
 * a direction, a daily needs a frequency and start date. New tasks get
 * sensible defaults so a one-line "Add a daily" always satisfies them.
 */
export function insertTask(
  userId: string,
  type: TaskType,
  title: string,
  today: ISODate,
  /** Anything the create dialog set: notes, priority, schedule, due date. */
  fields: Omit<TablesInsert<"tasks">, "user_id" | "type" | "title"> = {},
) {
  const row: TablesInsert<"tasks"> = {
    ...(type === "habit" && { direction: "both" as const }),
    ...(type === "daily" && { frequency: "daily" as const, start_date: today }),
    ...fields,
    // Last, so no field can override who owns the row or what it is.
    user_id: userId, // RLS rejects any other value
    type,
    title,
  };
  return supabase.from("tasks").insert(row).select(TASK_COLUMNS).single();
}

export function updateTask(
  userId: string,
  taskId: string,
  patch: TablesUpdate<"tasks">,
) {
  return supabase
    .from("tasks")
    .update(patch)
    .eq("id", taskId) // this one task…
    .eq("user_id", userId) // …and only if it is mine
    .select(TASK_COLUMNS)
    .single(); // zero rows matched → PGRST116, surfaced as "no longer exists"
}

/**
 * Deletes a task. Its habit_logs, daily_logs and task_tags go with it through
 * ON DELETE CASCADE — no second query, and no way to orphan them.
 */
export function deleteTask(userId: string, taskId: string) {
  return supabase
    .from("tasks")
    .delete()
    .eq("id", taskId) // this one task…
    .eq("user_id", userId) // …and only if it is mine
    .select("id"); // return what was deleted, so "deleted nothing" is detectable
}

// ─── Logs ───────────────────────────────────────────────────────────────────

export function insertHabitLog(
  taskId: string,
  direction: Enums<"tap_direction">,
  today: ISODate,
) {
  // No user_id column to set: the RLS insert policy checks that task_id
  // belongs to the caller through owns_task().
  return supabase
    .from("habit_logs")
    .insert({ task_id: taskId, direction, log_date: today })
    .select("id, task_id, direction, log_date")
    .single();
}

/**
 * Marks a daily done for a date. Upsert on the (task_id, log_date) unique key
 * makes a double-click harmless instead of a duplicate-key error.
 */
export function markDailyDone(taskId: string, date: ISODate) {
  return supabase
    .from("daily_logs")
    .upsert(
      { task_id: taskId, log_date: date, status: "done" },
      { onConflict: "task_id,log_date" },
    )
    .select("id, task_id, log_date, status")
    .single();
}

export function unmarkDailyDone(taskId: string, date: ISODate) {
  return supabase
    .from("daily_logs")
    .delete()
    .eq("task_id", taskId) // this daily…
    .eq("log_date", date); // …on this date only — never its whole history
  // RLS limits this to logs of tasks the caller owns.
}

// ─── Tags ───────────────────────────────────────────────────────────────────

export function insertTag(userId: string, name: string) {
  return supabase
    .from("tags")
    .insert({ user_id: userId, name }) // RLS rejects any other user_id
    .select("*")
    .single();
}

export function insertTags(userId: string, names: string[]) {
  return supabase
    .from("tags")
    .insert(names.map((name) => ({ user_id: userId, name }))) // RLS rejects any other user_id
    .select("*");
}

export function renameTag(userId: string, tagId: string, name: string) {
  return supabase
    .from("tags")
    .update({ name })
    .eq("id", tagId) // this one tag…
    .eq("user_id", userId) // …and only if it is mine
    .select("*")
    .single();
}

/** Deleting a tag removes its task_tags links by cascade; tasks are untouched. */
export function deleteTags(userId: string, tagIds: string[]) {
  return supabase
    .from("tags")
    .delete()
    .in("id", tagIds) // these tags…
    .eq("user_id", userId) // …and only mine
    .select("id");
}

export function addTaskTags(taskId: string, tagIds: string[]) {
  // The insert policy requires BOTH the task and the tag to be the caller's,
  // so a foreign tag id cannot be attached even by a tampered client.
  return supabase
    .from("task_tags")
    .insert(tagIds.map((tagId) => ({ task_id: taskId, tag_id: tagId })));
}

export function removeTaskTags(taskId: string, tagIds: string[]) {
  return supabase
    .from("task_tags")
    .delete()
    .eq("task_id", taskId) // links of this task…
    .in("tag_id", tagIds); // …to these tags only
}
