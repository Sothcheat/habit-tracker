import { Monitor, Moon, Sun } from "lucide-react";
import { type Theme, useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "system", label: "System", icon: Monitor },
  { value: "dark", label: "Dark", icon: Moon },
] as const satisfies readonly {
  value: Theme;
  label: string;
  icon: typeof Sun;
}[];

/**
 * Three-way theme control. "System" is a real option rather than an implicit
 * default, so picking light does not permanently opt out of following the OS.
 *
 * Built on real radio inputs: single-choice semantics, and the browser gives
 * arrow-key navigation and the roving tab stop for free.
 */
function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <fieldset
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5",
        className,
      )}
    >
      <legend className="sr-only">Colour theme</legend>

      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <label key={value} title={label} className="contents">
          <input
            type="radio"
            name="theme"
            value={value}
            checked={theme === value}
            onChange={() => setTheme(value)}
            className="peer sr-only"
          />
          <span className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground peer-checked:bg-secondary peer-checked:text-secondary-foreground peer-focus-visible:outline-2 peer-focus-visible:outline-ring peer-focus-visible:outline-offset-1">
            <Icon className="size-3.5" aria-hidden="true" />
            <span className="sr-only">{label}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

export { ThemeToggle };
