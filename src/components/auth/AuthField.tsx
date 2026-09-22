import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type AuthFieldProps = React.ComponentProps<"input"> & {
  id: string;
  label: string;
  /** Rendered at the end of the label row, e.g. a "Forgot password?" link. */
  action?: React.ReactNode;
  /** Validation message. Marks the input invalid and is read with it. */
  error?: string | null;
  /**
   * Marks the input invalid without printing a message — for when the hint
   * already explains what is wrong, as the password checklist does.
   */
  invalid?: boolean;
  /** Persistent guidance under the input, e.g. password requirements. */
  hint?: React.ReactNode;
};

/**
 * A labelled input at auth scale. The shared Input primitive is h-8 for the
 * dense app surface; auth runs at h-11 so a once-seen form feels unhurried.
 *
 * The primitive already styles aria-invalid with the destructive border and
 * ring, so an error only has to set the attribute.
 */
function AuthField({
  id,
  label,
  action,
  error,
  invalid,
  hint,
  className,
  ...props
}: AuthFieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-4">
        <Label htmlFor={id} className="font-medium text-foreground text-sm">
          {label}
        </Label>
        {action}
      </div>
      <Input
        id={id}
        aria-invalid={error || invalid ? true : undefined}
        aria-describedby={describedBy}
        className={cn("h-11 px-3.5 text-sm", className)}
        {...props}
      />
      {error && (
        <p id={errorId} className="text-destructive text-sm leading-relaxed">
          {error}
        </p>
      )}
      {hint && <div id={hintId}>{hint}</div>}
    </div>
  );
}

export { AuthField };
