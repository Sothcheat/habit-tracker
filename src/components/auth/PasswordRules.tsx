import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { PASSWORD_RULES } from "@/lib/validation";

/**
 * Live checklist of sign-up password requirements. Shown from the start so
 * nobody has to fail a submit to learn the rules.
 *
 * Met rules go to full foreground rather than green: the palette has no
 * success colour, and contrast alone reads clearly. Unmet rules only turn
 * destructive once the user has tried to submit — red before then would scold
 * someone who has barely started typing.
 */
function PasswordRules({
  value,
  showErrors,
}: {
  value: string;
  showErrors: boolean;
}) {
  return (
    <ul className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(value);
        return (
          <li
            key={rule.id}
            className={cn(
              "flex items-center gap-1.5 transition-colors",
              met
                ? "text-foreground"
                : showErrors
                  ? "text-destructive"
                  : "text-muted-foreground",
            )}
          >
            {met ? (
              <Check className="size-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <Circle className="size-3 shrink-0" aria-hidden="true" />
            )}
            {rule.label}
            <span className="sr-only">{met ? " (met)" : " (not met)"}</span>
          </li>
        );
      })}
    </ul>
  );
}

export { PasswordRules };
