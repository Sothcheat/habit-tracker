import type { User } from "@supabase/supabase-js";
import { Check, ImageUp, LogOut, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from "@/lib/auth";
import { ACCEPTED_TYPES, validateAvatarFile } from "@/lib/avatar";
import { supabase } from "@/lib/supabase";
import type { Result } from "@/lib/tasks/useTracker";
import { cn } from "@/lib/utils";

/**
 * What the picker offers. The same list the validator enforces — the `accept`
 * attribute only filters the dialog's default view; every platform lets a user
 * switch it to "All files", so it is a convenience, never a check.
 */
const ACCEPT = ACCEPTED_TYPES.join(",");

type Props = {
  /** The user's uploaded photo, already resolved to a URL. */
  photoUrl: string | null;
  /** Absent while the tracker has not loaded — the controls hide rather than fail. */
  onChangePhoto?: (file: File) => Promise<Result>;
  onRemovePhoto?: () => Promise<Result>;
};

/**
 * What to show for a user. An uploaded photo wins; failing that, an OAuth
 * provider (Google) may supply one in its metadata; failing both, an initial.
 */
function identity(user: User, photoUrl: string | null) {
  const meta = user.user_metadata ?? {};
  const email = user.email ?? "";
  const name: string =
    meta.full_name ||
    meta.name ||
    meta.display_name ||
    email.split("@")[0] ||
    "You";
  const providerPhoto =
    typeof meta.avatar_url === "string" ? meta.avatar_url : undefined;
  return {
    name,
    email,
    photo: photoUrl ?? providerPhoto,
    initial: (name.trim()[0] ?? "?").toUpperCase(),
  };
}

function UserAvatar({
  user,
  photoUrl,
  size,
}: {
  user: User;
  photoUrl: string | null;
  size: "default" | "lg";
}) {
  const { photo, initial } = identity(user, photoUrl);
  return (
    // The primitive sizes lg with a data-[size=lg]: variant, which cn() keeps
    // alongside a plain size-12 — so override the variant itself.
    <Avatar size={size} className="data-[size=lg]:size-12">
      {photo && <AvatarImage src={photo} alt="" />}
      <AvatarFallback
        className={cn(
          "bg-secondary font-semibold text-secondary-foreground",
          size === "lg" ? "text-lg" : "text-sm",
        )}
      >
        {initial}
      </AvatarFallback>
    </Avatar>
  );
}

/**
 * The account control in the header: the user's avatar, opening a small panel
 * with who is signed in, their photo and a way out. A popover rather than a
 * menu — it is mostly information, with a few actions.
 */
function ProfileMenu({ photoUrl, onChangePhoto, onRemovePhoto }: Props) {
  const { user } = useAuth();
  const fileInput = useRef<HTMLInputElement>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** The chosen-but-not-yet-uploaded image, held for the preview. */
  const [chosen, setChosen] = useState<{ file: File; preview: string } | null>(
    null,
  );

  // An object URL pins its Blob in memory until revoked, so every preview is
  // released when it is replaced and when this unmounts — including the case
  // where the popover closes mid-choice.
  useEffect(() => {
    if (!chosen) return;
    return () => URL.revokeObjectURL(chosen.preview);
  }, [chosen]);

  if (!user) return null;
  const { name, email } = identity(user, photoUrl);
  const canEditPhoto = Boolean(onChangePhoto);

  async function handleSignOut() {
    setSigningOut(true);
    // On success the auth listener sends the user to /login; this component
    // unmounts, so there is nothing to reset. Only a failure lands here.
    const { error } = await supabase.auth.signOut();
    if (error) setSigningOut(false);
  }

  /**
   * Choosing a file does not upload it. It is validated, and a valid one is
   * held for the preview until the user confirms — so they see what they
   * picked before it becomes their avatar, and a wrong pick costs nothing.
   */
  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Picking the same file twice fires no change event unless the value is
    // cleared — which matters after a rejection, when retrying is the likely
    // move and the obvious retry is the same file.
    event.target.value = "";
    if (!file) return;

    const rejection = validateAvatarFile(file);
    setError(rejection);
    if (rejection) {
      // Keep any existing preview: the new file was refused, so nothing about
      // the previous choice has changed.
      return;
    }
    setChosen({ file, preview: URL.createObjectURL(file) });
  }

  function discardChoice() {
    setChosen(null);
    setError(null);
  }

  async function handleSave() {
    if (!chosen || !onChangePhoto) return;
    setBusy("upload");
    setError(null);
    const result = await onChangePhoto(chosen.file);
    setBusy(null);
    setError(result.error);
    // Only clear on success. A failure keeps the preview on screen so Save can
    // be pressed again without re-picking the file.
    if (!result.error) setChosen(null);
  }

  async function handleRemove() {
    if (!onRemovePhoto) return;
    setBusy("remove");
    setError(null);
    const result = await onRemovePhoto();
    setError(result.error);
    setBusy(null);
  }

  return (
    <Popover>
      <PopoverTrigger
        aria-label={`Account: ${email}`}
        className="rounded-full outline-none transition-opacity hover:opacity-85 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <UserAvatar user={user} photoUrl={photoUrl} size="default" />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-max min-w-56 max-w-[calc(100vw-2rem)] gap-0 p-0"
      >
        <div className="flex items-center gap-3 px-4 py-4">
          {/* While a choice is pending the large avatar shows it, so Save is
              confirming something already visible rather than a filename. */}
          <UserAvatar
            user={user}
            photoUrl={chosen?.preview ?? photoUrl}
            size="lg"
          />
          <div className="flex min-w-0 flex-col">
            <PopoverTitle className="truncate font-semibold text-foreground text-sm">
              {name}
            </PopoverTitle>
            {/* The panel sizes to the email, so it stays on one line. Only an
                address wider than the screen wraps — wrap-anywhere breaks
                when there's no room, where break-all would break anyway. */}
            <span className="wrap-anywhere text-muted-foreground text-sm leading-snug">
              {email}
            </span>
          </div>
        </div>

        {canEditPhoto && (
          <div className="flex flex-col gap-1.5 border-border border-t px-4 py-3">
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInput}
                type="file"
                accept={ACCEPT}
                onChange={handleFile}
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
              />
              {chosen ? (
                <>
                  <Button
                    onClick={handleSave}
                    disabled={busy !== null}
                    className="gap-2"
                  >
                    <Check aria-hidden="true" />
                    {busy === "upload" ? "Saving…" : "Save photo"}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={discardChoice}
                    disabled={busy !== null}
                    className="gap-2 text-muted-foreground"
                  >
                    <X aria-hidden="true" />
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => fileInput.current?.click()}
                    disabled={busy !== null}
                    className="gap-2"
                  >
                    <ImageUp aria-hidden="true" />
                    {photoUrl ? "Change photo" : "Add photo"}
                  </Button>
                  {photoUrl && (
                    <Button
                      variant="ghost"
                      onClick={handleRemove}
                      disabled={busy !== null}
                      aria-label="Remove photo"
                      className="gap-2 text-muted-foreground"
                    >
                      <Trash2 aria-hidden="true" />
                      {busy === "remove" ? "Removing…" : "Remove"}
                    </Button>
                  )}
                </>
              )}
            </div>
            {/* Always rendered so a message lands in a region that already
                exists; empty:hidden keeps it from reserving space when silent. */}
            <p
              aria-live="polite"
              className="text-destructive text-xs leading-relaxed empty:hidden"
            >
              {error}
            </p>
          </div>
        )}

        <div className="border-border border-t p-1.5">
          <Button
            variant="ghost"
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full justify-start gap-2"
          >
            <LogOut aria-hidden="true" />
            {signingOut ? "Signing out…" : "Sign out"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { ProfileMenu };
