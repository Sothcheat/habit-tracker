import { CircleAlert, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFocusRequest } from "@/hooks/useFocusRequest";
import type { Result } from "@/lib/tasks/useTracker";

export type ColumnFilter<V extends string> = { value: V; label: string };

type TaskColumnProps<V extends string> = {
  id: string;
  title: string;
  /** Shown in the badge — what still wants attention, not the total. */
  count: number;
  countLabel: string;
  addPlaceholder: string;
  filters: readonly ColumnFilter<V>[];
  defaultFilter: V;
  /** Renders the list for one filter value. */
  renderList: (filter: V) => React.ReactNode;
  onAdd: (title: string) => Promise<Result>;
  /** Last failed card action in this column, if any. */
  error: string | null;
  /** A quiet confirmation, e.g. "Copied to clipboard". Not an error. */
  notice?: string | null;
  onDismissError: () => void;
  loading: boolean;
  empty: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    body: string;
  };
};

function TaskColumn<V extends string>({
  id,
  title,
  count,
  countLabel,
  addPlaceholder,
  filters,
  defaultFilter,
  renderList,
  onAdd,
  error,
  onDismissError,
  notice,
  loading,
  empty,
}: TaskColumnProps<V>) {
  const [filter, setFilter] = useState<V>(defaultFilter);
  const EmptyIcon = empty.icon;

  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="flex min-w-0 flex-col"
    >
      <Tabs
        value={filter}
        onValueChange={(value) => setFilter(value as V)}
        className="gap-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h2
            id={`${id}-heading`}
            className="flex items-center gap-2 font-semibold text-foreground text-lg tracking-tight"
          >
            {title}
            {!loading && (
              <Badge aria-label={`${count} ${countLabel}`}>{count}</Badge>
            )}
          </h2>
          <TabsList variant="line" aria-label={`Filter ${title.toLowerCase()}`}>
            {filters.map((option) => (
              <TabsTrigger
                key={option.value}
                value={option.value}
                className="px-2 text-xs"
              >
                {option.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="flex flex-1 flex-col gap-2 rounded-xl bg-muted p-3 sm:min-h-[28rem] lg:min-h-[calc(100svh-13.5rem)]">
          <AddTaskForm
            id={id}
            placeholder={addPlaceholder}
            onAdd={onAdd}
            disabled={loading}
          />

          {/* Always rendered so it exists before a message arrives. */}
          <div aria-live="polite" className="empty:hidden">
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-sm">
                <CircleAlert
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                <p className="flex-1 leading-relaxed">{error}</p>
                <button
                  type="button"
                  onClick={onDismissError}
                  aria-label="Dismiss"
                  className="tap-target rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>
            )}

            {/* A confirmation, not an alert: quiet, per the design system —
                red is for something the user did that failed. */}
            {notice && (
              <div className="rounded-lg border border-border bg-secondary px-3 py-2 text-secondary-foreground text-sm">
                {notice}
              </div>
            )}
          </div>

          {loading ? (
            <ColumnSkeleton />
          ) : (
            filters.map((option) => (
              <TabsContent
                key={option.value}
                value={option.value}
                className="flex flex-col gap-2"
              >
                {renderList(option.value)}
              </TabsContent>
            ))
          )}

          <div className="mt-auto flex flex-col items-center gap-2 px-4 pt-10 pb-6 text-center">
            <EmptyIcon
              className="size-7 text-muted-foreground/70"
              aria-hidden="true"
            />
            <p className="font-medium text-muted-foreground text-sm">
              {empty.title}
            </p>
            <p className="max-w-xs text-muted-foreground text-xs leading-relaxed">
              {empty.body}
            </p>
          </div>
        </div>
      </Tabs>
    </section>
  );
}

function AddTaskForm({
  id,
  placeholder,
  onAdd,
  disabled,
}: {
  id: string;
  placeholder: string;
  onAdd: (title: string) => Promise<Result>;
  disabled: boolean;
}) {
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestFocus = useFocusRequest();
  const inputId = `${id}-add`;
  const errorId = `${id}-add-error`;

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;

    setPending(true);
    setError(null);
    const result = await onAdd(title);
    setPending(false);

    if (result.error) {
      // Keep what they typed; only the request failed, not their input.
      setError(result.error);
    } else {
      setTitle("");
    }
    // The input was disabled while saving; focus once it is enabled again,
    // so several can be added in a row without reaching for the mouse.
    requestFocus(inputId);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="sr-only">
        {placeholder}
      </label>
      <Input
        id={inputId}
        value={title}
        onChange={(event) => {
          setTitle(event.target.value);
          if (error) setError(null);
        }}
        placeholder={pending ? "Adding…" : placeholder}
        disabled={disabled || pending}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        enterKeyHint="done"
        className="h-11 border-transparent bg-card px-3.5 shadow-xs sm:h-10"
      />
      {error && (
        <p
          id={errorId}
          className="px-1 text-destructive text-xs leading-relaxed"
        >
          {error}
        </p>
      )}
    </form>
  );
}

function ColumnSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      {[0, 1, 2].map((row) => (
        <Skeleton key={row} className="h-20 rounded-lg bg-card/70" />
      ))}
    </div>
  );
}

/** Shown in place of a list when a filter matches nothing. */
function FilteredOut({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-1 py-6 text-center text-muted-foreground text-sm">
      {children}
    </p>
  );
}

export { FilteredOut, TaskColumn };
