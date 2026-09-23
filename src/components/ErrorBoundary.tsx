import { RotateCw } from "lucide-react";
import { Component, type ErrorInfo, Fragment, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Contains a render crash to one part of the page.
 *
 * Without a boundary, an exception thrown during render unmounts the entire
 * tree — React's deliberate choice, on the grounds that a half-rendered UI is
 * worse than none. That is the right default for the whole app and the wrong
 * one for a column: a to-do that trips a bug should not take the habits with
 * it. Wrapping each section means the blast radius is the section.
 *
 * This has to be a class. Boundaries are the one thing hooks still cannot do —
 * there is no `useErrorBoundary`, because `getDerivedStateFromError` has to run
 * during React's own error-handling pass, before any hook could be called.
 *
 * Two caveats worth knowing, since they look like the boundary failing:
 *
 *   * It catches errors thrown *during render*, in lifecycles and in
 *     constructors. It does not catch them in event handlers, in `setTimeout`,
 *     or in a promise nobody awaited — those never interrupt a render, so React
 *     lets them reach `window.onerror`. Async failures are the tracker's
 *     `Result` type instead, shown inline.
 *   * In development the overlay still appears on top of the fallback. That is
 *     Vite, not this component; the fallback is underneath, and in a
 *     production build it is all you see.
 */

type Props = {
  children: ReactNode;
  /**
   * What broke, named for the user — "Habits", "the toolbar". It is read in a
   * sentence, so it carries its own article where one is needed.
   */
  section: string;
  /**
   * `block` fills the space the section occupied, for a column or a panel.
   * `inline` is a single quiet row, for something small in a header where a
   * full card would be louder than the thing it replaced.
   */
  variant?: "block" | "inline";
  className?: string;
};

type State = {
  error: Error | null;
  /** Bumped on every retry, to force the subtree to build from scratch. */
  attempt: number;
};

class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, attempt: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // The component stack says which child threw, which the error alone does
    // not. This is where a reporting service would be called.
    console.error(
      `[${this.props.section}] crashed:`,
      error,
      info.componentStack,
    );
  }

  /**
   * Clearing the error re-renders the same children. If whatever threw is
   * still true — a malformed row, say — they throw again and the fallback
   * comes straight back, which is the honest outcome. Incrementing `attempt`
   * changes the subtree's key so it remounts rather than resuming from the
   * state that broke it, which is what makes a retry worth offering at all.
   */
  handleRetry = () => {
    this.setState((previous) => ({
      error: null,
      attempt: previous.attempt + 1,
    }));
  };

  render() {
    const { children, section, variant = "block", className } = this.props;
    const { error, attempt } = this.state;

    // A keyed Fragment, not a div: these wrap grid and flex children, and an
    // extra element would become the grid item in their place and break the
    // layout. A Fragment takes a key, adds no DOM, and changing that key is
    // what remounts the subtree on retry.
    if (!error) {
      return <Fragment key={attempt}>{children}</Fragment>;
    }

    if (variant === "inline") {
      return (
        <div
          role="alert"
          className={cn("flex items-center gap-2 text-sm", className)}
        >
          <span className="text-muted-foreground">
            {section} isn't working.
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={this.handleRetry}
            className="h-8"
          >
            <RotateCw aria-hidden="true" />
            Try again
          </Button>
        </div>
      );
    }

    return (
      <div
        role="alert"
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-xl border border-border border-dashed p-6 text-center",
          className,
        )}
      >
        <p className="font-medium text-foreground text-sm">
          {section} couldn't be shown.
        </p>
        {/* Deliberately not error.message: it is written for a developer, and
            can carry internals. The console has the real one. */}
        <p className="text-muted-foreground text-sm leading-relaxed">
          Something went wrong in this section. The rest of the page is fine.
        </p>
        <Button variant="outline" onClick={this.handleRetry}>
          <RotateCw aria-hidden="true" />
          Try again
        </Button>
      </div>
    );
  }
}

export { ErrorBoundary };
