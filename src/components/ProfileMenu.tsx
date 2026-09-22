import type { User } from "@supabase/supabase-js";
import { LogOut } from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

/**
 * What to show for a user. Email accounts have no photo, so the fallback is
 * an initial; OAuth providers (Google) supply `avatar_url`, used when present.
 */
function identity(user: User) {
  const meta = user.user_metadata ?? {};
  const email = user.email ?? "";
  const name: string =
    meta.full_name ||
    meta.name ||
    meta.display_name ||
    email.split("@")[0] ||
    "You";
  return {
    name,
    email,
    photo: typeof meta.avatar_url === "string" ? meta.avatar_url : undefined,
    initial: (name.trim()[0] ?? "?").toUpperCase(),
  };
}

function UserAvatar({ user, size }: { user: User; size: "default" | "lg" }) {
  const { photo, initial } = identity(user);
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
 * with who is signed in and a way out. A popover rather than a menu — it is
 * mostly information, with a single action.
 */
function ProfileMenu() {
  const { user } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  if (!user) return null;
  const { name, email } = identity(user);

  async function handleSignOut() {
    setSigningOut(true);
    // On success the auth listener sends the user to /login; this component
    // unmounts, so there is nothing to reset. Only a failure lands here.
    const { error } = await supabase.auth.signOut();
    if (error) setSigningOut(false);
  }

  return (
    <Popover>
      <PopoverTrigger
        aria-label={`Account: ${email}`}
        className="rounded-full outline-none transition-opacity hover:opacity-85 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <UserAvatar user={user} size="default" />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-max min-w-56 max-w-[calc(100vw-2rem)] gap-0 p-0"
      >
        <div className="flex items-center gap-3 px-4 py-4">
          <UserAvatar user={user} size="lg" />
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
