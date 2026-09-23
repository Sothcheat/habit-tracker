import {
  CalendarDays,
  Diff,
  RotateCw,
  Search,
  SquareCheckBig,
} from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";

/**
 * The dialogs are the heaviest thing on this page and none of them is on
 * screen when it opens — together they are about a fifth of the tracker
 * bundle, in forms, selects and a date field nobody has asked for yet.
 *
 * Split out, they cost one fetch the first time a dialog is opened, and
 * nothing after: the service worker precaches every built chunk, so from the
 * second visit they are already on the device.
 */
const DeleteTaskDialog = lazy(() =>
  import("@/components/tracker/DeleteTaskDialog").then((m) => ({
    default: m.DeleteTaskDialog,
  })),
);
const TaskCreateDialog = lazy(() =>
  import("@/components/tracker/TaskEditDialog").then((m) => ({
    default: m.TaskCreateDialog,
  })),
);
const TaskEditDialog = lazy(() =>
  import("@/components/tracker/TaskEditDialog").then((m) => ({
    default: m.TaskEditDialog,
  })),
);

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { ProfileMenu } from "@/components/ProfileMenu";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AddTaskMenu } from "@/components/tracker/AddTaskMenu";
import { DailyCard, HabitCard, TodoCard } from "@/components/tracker/cards";
import { TagFilter } from "@/components/tracker/TagFilter";
import type { Tone } from "@/components/tracker/TaskCard";
import { FilteredOut, TaskColumn } from "@/components/tracker/TaskColumn";
import { TaskMenu } from "@/components/tracker/TaskMenu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Wordmark } from "@/components/Wordmark";
import { useAuth } from "@/lib/auth";
import { share, taskShareText } from "@/lib/share";
import type { DailyLog, HabitLog, Task, TaskType } from "@/lib/tasks/api";
import { avatarPublicUrl } from "@/lib/tasks/api";
import {
  dailyStreak,
  habitStrength,
  isDueOn,
  isOverdue,
} from "@/lib/tasks/schedule";
import { type Result, sortKey, useTracker } from "@/lib/tasks/useTracker";

type ColumnErrors = Record<TaskType, string | null>;
const NO_ERRORS: ColumnErrors = { habit: null, daily: null, todo: null };

/** Rendered under ProtectedRoute, so a user is always present here. */
function TrackerPage() {
  const { user } = useAuth();
  if (!user) return null;
  return <Tracker userId={user.id} />;
}

function Tracker({ userId }: { userId: string }) {
  const tracker = useTracker(userId);
  const { state, data, today, pendingIds } = tracker;

  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [creatingType, setCreatingType] = useState<TaskType | null>(null);
  const [columnErrors, setColumnErrors] = useState<ColumnErrors>(NO_ERRORS);
  const [columnNotices, setColumnNotices] = useState<ColumnErrors>(NO_ERRORS);

  const loading = state.status === "loading";
  // Column order: position ascending (see sortKey for the pre-migration case).
  const tasks = (data?.tasks ?? []).toSorted((a, b) => sortKey(a) - sortKey(b));
  const editing = tasks.find((task) => task.id === editingId) ?? null;
  const deleting = tasks.find((task) => task.id === deletingId) ?? null;

  // ── Search and tag filter apply to every column ──
  // Only tags that still exist count. A selected id whose tag is gone — e.g.
  // deleted by a tag save that then failed part-way — would otherwise hide
  // every task, with no checkbox left in the panel to untick it.
  const existingTagIds = new Set((data?.tags ?? []).map((tag) => tag.id));
  const activeTags = new Set(
    [...tagFilter].filter((id) => existingTagIds.has(id)),
  );
  const query = search.trim().toLowerCase();
  const visible = tasks.filter(
    (task) =>
      (!query ||
        task.title.toLowerCase().includes(query) ||
        task.notes?.toLowerCase().includes(query)) &&
      (activeTags.size === 0 ||
        task.task_tags.some((link) => activeTags.has(link.tag_id))),
  );
  const filtering = query !== "" || activeTags.size > 0;

  // ── Logs, grouped by task once ──
  const habitLogsByTask = groupBy(data?.habitLogs ?? []);
  const dailyStatusByTask = new Map<string, Map<string, DailyLog["status"]>>();
  for (const log of data?.dailyLogs ?? []) {
    let byDate = dailyStatusByTask.get(log.task_id);
    if (!byDate) {
      byDate = new Map();
      dailyStatusByTask.set(log.task_id, byDate);
    }
    byDate.set(log.log_date, log.status);
  }

  const habits = visible.filter((task) => task.type === "habit");
  const dailies = visible.filter((task) => task.type === "daily");
  const todos = visible.filter((task) => task.type === "todo");

  const habitInfo = (task: Task) => {
    const logs = habitLogsByTask.get(task.id) ?? [];
    const todays = logs.filter((log) => log.log_date === today);
    return {
      strength: habitStrength(logs),
      plusToday: todays.filter((log) => log.direction === "plus").length,
      minusToday: todays.filter((log) => log.direction === "minus").length,
    };
  };
  const dailyInfo = (task: Task) => {
    const statuses = dailyStatusByTask.get(task.id) ?? new Map();
    return {
      dueToday: isDueOn(task, today),
      doneToday: statuses.get(today) === "done",
      streak: dailyStreak(task, statuses, today),
    };
  };

  /** Runs a card action; a failure lands in that column's alert. */
  async function run(type: TaskType, action: Promise<Result>) {
    setColumnErrors((errors) => ({ ...errors, [type]: null }));
    const { error } = await action;
    if (error) setColumnErrors((errors) => ({ ...errors, [type]: error }));
  }
  const dismiss = (type: TaskType) => () =>
    setColumnErrors((errors) => ({ ...errors, [type]: null }));

  // A confirmation has been read by the time it matters, so it clears itself
  // rather than leaving the user something to tidy up.
  const anyNotice = Object.values(columnNotices).some(Boolean);
  useEffect(() => {
    if (!anyNotice) return;
    const timer = setTimeout(() => setColumnNotices(NO_ERRORS), 4000);
    return () => clearTimeout(timer);
  }, [anyNotice]);

  const noMatch = filtering ? "Nothing matches your search or tags." : null;

  // Sticky: true from the first dialog opened until the page is left.
  const [dialogsUsed, setDialogsUsed] = useState(false);
  const opening =
    creatingType !== null || editingId !== null || deletingId !== null;
  useEffect(() => {
    if (opening) setDialogsUsed(true);
  }, [opening]);

  /**
   * The ⋮ menu for a card. "First" and "last" are judged against the whole
   * column, not the filtered view — To top means the top of the column.
   */
  function menuFor(task: Task) {
    const column = tasks.filter((t) => t.type === task.type);
    return (
      <TaskMenu
        title={task.title}
        disabled={pendingIds.has(task.id)}
        isFirst={column[0]?.id === task.id}
        isLast={column.at(-1)?.id === task.id}
        onEdit={() => setEditingId(task.id)}
        onShare={() => shareTask(task)}
        onMoveTop={() => run(task.type, tracker.moveTask(task.id, "top"))}
        onMoveBottom={() => run(task.type, tracker.moveTask(task.id, "bottom"))}
        onDelete={() => setDeletingId(task.id)}
      />
    );
  }

  /**
   * Hands the task to the system share sheet.
   *
   * Called straight from the click, with no await before it: the Web Share
   * API spends the gesture's user activation, and anything awaited first
   * would lose it. A dismissed sheet is a decision, not a failure, so only a
   * real error reaches the column's alert.
   */
  function shareTask(task: Task) {
    const facts =
      task.type === "habit"
        ? { plusToday: habitInfo(task).plusToday }
        : task.type === "daily"
          ? { streak: dailyInfo(task).streak }
          : {};
    share({
      title: "Cadence",
      text: taskShareText(task, facts),
      url: window.location.origin,
    }).then((outcome) => {
      if (outcome === "failed") {
        setColumnErrors((errors) => ({
          ...errors,
          [task.type]: "That couldn't be shared.",
        }));
      }
      // Where there is no share sheet the text went to the clipboard instead,
      // which is invisible unless we say so. "shared" needs no confirmation:
      // the sheet was the confirmation.
      if (outcome === "copied") {
        setColumnNotices((notices) => ({
          ...notices,
          [task.type]: "Copied to clipboard.",
        }));
      }
    });
  }

  /** The same state colour the card's strips use, for the editor's header. */
  function toneOf(task: Task | null): Tone {
    if (!task) return "neutral";
    if (task.type === "habit") {
      const { strength } = habitInfo(task);
      return strength === "strong"
        ? "positive"
        : strength === "weak"
          ? "caution"
          : "neutral";
    }
    if (task.type === "daily") {
      const { dueToday, doneToday } = dailyInfo(task);
      return dueToday && !doneToday ? "caution" : "neutral";
    }
    return isOverdue(task, today) ? "caution" : "neutral";
  }

  return (
    <TooltipProvider delay={300}>
      <div className="flex min-h-svh flex-col">
        <header className="sticky top-0 z-10 border-border border-b bg-background/90 backdrop-blur">
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6">
            <Wordmark heading className="mr-auto" />

            {/* Outside the boundary below: it is a plain reading of
                navigator.onLine with nothing to throw, and it reports on the
                connection the account menu needs to work. */}
            <OfflineIndicator pending={tracker.pendingWrites} />

            {/* The header is the one part that must survive anything: it
                holds the way out. Inline, so a failure here stays a quiet row
                rather than a card in the middle of the bar. */}
            <ErrorBoundary section="The account menu" variant="inline">
              <div className="flex items-center gap-2">
                <ThemeToggle />
                {/* The stored value is a path; the public URL is built from
                    it. Until the tracker loads there is no profile to edit,
                    so the photo controls stay out rather than failing on use. */}
                <ProfileMenu
                  photoUrl={
                    tracker.data?.avatarPath
                      ? avatarPublicUrl(tracker.data.avatarPath)
                      : null
                  }
                  onChangePhoto={tracker.data ? tracker.setAvatar : undefined}
                  onRemovePhoto={
                    tracker.data ? tracker.removeAvatar : undefined
                  }
                />
              </div>
            </ErrorBoundary>
          </div>
        </header>

        {state.status === "error" ? (
          <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
            <p className="font-medium text-foreground">
              Your tasks couldn't be loaded.
            </p>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {state.message}
            </p>
            <Button variant="outline" onClick={tracker.reload}>
              <RotateCw aria-hidden="true" />
              Try again
            </Button>
          </main>
        ) : (
          <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
            {/* Toolbar: find things on the left, make things on the right. */}
            <ErrorBoundary section="The toolbar">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
                {/* Full width below sm, so it takes the first row on its own
                    and Tags and Add task share the second. Left to wrap on
                    their own, Search and Tags fill row one and Add task is
                    stranded right on a row of its own. */}
                <div className="relative w-full sm:w-auto sm:min-w-48 sm:max-w-md sm:flex-1">
                  <Search
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    type="search"
                    aria-label="Search your tasks"
                    placeholder="Search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="h-11 pl-9 sm:h-9"
                  />
                </div>
                <TagFilter
                  tags={data?.tags ?? []}
                  selected={activeTags}
                  onChange={setTagFilter}
                  onClearAll={() => {
                    setTagFilter(new Set());
                    setSearch("");
                  }}
                  onSaveEdits={tracker.saveTagEdits}
                />
                <div className="ml-auto">
                  <AddTaskMenu onPick={setCreatingType} />
                </div>
              </div>
            </ErrorBoundary>

            {/* One boundary per column, not one around the grid: a bad row in
                To-dos should cost you To-dos, not the whole board. */}
            {/* One column on a phone, two on a tablet, three once there is
                room for all three. At sm the third wraps under the first two,
                which is fine — they are independent lists, not a table. */}
            <div className="grid flex-1 grid-cols-1 gap-8 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
              <ErrorBoundary section="Habits">
                <TaskColumn
                  id="habits"
                  title="Habits"
                  count={habits.length}
                  countLabel="habits"
                  addPlaceholder="Add a habit"
                  filters={[
                    { value: "all", label: "All" },
                    { value: "weak", label: "Weak" },
                    { value: "strong", label: "Strong" },
                  ]}
                  defaultFilter="all"
                  loading={loading}
                  onAdd={(title) => tracker.addTask("habit", title)}
                  error={columnErrors.habit}
                  onDismissError={dismiss("habit")}
                  notice={columnNotices.habit}
                  empty={{
                    icon: Diff,
                    title: "These are your habits",
                    body: "Habits have no fixed schedule. Log them as many times a day as they happen.",
                  }}
                  renderList={(filter) => {
                    const list = habits
                      .map((task) => ({ task, ...habitInfo(task) }))
                      .filter(
                        ({ strength }) =>
                          filter === "all" || strength === filter,
                      );
                    if (list.length === 0) {
                      return habits.length ? (
                        <FilteredOut>No {filter} habits right now.</FilteredOut>
                      ) : (
                        noMatch && <FilteredOut>{noMatch}</FilteredOut>
                      );
                    }
                    return list.map(({ task, ...info }) => (
                      <HabitCard
                        key={task.id}
                        task={task}
                        {...info}
                        pending={pendingIds.has(task.id)}
                        onTap={(direction) =>
                          run("habit", tracker.tapHabit(task.id, direction))
                        }
                        onOpen={() => setEditingId(task.id)}
                        menu={menuFor(task)}
                      />
                    ));
                  }}
                />
              </ErrorBoundary>

              <ErrorBoundary section="Dailies">
                <TaskColumn
                  id="dailies"
                  title="Dailies"
                  count={
                    dailies.filter((task) => {
                      const info = dailyInfo(task);
                      return info.dueToday && !info.doneToday;
                    }).length
                  }
                  countLabel="dailies left today"
                  addPlaceholder="Add a daily"
                  filters={[
                    { value: "all", label: "All" },
                    { value: "due", label: "Due" },
                    { value: "notDue", label: "Not due" },
                  ]}
                  defaultFilter="all"
                  loading={loading}
                  onAdd={(title) => tracker.addTask("daily", title)}
                  error={columnErrors.daily}
                  onDismissError={dismiss("daily")}
                  notice={columnNotices.daily}
                  empty={{
                    icon: CalendarDays,
                    title: "These are your dailies",
                    body: "Dailies repeat on a schedule. Choose the rhythm that suits you.",
                  }}
                  renderList={(filter) => {
                    const list = dailies
                      .map((task) => ({ task, ...dailyInfo(task) }))
                      .filter(
                        ({ dueToday }) =>
                          filter === "all" ||
                          (filter === "due" ? dueToday : !dueToday),
                      );
                    if (list.length === 0) {
                      return dailies.length ? (
                        <FilteredOut>
                          {filter === "due"
                            ? "Nothing due today."
                            : "Everything is due today."}
                        </FilteredOut>
                      ) : (
                        noMatch && <FilteredOut>{noMatch}</FilteredOut>
                      );
                    }
                    return list.map(({ task, ...info }) => (
                      <DailyCard
                        key={task.id}
                        task={task}
                        {...info}
                        pending={pendingIds.has(task.id)}
                        onToggle={(done) =>
                          run("daily", tracker.toggleDaily(task.id, done))
                        }
                        onOpen={() => setEditingId(task.id)}
                        menu={menuFor(task)}
                      />
                    ));
                  }}
                />
              </ErrorBoundary>

              <ErrorBoundary section="To-dos">
                <TaskColumn
                  id="todos"
                  title="To-dos"
                  count={todos.filter((task) => !task.completed_at).length}
                  countLabel="to-dos open"
                  addPlaceholder="Add a to-do"
                  filters={[
                    { value: "active", label: "Active" },
                    { value: "scheduled", label: "Scheduled" },
                    { value: "complete", label: "Complete" },
                  ]}
                  defaultFilter="active"
                  loading={loading}
                  onAdd={(title) => tracker.addTask("todo", title)}
                  error={columnErrors.todo}
                  onDismissError={dismiss("todo")}
                  notice={columnNotices.todo}
                  empty={{
                    icon: SquareCheckBig,
                    title: "These are your to-dos",
                    body: "To-dos are done once. Give one a due date to schedule it.",
                  }}
                  renderList={(filter) => {
                    const list = todos.filter((task) => {
                      const done = task.completed_at !== null;
                      if (filter === "complete") return done;
                      if (filter === "scheduled")
                        return !done && task.due_date !== null;
                      return !done;
                    });
                    if (list.length === 0) {
                      if (!todos.length)
                        return noMatch && <FilteredOut>{noMatch}</FilteredOut>;
                      return (
                        <FilteredOut>
                          {filter === "complete"
                            ? "Nothing completed yet."
                            : filter === "scheduled"
                              ? "No to-dos with a due date."
                              : "All clear."}
                        </FilteredOut>
                      );
                    }
                    return list.map((task) => (
                      <TodoCard
                        key={task.id}
                        task={task}
                        overdue={isOverdue(task, today)}
                        pending={pendingIds.has(task.id)}
                        onToggle={(done) =>
                          run("todo", tracker.toggleTodo(task.id, done))
                        }
                        onOpen={() => setEditingId(task.id)}
                        menu={menuFor(task)}
                      />
                    ));
                  }}
                />
              </ErrorBoundary>
            </div>
          </main>
        )}

        {/* Mounted from the first time a dialog is opened and never unmounted
            after, rather than rendered only while open. They close with
            `animate-out`, and a component that vanishes the instant its task
            goes null never gets to play it. */}
        {dialogsUsed && (
          <Suspense fallback={null}>
            <TaskCreateDialog
              type={creatingType}
              tracker={tracker}
              onClose={() => setCreatingType(null)}
            />

            <TaskEditDialog
              task={editing}
              tone={toneOf(editing)}
              tracker={tracker}
              onClose={() => setEditingId(null)}
            />

            <DeleteTaskDialog
              task={deleting}
              onOpenChange={(open) => !open && setDeletingId(null)}
              onDelete={tracker.removeTask}
            />
          </Suspense>
        )}
      </div>
    </TooltipProvider>
  );
}

function groupBy(logs: readonly HabitLog[]) {
  const byTask = new Map<string, HabitLog[]>();
  for (const log of logs) {
    const list = byTask.get(log.task_id);
    if (list) list.push(log);
    else byTask.set(log.task_id, [log]);
  }
  return byTask;
}

export { TrackerPage };
