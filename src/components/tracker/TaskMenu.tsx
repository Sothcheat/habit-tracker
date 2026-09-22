import {
  ArrowDown,
  ArrowUp,
  EllipsisVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type TaskMenuActions = {
  onEdit: () => void;
  onMoveTop: () => void;
  onMoveBottom: () => void;
  onDelete: () => void;
  /** Already first / last in its column: that move would do nothing. */
  isFirst: boolean;
  isLast: boolean;
};

/**
 * The ⋮ "Options" button on a card. It's hidden until the card is hovered or
 * focused, but stays in the tab order and appears on focus. On touch screens,
 * which have no hover, it's always shown.
 */
function TaskMenu({
  title,
  disabled,
  onEdit,
  onMoveTop,
  onMoveBottom,
  onDelete,
  isFirst,
  isLast,
}: TaskMenuActions & { title: string; disabled: boolean }) {
  return (
    <DropdownMenu>
      <Tooltip>
        {/* One element, two roles: the Tooltip trigger renders as the Menu
            trigger, which renders the button. Base UI merges their props. */}
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              disabled={disabled}
              aria-label={`Options for "${title}"`}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-0 outline-none transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none group-focus-within/card:opacity-100 group-hover/card:opacity-100 data-popup-open:opacity-100 [@media(hover:none)]:opacity-100"
            />
          }
        >
          <EllipsisVertical className="size-4" aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>Options</TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={onEdit}>
          <Pencil aria-hidden="true" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onMoveTop} disabled={isFirst}>
          <ArrowUp aria-hidden="true" />
          To top
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onMoveBottom} disabled={isLast}>
          <ArrowDown aria-hidden="true" />
          To bottom
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 aria-hidden="true" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { TaskMenu };
