import { cn } from "@/lib/utils";

/**
 * State colour for a card's side strips, from the design system's task-state
 * tokens. Tints, not fills: the strip only hints, the control inside it
 * carries the contrast.
 */
export type Tone = "positive" | "caution" | "neutral";

export const STRIP_TONE: Record<Tone, string> = {
  positive: "bg-positive/25",
  caution: "bg-caution/30",
  neutral: "bg-muted",
};

type TaskCardProps = {
  title: string;
  notes?: string | null;
  /** Dims the title — a completed daily or to-do. */
  done?: boolean;
  /** Request in flight: the card fades and its controls disable. */
  pending?: boolean;
  left: React.ReactNode;
  leftTone: Tone;
  right?: React.ReactNode;
  rightTone?: Tone;
  /** Small facts along the bottom edge: priority, streak, due date, tags. */
  meta?: React.ReactNode;
  /** The ⋮ options menu, pinned to the body's top-right corner. */
  menu?: React.ReactNode;
  onOpen: () => void;
};

/**
 * The shared shape of a habit, daily or to-do: a control strip on the left,
 * an optional one on the right, and a body that opens the editor.
 *
 * Alignment is one shared measurement, not per-control nudges: the title's
 * first line is centred 24px from the top (12px padding + half its 24px line),
 * and every strip control is centred on that same line — a 32px habit button
 * from 8px down, a 28px checkbox from 10px down.
 */
function TaskCard({
  title,
  notes,
  done = false,
  pending = false,
  left,
  leftTone,
  right,
  rightTone = "neutral",
  meta,
  menu,
  onOpen,
}: TaskCardProps) {
  return (
    <article
      aria-busy={pending}
      className={cn(
        // group/card: the ⋮ menu reveals itself on this card's hover/focus.
        // The border lifts to the ring colour so the target is unmistakable.
        "group/card flex min-h-19 overflow-hidden rounded-lg border border-border bg-card shadow-xs transition-[opacity,border-color,box-shadow] focus-within:border-ring/70 hover:border-ring/70 hover:shadow-sm",
        pending && "opacity-60",
      )}
    >
      <div
        className={cn(
          "flex w-14 shrink-0 justify-center pt-2",
          STRIP_TONE[leftTone],
        )}
      >
        {left}
      </div>

      {/* The menu sits beside the body button, not inside it — interactive
          elements nested in a button are invalid HTML. */}
      <div className="relative flex min-w-0 flex-1">
        <button
          type="button"
          onClick={onOpen}
          className={cn(
            "flex min-w-0 flex-1 flex-col px-4 py-3 text-left outline-none transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset",
          )}
        >
          <span className="sr-only">Edit: </span>
          <span
            className={cn(
              "wrap-break-words font-medium text-base text-card-foreground leading-6",
              // Only the title shares a band with the ⋮ button (which spans
              // 8–36px from the right edge), so only it needs clearance:
              // 16px body padding + 24px here = 40px. Notes and the meta
              // row sit below the button and keep the normal 16px edge.
              menu && "pr-6",
              done && "text-muted-foreground line-through",
            )}
          >
            {title}
          </span>
          {notes && (
            <span className="mt-0.5 line-clamp-2 text-muted-foreground text-sm leading-relaxed">
              {notes}
            </span>
          )}
          {meta && (
            <span className="mt-auto flex items-center justify-end gap-3 pt-2 text-muted-foreground text-xs">
              {meta}
            </span>
          )}
        </button>
        {menu && <div className="absolute top-2.5 right-2">{menu}</div>}
      </div>

      {right && (
        <div
          className={cn(
            "flex w-14 shrink-0 justify-center pt-2",
            STRIP_TONE[rightTone],
          )}
        >
          {right}
        </div>
      )}
    </article>
  );
}

export { TaskCard };
