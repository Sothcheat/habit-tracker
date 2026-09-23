import { useCallback, useEffect, useState } from "react";
import { prepareAvatar } from "@/lib/avatar";
import type { DailyLog, HabitLog, Tag, Task, TaskType } from "@/lib/tasks/api";
import * as api from "@/lib/tasks/api";
import { describeDataError, isNetworkFailure } from "@/lib/tasks/data-errors";
import { addDays, browserTimeZone, todayIn } from "@/lib/tasks/dates";
import {
  applyPatch,
  flushOutbox,
  pendingCount,
  queueWrite,
} from "@/lib/tasks/outbox";
import { readSnapshot, writeSnapshot } from "@/lib/tasks/snapshot";
import type { Enums, TablesUpdate } from "@/types/database.types";

/** How much history to load. Habit strength looks back 30 days, streaks 90. */
export const HABIT_WINDOW_DAYS = 30;
export const DAILY_WINDOW_DAYS = 90;

export type TrackerData = {
  timezone: string;
  /** Storage path, not a URL. Null when the user has no photo of their own. */
  avatarPath: string | null;
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
    avatarPath: profile.data?.avatar_url ?? null,
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
 *
 * **One exception, and only for an unreachable network.** A tap, a daily tick
 * or a to-do completion that never left the device goes to the outbox and is
 * applied locally, because telling someone on a train that their tap failed —
 * when it will send perfectly well in ten minutes — is a worse lie than
 * showing it as done. Everything else still fails loudly, and a write the
 * database *refuses* fails loudly too: the rule bends for the connection, not
 * for the database. See `outbox.ts`.
 */
export function useTracker(userId: string) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());
  const [reloadKey, setReloadKey] = useState(0);
  /** Writes waiting for the connection to come back. Read once, then tracked. */
  const [pendingWrites, setPendingWrites] = useState(() =>
    pendingCount(userId),
  );

  // reloadKey is never read in the body: bumping it is how reload() re-runs
  // this effect, e.g. from the Retry button after a failed load, or when the
  // connection comes back.
  // biome-ignore lint/correctness/useExhaustiveDependencies: deliberate trigger
  useEffect(() => {
    let active = true;

    // What this device last saw, shown immediately. Offline this is the whole
    // session; online it is one frame of stale data before the refresh lands,
    // which beats a spinner over tasks we already have.
    const cached = readSnapshot(userId);
    setState(
      cached ? { status: "ready", data: cached } : { status: "loading" },
    );

    (async () => {
      // Send before reading. A queued write is not on the server yet, so a
      // read that overtook it would return data missing the change the user
      // is looking at, and then overwrite their screen with it.
      const { pending } = await flushOutbox(userId);
      if (!active) return;
      setPendingWrites(pending);

      try {
        const data = await load(userId);
        if (!active) return;
        setState({ status: "ready", data });
      } catch (error) {
        if (!active) return;
        // With a snapshot on screen there is nothing to report: the app is
        // working from what it has, and the header chip already says the
        // connection is gone. The error screen is for having nothing at all.
        if (!cached) {
          setState({
            status: "error",
            message: describeDataError(error as Parameters<typeof fail>[0]),
          });
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [userId, reloadKey]);

  const data = state.status === "ready" ? state.data : null;
  const today = todayIn(data?.timezone ?? browserTimeZone());

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  /**
   * Reconnecting re-runs the load effect, which sends the outbox and then
   * re-reads. One path for "catch up with the server", whether it is reached
   * by the Try again button, a fresh mount or the network returning.
   */
  useEffect(() => {
    window.addEventListener("online", reload);
    return () => window.removeEventListener("online", reload);
  }, [reload]);

  /**
   * Keeps the snapshot level with the screen, including changes the outbox
   * has not sent. Reloading offline should show what you last saw, not what
   * the server last confirmed.
   */
  useEffect(() => {
    if (data) writeSnapshot(userId, data);
  }, [userId, data]);

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
    fields: Parameters<typeof api.buildTaskRow>[4] = {},
    tagIds: string[] = [],
  ): Promise<Result> {
    const trimmed = title.trim();
    if (!trimmed) return { error: "Give it a name first." };

    const row = api.buildTaskRow(userId, type, trimmed, today, fields);
    const response = await api.insertTaskRow(row);

    if (response.error) {
      if (!isNetworkFailure(response)) return fail(response.error);
      setPendingWrites(
        queueWrite(userId, {
          id: crypto.randomUUID(),
          kind: "task-create",
          taskId: row.id as string,
          row,
          tagIds,
        }),
      );
      update((d) => ({
        ...d,
        tasks: [...d.tasks, api.localTaskFromRow(row, tagIds)],
      }));
      return ok;
    }
    const task = response.data;

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
      const response = await api.updateTask(userId, taskId, patch);

      if (response.error) {
        if (!isNetworkFailure(response)) return fail(response.error);
        setPendingWrites(
          queueWrite(userId, {
            id: crypto.randomUUID(),
            kind: "task-edit",
            taskId,
            patch,
            tagIds,
          }),
        );
        update((d) => ({
          ...d,
          tasks: d.tasks.map((t) =>
            t.id === taskId
              ? {
                  // Through applyPatch, so an untouched field the form left
                  // as undefined does not blank the value on screen.
                  ...applyPatch(t, patch),
                  ...(tagIds && {
                    task_tags: tagIds.map((tag_id) => ({ tag_id })),
                  }),
                }
              : t,
          ),
        }));
        return ok;
      }
      const saved = response.data;

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
      const response = await api.deleteTask(userId, taskId);

      if (response.error) {
        if (!isNetworkFailure(response)) return fail(response.error);
        setPendingWrites(
          queueWrite(userId, {
            id: crypto.randomUUID(),
            kind: "task-delete",
            taskId,
          }),
        );
        // Fall through to the same local removal the confirmed path does.
      } else if (!response.data?.length) {
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
      // Generated here rather than by the database, so the row the screen
      // shows and the row that eventually lands are the same row.
      const logId = crypto.randomUUID();
      const log = {
        id: logId,
        task_id: taskId,
        direction,
        log_date: today,
      };
      const response = await api.insertHabitLog(
        taskId,
        direction,
        today,
        logId,
      );

      if (response.error) {
        if (!isNetworkFailure(response)) return fail(response.error);
        setPendingWrites(
          queueWrite(userId, {
            id: crypto.randomUUID(),
            kind: "habit-tap",
            taskId,
            logId,
            direction,
            date: today,
          }),
        );
      }

      update((d) => ({ ...d, habitLogs: [...d.habitLogs, log] }));
      return ok;
    });
  }

  function toggleDaily(taskId: string, done: boolean): Promise<Result> {
    return withPending(taskId, async () => {
      const queue = () =>
        setPendingWrites(
          queueWrite(userId, {
            id: crypto.randomUUID(),
            kind: "daily-mark",
            taskId,
            date: today,
            done,
          }),
        );

      if (done) {
        const response = await api.markDailyDone(taskId, today);
        if (response.error) {
          if (!isNetworkFailure(response)) return fail(response.error);
          queue();
        }
        // Nothing reads a daily log by id — they are found by task and date —
        // so a local id for an unsent row is safe, and the upsert on
        // (task_id, log_date) settles which row is real when it sends.
        const log = response.data ?? {
          id: crypto.randomUUID(),
          task_id: taskId,
          log_date: today,
          status: "done" as const,
        };
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
        const response = await api.unmarkDailyDone(taskId, today);
        if (response.error) {
          if (!isNetworkFailure(response)) return fail(response.error);
          queue();
        }
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
      // Fixed here, not at replay: a to-do ticked last night was finished last
      // night, whenever the connection gets around to agreeing.
      const completedAt = done ? new Date().toISOString() : null;
      const response = await api.updateTask(userId, taskId, {
        completed_at: completedAt,
      });

      if (response.error) {
        if (!isNetworkFailure(response)) return fail(response.error);
        setPendingWrites(
          queueWrite(userId, {
            id: crypto.randomUUID(),
            kind: "todo-complete",
            taskId,
            completedAt,
          }),
        );
        update((d) => ({
          ...d,
          tasks: d.tasks.map((t) =>
            t.id === taskId ? { ...t, completed_at: completedAt } : t,
          ),
        }));
        return ok;
      }

      replaceTask(response.data);
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

  /**
   * Replaces the profile photo: process, upload, then point the row at the new
   * object. The order matters — the row is only updated once the image is
   * actually in the bucket, so a failed upload leaves avatar_url pointing at
   * an image that still exists rather than at a 404.
   */
  async function setAvatar(file: File): Promise<Result> {
    let prepared: Awaited<ReturnType<typeof prepareAvatar>>;
    try {
      prepared = await prepareAvatar(file);
    } catch (error) {
      // prepareAvatar throws messages written for the user.
      return { error: (error as Error).message };
    }

    const uploaded = await api.uploadAvatar(
      userId,
      prepared.blob,
      prepared.extension,
    );
    if (uploaded.error) return fail(uploaded.error);

    const { data: profile, error } = await api.updateProfileAvatar(
      userId,
      uploaded.path,
    );
    if (error) {
      // The row still points at the old image, so the orphan is the new one.
      await api.deleteAvatarObject(uploaded.path);
      return fail(error);
    }

    const previous = data?.avatarPath ?? null;
    update((d) => ({ ...d, avatarPath: profile.avatar_url }));
    if (previous) await api.deleteAvatarObject(previous);
    return ok;
  }

  async function removeAvatar(): Promise<Result> {
    const previous = data?.avatarPath ?? null;
    if (!previous) return ok;

    const { error } = await api.updateProfileAvatar(userId, null);
    if (error) return fail(error);

    update((d) => ({ ...d, avatarPath: null }));
    await api.deleteAvatarObject(previous);
    return ok;
  }

  return {
    state,
    data,
    today,
    pendingIds,
    pendingWrites,
    reload,
    setAvatar,
    removeAvatar,
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
