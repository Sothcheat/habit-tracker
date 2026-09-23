import {
  CalendarDays,
  ChevronDown,
  Diff,
  Plus,
  SquareCheckBig,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TaskType } from "@/lib/tasks/api";

// The same icons as each column's explainer, so a type looks the same
// wherever it appears.
const OPTIONS = [
  { type: "habit", label: "Habit", icon: Diff },
  { type: "daily", label: "Daily", icon: CalendarDays },
  { type: "todo", label: "To-do", icon: SquareCheckBig },
] as const satisfies readonly {
  type: TaskType;
  label: string;
  icon: typeof Diff;
}[];

/** "Add task": the one primary action on the tracker, opening a create dialog. */
function AddTaskMenu({ onPick }: { onPick: (type: TaskType) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button className="h-11 gap-1.5 px-3.5 sm:h-9" />}
      >
        <Plus aria-hidden="true" />
        Add task
        <ChevronDown className="opacity-70" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {OPTIONS.map(({ type, label, icon: Icon }) => (
          <DropdownMenuItem key={type} onClick={() => onPick(type)}>
            <Icon aria-hidden="true" />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { AddTaskMenu };
