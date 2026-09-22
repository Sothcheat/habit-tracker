import { cn } from "@/lib/utils";

export type Feedback = { kind: "error" | "success"; text: string } | null;

/**
 * Status line for an auth form. Always rendered so the live region exists
 * before the message arrives — a region added at the same moment as its text
 * is announced unreliably.
 */
function AuthFeedback({ feedback }: { feedback: Feedback }) {
  return (
    <p
      aria-live="polite"
      className={cn(
        "text-sm leading-relaxed empty:hidden",
        feedback?.kind === "error"
          ? "text-destructive"
          : "text-muted-foreground",
      )}
    >
      {feedback?.text}
    </p>
  );
}

export { AuthFeedback };
