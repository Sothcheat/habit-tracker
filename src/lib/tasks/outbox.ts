import * as api from "@/lib/tasks/api";
import { isNetworkFailure } from "@/lib/tasks/data-errors";
import type { ISODate } from "@/lib/tasks/dates";
import type { Enums, TablesInsert, TablesUpdate } from "@/types/database.types";

/**
 * Writes that failed because the network was unreachable, kept until it comes
 * back.
 *
 * Every mutation is queued, and each obeys the same three rules:
 *
 * - each carries **its own date or timestamp**, resolved when the user acted,
 *   so a tap made last night is not filed under today when it finally sends;
 * - each is **idempotent**, so a reply lost in a dying connection costs a
 *   duplicate at worst (rows bring their own id and collide on replay, a
 *   daily upserts on `(task_id, log_date)`, a delete that finds nothing has
 *   already happened);
 * - each **names rows by an id that already exists on this device**. A task
 *   created offline is given its uuid here rather than by the database, so a
 *   tap, an edit or a delete queued behind it names the row the insert will
 *   create. Replaying in order is then enough — nothing has to be rewritten
 *   when the insert finally lands.
 *
 * Entries are **data, not closures.** A closure cannot be written to storage,
 * so a reload — likely on a phone, which is where offline happens — would drop
 * every pending write without a trace. Data survives, and can be counted for
 * the user, collapsed, and inspected in devtools.
 */
export type PendingWrite = { id: string } & (
  | {
      kind: "habit-tap";
      taskId: string;
      /** Generated up front, so a retry after a lost reply collides instead of duplicating. */
      logId: string;
      direction: Enums<"tap_direction">;
      date: ISODate;
    }
  | { kind: "daily-mark"; taskId: string; date: ISODate; done: boolean }
  | { kind: "todo-complete"; taskId: string; completedAt: string | null }
  | {
      kind: "task-create";
      taskId: string;
      /** The whole row, `id` included — the same one the screen is showing. */
      row: TablesInsert<"tasks">;
      tagIds: string[];
    }
  | {
      kind: "task-edit";
      taskId: string;
      patch: TablesUpdate<"tasks">;
      /** The full tag set, or undefined where the edit did not touch tags. */
      tagIds?: string[];
    }
  | { kind: "task-delete"; taskId: string }
);

/**
 * Keyed by user: a device can hold unsent writes for more than one account,
 * and they must never replay into the wrong one. Unlike the avatar cache,
 * this is not cleared on sign-out — it is the user's own unsaved work, and it
 * waits for them to come back.
 */
const storageKey = (userId: string) => `cadence-outbox:${userId}`;

function read(userId: string): PendingWrite[] {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Blocked site data, private mode, or something else's key in our slot.
    return [];
  }
}

function write(userId: string, items: PendingWrite[]) {
  try {
    if (items.length === 0) localStorage.removeItem(storageKey(userId));
    else localStorage.setItem(storageKey(userId), JSON.stringify(items));
  } catch {
    // Out of quota or blocked: the queue still works for this session, it
    // just will not survive a reload. Losing the write here would be worse.
  }
}

export function pendingCount(userId: string) {
  return read(userId).length;
}

/**
 * Adds a write to the queue and returns the new length.
 *
 * A queue of intents can be reasoned about, which a queue of closures cannot,
 * so it collapses on the way in rather than replaying everything the user
 * happened to do:
 *
 * - **Ticking a daily four times** sends one state, not four.
 * - **Edits merge.** Patches are partial — renaming a task and then moving it
 *   queues one patch carrying both, and superseding would have lost the name.
 * - **An edit to a task that has not been created yet folds into the create**,
 *   so the row is inserted with its final values instead of being inserted and
 *   then corrected.
 * - **Deleting cancels everything queued about that task**, and if the task
 *   was itself created offline the delete is not queued either: the server
 *   never heard of the row, so there is nothing to tell it.
 * - **Taps never collapse.** Each one is a separate event the user performed,
 *   and how many there were is the entire point of a habit.
 */
export function queueWrite(userId: string, entry: PendingWrite): number {
  let items = read(userId);

  if (entry.kind === "task-delete") {
    const unsent = items.some(
      (item) =>
        item.kind === "task-create" &&
        item.taskId === entry.taskId &&
        item.id !== inFlightId,
    );
    items = items.filter(
      (item) => item.taskId !== entry.taskId || item.id === inFlightId,
    );
    if (!unsent) items.push(entry);
    write(userId, items);
    return items.length;
  }

  // Both of these write to the task's own row, so they can fold into a create
  // or an edit that has not gone out yet.
  if (entry.kind === "task-edit" || entry.kind === "todo-complete") {
    const patch: TablesUpdate<"tasks"> =
      entry.kind === "task-edit"
        ? entry.patch
        : { completed_at: entry.completedAt };

    const pendingCreate = items.find(
      (item) =>
        item.kind === "task-create" &&
        item.taskId === entry.taskId &&
        item.id !== inFlightId,
    );
    if (pendingCreate?.kind === "task-create") {
      pendingCreate.row = applyPatch(pendingCreate.row, patch);
      if (entry.kind === "task-edit" && entry.tagIds) {
        pendingCreate.tagIds = entry.tagIds;
      }
      write(userId, items);
      return items.length;
    }

    const pendingEdit = items.find(
      (item) =>
        item.kind === "task-edit" &&
        item.taskId === entry.taskId &&
        item.id !== inFlightId,
    );
    if (pendingEdit?.kind === "task-edit") {
      pendingEdit.patch = applyPatch(pendingEdit.patch, patch);
      if (entry.kind === "task-edit" && entry.tagIds) {
        pendingEdit.tagIds = entry.tagIds;
      }
      write(userId, items);
      return items.length;
    }
  }

  items = items.filter(
    (item) => item.id === inFlightId || !supersedes(entry, item),
  );
  items.push(entry);
  write(userId, items);
  return items.length;
}

/**
 * Applies a patch the way the database would, and the way local state must:
 * keys explicitly set to `undefined` mean "this form did not touch the field",
 * not "clear it". Clearing is `null`.
 */
export function applyPatch<T extends object>(base: T, patch: object): T {
  const next: Record<string, unknown> = { ...(base as object) } as Record<
    string,
    unknown
  >;
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) next[key] = value;
  }
  return next as T;
}

function supersedes(next: PendingWrite, existing: PendingWrite): boolean {
  if (next.kind !== existing.kind) return false;
  if (next.kind === "daily-mark" && existing.kind === "daily-mark") {
    return next.taskId === existing.taskId && next.date === existing.date;
  }
  if (next.kind === "todo-complete" && existing.kind === "todo-complete") {
    return next.taskId === existing.taskId;
  }
  return false;
}

type FlushOutcome = {
  /** Writes that reached the database. */
  sent: number;
  /** Writes the database refused for good, and which have been given up on. */
  dropped: number;
  /** Writes still waiting, because the network is still unreachable. */
  pending: number;
};

/** One drain at a time: `online` can fire while a flush is already running. */
let flushing = false;

/**
 * The entry currently in the air. Collapsing into it would edit a copy that
 * has already gone, and the flush then removes it by id — losing the change
 * that was folded in. New writes queue behind it instead.
 */
let inFlightId: string | null = null;

/**
 * Sends what is queued, oldest first, and stops at the first write that fails
 * for the network again — order is preserved, so a daily ticked and then
 * unticked cannot land the wrong way round.
 *
 * A write the database *refuses* (the task was deleted on another device, RLS
 * said no) can never succeed, so it is dropped rather than retried forever.
 * The caller is told how many, because the screen is now showing a change that
 * did not happen and needs reloading.
 */
export async function flushOutbox(userId: string): Promise<FlushOutcome> {
  if (flushing) return { sent: 0, dropped: 0, pending: pendingCount(userId) };
  flushing = true;
  try {
    let items = read(userId);
    let sent = 0;
    let dropped = 0;

    while (items.length > 0) {
      const head = items[0];
      inFlightId = head.id;
      const outcome = await send(userId, head).finally(() => {
        inFlightId = null;
      });
      if (outcome === "retry") break;
      if (outcome === "sent") sent += 1;
      else dropped += 1;

      // Re-read and remove by id rather than slicing the array we started
      // with: the user can queue — or supersede — a write while the one above
      // is in flight, and dropping by position would discard the wrong one.
      items = read(userId).filter((item) => item.id !== head.id);
      write(userId, items);
    }

    return { sent, dropped, pending: items.length };
  } finally {
    flushing = false;
  }
}

/**
 * Rows that carry an id chosen on this device. Replaying one after its reply
 * was lost hits the primary key instead of writing a second row, so a
 * duplicate-key error means the write already succeeded.
 */
const BRINGS_ITS_OWN_ID: PendingWrite["kind"][] = ["habit-tap", "task-create"];

async function send(
  userId: string,
  entry: PendingWrite,
): Promise<"sent" | "dropped" | "retry"> {
  const response = await run(userId, entry);
  if (!response.error) return "sent";
  if (isNetworkFailure(response)) return "retry";
  if (
    BRINGS_ITS_OWN_ID.includes(entry.kind) &&
    response.error.code === "23505"
  ) {
    return "sent";
  }
  console.error("Giving up on a queued write", entry, response.error);
  return "dropped";
}

async function run(userId: string, entry: PendingWrite) {
  switch (entry.kind) {
    case "habit-tap":
      return api.insertHabitLog(
        entry.taskId,
        entry.direction,
        entry.date,
        entry.logId,
      );
    case "daily-mark":
      return entry.done
        ? api.markDailyDone(entry.taskId, entry.date)
        : api.unmarkDailyDone(entry.taskId, entry.date);
    case "todo-complete":
      return api.updateTask(userId, entry.taskId, {
        completed_at: entry.completedAt,
      });
    case "task-create": {
      const inserted = await api.insertTaskRow(entry.row);
      // Tags are a second statement, and a network failure here retries the
      // whole entry — safe, because the insert above collides rather than
      // duplicating. The one gap: a lost reply takes the 23505 path, which
      // returns before the tags are attached.
      if (inserted.error || entry.tagIds.length === 0) return inserted;
      return api.addTaskTags(entry.taskId, entry.tagIds);
    }
    case "task-edit": {
      const saved = await api.updateTask(userId, entry.taskId, entry.patch);
      if (saved.error || !entry.tagIds) return saved;
      // The queued set is the whole truth about this task's tags, so replace
      // rather than diff: what the row holds now is whatever a half-sent
      // earlier attempt left behind.
      const before = new Set(saved.data.task_tags.map((link) => link.tag_id));
      const after = new Set(entry.tagIds);
      const added = entry.tagIds.filter((id) => !before.has(id));
      const removed = [...before].filter((id) => !after.has(id));
      if (removed.length) {
        const result = await api.removeTaskTags(entry.taskId, removed);
        if (result.error) return result;
      }
      return added.length ? api.addTaskTags(entry.taskId, added) : saved;
    }
    case "task-delete":
      // Deleting nothing is not an error: another device may have got there
      // first, and the outcome the user asked for already holds.
      return api.deleteTask(userId, entry.taskId);
  }
}
