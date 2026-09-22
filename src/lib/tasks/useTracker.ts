import { useCallback, useEffect, useState } from "react";
import type { DailyLog, HabitLog, Tag, Task, TaskType } from "@/lib/tasks/api";
import * as api from "@/lib/tasks/api";
import { describeDataError } from "@/lib/tasks/data-errors";
import { addDays, browserTimeZone, todayIn } from "@/lib/tasks/dates";
import type { Enums, TablesUpdate } from "@/types/database.types";

/** How much history to load. Habit strength looks back 30 days, streaks 90. */
export const HABIT_WINDOW_DAYS = 30;
export const DAILY_WINDOW_DAYS = 90;

type TrackerData = {
  timezone: string;
  tasks: Task[];
  tags: Tag[];
  habitLogs: HabitLog[];
  dailyLogs: DailyLog[];
};

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: TrackerData };

/** Every mutation resolves to this — never throws — so callers show errors inline. */
export type Result = { error: string | null };
const ok: Result = { error: null };
const fail = (error: Parameters<typeof describeDataError>[0]): Result => ({
  error: describeDataError(error),
});

async function load(userId: string): Promise<TrackerData> {
  const deviceZone = browserTimeZone();

  const profile = await api.fetchProfile(userId);
  if (profile.error) throw profile.error;

  let timezone = profile.data?.timezone ?? deviceZone;
  if (!profile.data) {
    const created = await api.ensureProfile(userId, deviceZone);
    if (created.error) throw created.error;
  } else if (timezone === "UTC" && deviceZone !== "UTC") {
    // 'UTC' is the column default, not a choice anyone made. Adopt the
    // device's zone so "today" means the user's today. Best effort: if this
    // write fails, the tracker still works on the device's zone this session.
    timezone = deviceZone;
    await api.updateProfileTimezone(userId, deviceZone);
  }

  const today = todayIn(timezone);
  const [tasks, tags, habitLogs, dailyLogs] = await Promise.all([
    api.fetchTasks(userId),
    api.fetchTags(userId),
    api.fetchHabitLogs(userId, addDays(today, -HABIT_WINDOW_DAYS)),
    api.fetchDailyLogs(userId, addDays(today, -DAILY_WINDOW_DAYS)),
  ]);
  for (const result of [tasks, tags, habitLogs, dailyLogs]) {
    if (result.error) throw result.error;
  }

  return {
    timezone,
    tasks: tasks.data ?? [],
    tags: tags.data ?? [],
    // Drop the join column; it was only there to scope the query.
    habitLogs: (habitLogs.data ?? []).map(({ tasks: _, ...log }) => log),
    dailyLogs: (dailyLogs.data ?? []).map(({ tasks: _, ...log }) => log),
  };
}

/**
 * The tracker's state and every operation on it.
 *
 * Writes are confirmed, not optimistic: local state changes only once the
 * server has accepted the write and returned the row. A failed request never
 * leaves the screen showing something the database does not hold. While a
 * task has a request in flight its id is in `pendingIds`, so its controls
 * can disable themselves and a double-click cannot fire twice.
 */
export function useTracker(userId: string) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());
  const [reloadKey, setReloadKey] = useState(0);

  // reloadKey is never read in the body: bumping it is how reload() re-runs
  // this effect, e.g. from the Retry button after a failed load.
  // biome-ignore lint/correctness/useExhaustiveDependencies: deliberate trigger
  useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    load(userId).then(
      (data) => active && setState({ status: "ready", data }),
      (error) =>
        active &&
        setState({ status: "error", message: describeDataError(error) }),
    );
    return () => {
      active = false;
    };
  }, [userId, reloadKey]);

  const data = state.status === "ready" ? state.data : null;
  const today = todayIn(data?.timezone ?? browserTimeZone());

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  function update(recipe: (data: TrackerData) => TrackerData) {
    setState((current) =>
      current.status === "ready"
        ? { status: "ready", data: recipe(current.data) }
        : current,
    );
  }

  /** Marks `id` busy for the duration of `work`, and refuses re-entry. */
  async function withPending(id: string, work: () => Promise<Result>) {
    if (pendingIds.has(id)) return ok;
    setPendingIds((ids) => new Set(ids).add(id));
    try {
      return await work();
    } finally {
      setPendingIds((ids) => {
        const next = new Set(ids);
        next.delete(id);
        return next;
      });
    }
  }

  function replaceTask(task: Task) {
    update((d) => ({
      ...d,
      tasks: d.tasks.map((t) => (t.id === task.id ? task : t)),
    }));
  }

  /**
   * Creates a task. The column's quick-add passes only a title; the create
   * dialog passes every field it collected, plus the tags to attach.
   */
  async function addTask(
    type: TaskType,
    title: string,
    fields: Parameters<typeof api.insertTask>[4] = {},
    tagIds: string[] = [],
  ): Promise<Result> {
    const trimmed = title.trim();
    if (!trimmed) return { error: "Give it a name first." };

    const { data: task, error } = await api.insertTask(
      userId,
      type,
      trimmed,
      today,
      fields,
    );
    if (error) return fail(error);

    if (tagIds.length === 0) {
      update((d) => ({ ...d, tasks: [...d.tasks, task] }));
      return ok;
    }

    // The task exists either way; only the tag links can fail from here.
    const linked = await api.addTaskTags(task.id, tagIds);
    const created = linked.error
      ? task
      : { ...task, task_tags: tagIds.map((tag_id) => ({ tag_id })) };
    update((d) => ({ ...d, tasks: [...d.tasks, created] }));
    return linked.error
      ? {
          error: `Created, but the tags couldn't be added. ${describeDataError(linked.error)}`,
        }
      : ok;
  }

  function editTask(
    taskId: string,
    patch: TablesUpdate<"tasks">,
    tagIds?: string[],
  ): Promise<Result> {
    return withPending(taskId, async () => {
      const { data: saved, error } = await api.updateTask(
        userId,
        taskId,
        patch,
      );
      if (error) return fail(error);

      let result = ok;
      let task = saved;
      if (tagIds) {
        const before = new Set(saved.task_tags.map((link) => link.tag_id));
        const after = new Set(tagIds);
        const added = tagIds.filter((id) => !before.has(id));
        const removed = [...before].filter((id) => !after.has(id));

        const [addResult, removeResult] = await Promise.all([
          added.length ? api.addTaskTags(taskId, added) : null,
          removed.length ? api.removeTaskTags(taskId, removed) : null,
        ]);
        const tagError = addResult?.error ?? removeResult?.error;
        if (tagError) {
          result = {
            error: `Saved, but the tags couldn't be updated. ${describeDataError(tagError)}`,
          };
        } else {
          task = { ...saved, task_tags: tagIds.map((tag_id) => ({ tag_id })) };
        }
      }

      replaceTask(task);
      return result;
    });
  }

  function removeTask(taskId: string): Promise<Result> {
    return withPending(taskId, async () => {
      const { data: deleted, error } = await api.deleteTask(userId, taskId);
      if (error) return fail(error);
      if (!deleted?.length) {
        return {
          error: "That item no longer exists. Refresh to see the latest.",
        };
      }
      // The database cascaded the logs away; mirror that locally.
      update((d) => ({
        ...d,
        tasks: d.tasks.filter((t) => t.id !== taskId),
        habitLogs: d.habitLogs.filter((log) => log.task_id !== taskId),
        dailyLogs: d.dailyLogs.filter((log) => log.task_id !== taskId),
      }));
      return ok;
    });
  }

  function tapHabit(
    taskId: string,
    direction: Enums<"tap_direction">,
  ): Promise<Result> {
    return withPending(taskId, async () => {
      const { data: log, error } = await api.insertHabitLog(
        taskId,
        direction,
        today,
      );
      if (error) return fail(error);
      update((d) => ({ ...d, habitLogs: [...d.habitLogs, log] }));
      return ok;
    });
  }

  function toggleDaily(taskId: string, done: boolean): Promise<Result> {
    return withPending(taskId, async () => {
      if (done) {
        const { data: log, error } = await api.markDailyDone(taskId, today);
        if (error) return fail(error);
        update((d) => ({
          ...d,
          dailyLogs: [
            ...d.dailyLogs.filter(
              (l) => !(l.task_id === taskId && l.log_date === today),
            ),
            log,
          ],
        }));
      } else {
        const { error } = await api.unmarkDailyDone(taskId, today);
        if (error) return fail(error);
        update((d) => ({
          ...d,
          dailyLogs: d.dailyLogs.filter(
            (l) => !(l.task_id === taskId && l.log_date === today),
          ),
        }));
      }
      return ok;
    });
  }

  function toggleTodo(taskId: string, done: boolean): Promise<Result> {
    return withPending(taskId, async () => {
      const { data: task, error } = await api.updateTask(userId, taskId, {
        completed_at: done ? new Date().toISOString() : null,
      });
      if (error) return fail(error);
      replaceTask(task);
      return ok;
    });
  }

  /**
   * Moves a task to the top or bottom of its own column by giving it a
   * position just past the current extreme. One row changes; no renumbering.
   */
  function moveTask(taskId: string, where: "top" | "bottom"): Promise<Result> {
    const task = data?.tasks.find((t) => t.id === taskId);
    if (!data || !task) return Promise.resolve(ok);
    const positions = data.tasks
      .filter((t) => t.type === task.type && t.id !== taskId)
      .map(sortKey);
    if (positions.length === 0) return Promise.resolve(ok);
    const position =
      where === "top" ? Math.min(...positions) - 1 : Math.max(...positions) + 1;
    return editTask(taskId, { position });
  }

  async function createTag(name: string): Promise<Result & { tag?: Tag }> {
    const trimmed = name.trim();
    if (!trimmed) return { error: "Give the tag a name." };
    if (
      data?.tags.some((t) => t.name.toLowerCase() === trimmed.toLowerCase())
    ) {
      return { error: "You already have a tag with that name." };
    }
    const { data: tag, error } = await api.insertTag(userId, trimmed);
    if (error) {
      return error.code === "23505"
        ? { error: "You already have a tag with that name." }
        : fail(error);
    }
    update((d) => ({
      ...d,
      tags: [...d.tags, tag], // newest last, matching fetchTags' order
    }));
    return { error: null, tag };
  }

  /**
   * Applies one "Edit tags" session: deletes, then renames, then creates.
   * Deleting first frees names, so "delete Work, add a new Work" in one save
   * doesn't trip the (user_id, name) unique key. Local state follows each
   * step that succeeds, so a failure part-way never leaves the screen claiming
   * more than the database holds.
   */
  async function saveTagEdits(edits: {
    renamed: { id: string; name: string }[];
    created: string[];
    deleted: string[];
  }): Promise<Result> {
    if (edits.deleted.length) {
      const { error } = await api.deleteTags(userId, edits.deleted);
      if (error) return fail(error);
      const gone = new Set(edits.deleted);
      update((d) => ({
        ...d,
        tags: d.tags.filter((tag) => !gone.has(tag.id)),
        // The links went with the tags (cascade); mirror that on each task.
        tasks: d.tasks.map((task) => ({
          ...task,
          task_tags: task.task_tags.filter((link) => !gone.has(link.tag_id)),
        })),
      }));
    }

    for (const { id, name } of edits.renamed) {
      const { data: tag, error } = await api.renameTag(userId, id, name);
      if (error) {
        return error.code === "23505"
          ? { error: `You already have a tag called "${name}".` }
          : fail(error);
      }
      update((d) => ({
        ...d,
        tags: d.tags.map((existing) => (existing.id === id ? tag : existing)),
      }));
    }

    if (edits.created.length) {
      const { data: tags, error } = await api.insertTags(userId, edits.created);
      if (error) {
        return error.code === "23505"
          ? { error: "One of the new tags already exists." }
          : fail(error);
      }
      update((d) => ({ ...d, tags: [...d.tags, ...tags] }));
    }

    return ok;
  }

  return {
    state,
    data,
    today,
    pendingIds,
    reload,
    addTask,
    editTask,
    removeTask,
    tapHabit,
    toggleDaily,
    toggleTodo,
    createTag,
    saveTagEdits,
    moveTask,
  };
}

export type Tracker = ReturnType<typeof useTracker>;

/**
 * A task's place in its column. `position` arrives with the
 * 20260923000200_task_position migration; until that is applied the column is
 * absent, so fall back to creation time in the same unit (epoch seconds) —
 * which is exactly what the migration backfills.
 */
export function sortKey(task: Task): number {
  return (
    (task.position as number | undefined) ?? Date.parse(task.created_at) / 1000
  );
}
