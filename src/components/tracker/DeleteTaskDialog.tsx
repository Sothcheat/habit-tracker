import { useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { Task } from "@/lib/tasks/api";
import type { Result } from "@/lib/tasks/useTracker";

export const TASK_KIND = {
  habit: "habit",
  daily: "daily",
  todo: "to-do",
} as const;

/**
 * The one confirmation before a task is deleted — shared by the card's ⋮ menu
 * and the editor's "Delete this …" button, so the wording can't drift.
 */
function DeleteTaskDialog({
  task,
  onOpenChange,
  onDelete,
  onDeleted,
}: {
  /** The task to confirm deleting; null keeps the dialog closed. */
  task: Task | null;
  onOpenChange: (open: boolean) => void;
  onDelete: (taskId: string) => Promise<Result>;
  onDeleted?: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!task) return;
    setDeleting(true);
    setError(null);
    const result = await onDelete(task.id);
    setDeleting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onOpenChange(false);
    onDeleted?.();
  }

  const kind = task ? TASK_KIND[task.type] : "task";

  return (
    <AlertDialog
      open={task !== null}
      onOpenChange={(open) => {
        if (!open) setError(null);
        onOpenChange(open);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{task?.title}”?</AlertDialogTitle>
          <AlertDialogDescription>
            {task?.type === "todo"
              ? `This ${kind} will be removed. This can't be undone.`
              : `Its whole history goes with it. This ${kind} and every log of it will be removed, and this can't be undone.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <p aria-live="polite" className="text-destructive text-sm empty:hidden">
          {error}
        </p>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Keep it</AlertDialogCancel>
          {/* A plain button, not AlertDialogAction: the action closes the
              dialog on click, before we know whether the delete worked. */}
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export { DeleteTaskDialog };
