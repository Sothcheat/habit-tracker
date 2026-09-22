import { ChevronDown, Plus, SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useFocusRequest } from "@/hooks/useFocusRequest";
import type { Tag } from "@/lib/tasks/api";
import type { Result } from "@/lib/tasks/useTracker";
import { cn } from "@/lib/utils";

type TagEdits = {
  renamed: { id: string; name: string }[];
  created: string[];
  deleted: string[];
};

type TagFilterProps = {
  tags: Tag[];
  selected: ReadonlySet<string>;
  onChange: (next: Set<string>) => void;
  /** Clears the tag selection AND the search box. */
  onClearAll: () => void;
  onSaveEdits: (edits: TagEdits) => Promise<Result>;
};

/**
 * The "Tags" button and its panel. Two modes share one popover:
 *
 * - filter: tick tags to show only tasks carrying ANY of them. Ticks apply
 *   live; Cancel restores the selection from when the panel opened.
 * - edit: rename, remove and add tags. Nothing is written until Save edits,
 *   and Cancel (or closing the panel) discards the lot.
 *
 * A Popover rather than a DropdownMenu: menus capture typing for keyboard
 * navigation, which breaks the text fields edit mode needs.
 */
function TagFilter({
  tags,
  selected,
  onChange,
  onClearAll,
  onSaveEdits,
}: TagFilterProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"filter" | "edit">("filter");
  // What was selected when the panel opened, for Cancel to restore.
  const [snapshot, setSnapshot] = useState<Set<string>>(new Set());

  function handleOpenChange(next: boolean) {
    if (next) setSnapshot(new Set(selected));
    else setMode("filter"); // closing mid-edit discards the edits
    setOpen(next);
  }

  function toggle(id: string, on: boolean) {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    onChange(next);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={<Button variant="outline" className="h-9 gap-2 px-3" />}
      >
        <SlidersHorizontal aria-hidden="true" />
        Tags
        {selected.size > 0 && (
          <Badge variant="secondary" aria-label={`${selected.size} selected`}>
            {selected.size}
          </Badge>
        )}
        <ChevronDown className="text-muted-foreground" aria-hidden="true" />
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(32rem,calc(100vw-2rem))] gap-0 p-0"
      >
        {mode === "filter" ? (
          <>
            <div className="flex flex-col gap-1 px-5 pt-5">
              <PopoverTitle className="font-semibold text-base">
                Tags
              </PopoverTitle>
              <button
                type="button"
                onClick={() => setMode("edit")}
                className="self-start rounded-sm font-medium text-primary text-sm underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                Edit tags
              </button>
            </div>

            <div className="px-5 py-5">
              {tags.length === 0 ? (
                <p className="text-muted-foreground text-sm leading-relaxed">
                  No tags yet. Choose Edit tags to make some.
                </p>
              ) : (
                <ul className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                  {tags.map((tag) => (
                    <li key={tag.id}>
                      <label className="flex cursor-pointer items-center gap-3 text-foreground text-sm">
                        <Checkbox
                          checked={selected.has(tag.id)}
                          onCheckedChange={(on) => toggle(tag.id, on === true)}
                          className="size-5 border-muted-foreground"
                        />
                        <span className="wrap-break-words min-w-0">
                          {tag.name}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex items-center justify-between border-border border-t px-3 py-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  onClearAll();
                  setOpen(false);
                }}
              >
                Clear all filters
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => {
                  onChange(new Set(snapshot));
                  setOpen(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <TagEditor
            tags={tags}
            onCancel={() => setMode("filter")}
            onSave={async (edits) => {
              const result = await onSaveEdits(edits);
              if (!result.error) {
                // A deleted tag can't stay selected, or it would filter
                // everything out with no visible way to undo it.
                if (edits.deleted.length) {
                  const next = new Set(selected);
                  for (const id of edits.deleted) next.delete(id);
                  onChange(next);
                }
                setMode("filter");
              }
              return result;
            }}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

// ─── Edit mode ──────────────────────────────────────────────────────────────

type Draft = { key: string; id: string | null; name: string };

const NEW_TAG_ID = "tag-editor-new";

function TagEditor({
  tags,
  onCancel,
  onSave,
}: {
  tags: Tag[];
  onCancel: () => void;
  onSave: (edits: TagEdits) => Promise<Result>;
}) {
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    tags.map((tag) => ({ key: tag.id, id: tag.id, name: tag.name })),
  );
  const [newName, setNewName] = useState("");
  const [newError, setNewError] = useState<string | null>(null);
  const [invalidKeys, setInvalidKeys] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const requestFocus = useFocusRequest();

  const isTaken = (name: string, exceptKey?: string) =>
    drafts.some(
      (d) =>
        d.key !== exceptKey &&
        d.name.trim().toLowerCase() === name.trim().toLowerCase(),
    );

  /** Adds the typed name as a draft. Returns false if it was refused. */
  function addNew(): boolean {
    const name = newName.trim();
    if (!name) return true;
    if (isTaken(name)) {
      setNewError(`"${name}" is already in the list.`);
      return false;
    }
    setDrafts((current) => [
      ...current,
      { key: `new-${crypto.randomUUID()}`, id: null, name },
    ]);
    setNewName("");
    setNewError(null);
    return true;
  }

  async function handleSave() {
    setSaveError(null);
    // Text left in "New tag" counts — nobody expects to lose it on Save.
    if (!addNew()) return;

    // Read the drafts including anything addNew just queued.
    const pendingName = newName.trim();
    const all: Draft[] = pendingName
      ? [...drafts, { key: "pending", id: null, name: pendingName }]
      : drafts;

    const invalid = new Set<string>();
    const seen = new Map<string, string>();
    for (const draft of all) {
      const name = draft.name.trim().toLowerCase();
      if (!name) invalid.add(draft.key);
      const clash = seen.get(name);
      if (name && clash) {
        invalid.add(draft.key);
        invalid.add(clash);
      }
      seen.set(name, draft.key);
    }
    setInvalidKeys(invalid);
    if (invalid.size) {
      setSaveError(
        [...invalid].some((key) => !all.find((d) => d.key === key)?.name.trim())
          ? "Tags can't be blank. Remove one instead of emptying it."
          : "Two tags have the same name.",
      );
      return;
    }

    const kept = new Set(all.flatMap((d) => (d.id ? [d.id] : [])));
    const edits: TagEdits = {
      deleted: tags.filter((tag) => !kept.has(tag.id)).map((tag) => tag.id),
      renamed: all.flatMap((d) => {
        const original = tags.find((tag) => tag.id === d.id);
        return original && original.name !== d.name.trim()
          ? [{ id: original.id, name: d.name.trim() }]
          : [];
      }),
      created: all.filter((d) => !d.id).map((d) => d.name.trim()),
    };

    if (
      !edits.deleted.length &&
      !edits.renamed.length &&
      !edits.created.length
    ) {
      onCancel();
      return;
    }

    setSaving(true);
    const result = await onSave(edits);
    setSaving(false);
    if (result.error) setSaveError(result.error);
  }

  return (
    <div className="flex flex-col">
      <div className="px-5 pt-5">
        <PopoverTitle className="font-semibold text-base">Tags</PopoverTitle>
      </div>

      <div className="grid grid-cols-1 gap-2 px-5 py-5 sm:grid-cols-2 sm:gap-x-4">
        {drafts.map((draft) => (
          <div key={draft.key} className="flex items-center gap-1">
            <Input
              aria-label={`Tag name${draft.id ? "" : " (new)"}`}
              value={draft.name}
              onChange={(event) => {
                const name = event.target.value;
                setDrafts((current) =>
                  current.map((d) =>
                    d.key === draft.key ? { ...d, name } : d,
                  ),
                );
                if (invalidKeys.has(draft.key)) {
                  setInvalidKeys((keys) => {
                    const next = new Set(keys);
                    next.delete(draft.key);
                    return next;
                  });
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.preventDefault();
              }}
              aria-invalid={invalidKeys.has(draft.key) ? true : undefined}
              disabled={saving}
              className="h-9"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${draft.name.trim() || "this tag"}`}
              onClick={() =>
                setDrafts((current) =>
                  current.filter((d) => d.key !== draft.key),
                )
              }
              disabled={saving}
              className="text-muted-foreground"
            >
              <X aria-hidden="true" />
            </Button>
          </div>
        ))}

        <div className="flex flex-col gap-1">
          <div className="relative">
            <Plus
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id={NEW_TAG_ID}
              aria-label="New tag — press Enter to add"
              placeholder="New tag"
              value={newName}
              onChange={(event) => {
                setNewName(event.target.value);
                if (newError) setNewError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addNew();
                  requestFocus(NEW_TAG_ID);
                }
              }}
              aria-invalid={newError ? true : undefined}
              aria-describedby={newError ? `${NEW_TAG_ID}-error` : undefined}
              disabled={saving}
              className="h-9 pl-9"
            />
          </div>
          {newError && (
            <p id={`${NEW_TAG_ID}-error`} className="text-destructive text-xs">
              {newError}
            </p>
          )}
        </div>
      </div>

      <p
        aria-live="polite"
        className={cn("px-5 pb-3 text-destructive text-sm empty:hidden")}
      >
        {saveError}
      </p>

      <div className="flex items-center justify-end gap-2 border-border border-t px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save edits"}
        </Button>
      </div>
    </div>
  );
}

export { TagFilter };
