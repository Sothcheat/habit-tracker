import { CloudOff, CloudUpload } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { cn } from "@/lib/utils";

/**
 * A quiet chip in the header: shown while the browser reports no connection,
 * and while writes are still waiting to be sent.
 *
 * It is not `destructive`: nothing the user did failed, and red here would
 * outrank the real errors the columns raise when a write is refused. It is not
 * `caution` either — that token means task state, and borrowing it would make
 * "you are offline" look like "this daily is due".
 *
 * The live region is rendered unconditionally and filled later, per the
 * design system: a region that appears at the same moment as its text is
 * announced unreliably. It collapses with `empty:hidden`, so it takes no space
 * in the header when there is nothing to say.
 */
function OfflineIndicator({
  pending = 0,
  className,
}: {
  /** Writes held in the outbox, waiting for the connection to come back. */
  pending?: number;
  className?: string;
}) {
  const online = useOnlineStatus();
  const waiting = pending > 0;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("empty:hidden", className)}
    >
      {online && !waiting ? null : (
        <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-secondary px-2.5 font-medium text-secondary-foreground text-xs">
          {online ? (
            <CloudUpload className="size-3.5" aria-hidden="true" />
          ) : (
            <CloudOff className="size-3.5" aria-hidden="true" />
          )}

          {/* Wordless below sm. The header also has to fit the wordmark, the
              theme toggle and the avatar, and "Offline" is the one part a
              glance does not need — the icon says it, and the sr-only line
              below says it properly. A count still shows as a bare number,
              because how much is waiting is not guessable from an icon. */}
          {online ? null : <span className="hidden sm:inline">Offline</span>}
          {!online && waiting ? (
            <span aria-hidden="true" className="hidden sm:inline">
              ·
            </span>
          ) : null}
          {waiting ? (
            <span className="tabular-nums">
              {pending}
              <span className="hidden sm:inline"> waiting</span>
            </span>
          ) : null}

          <span className="sr-only">
            {online ? "" : "Offline. "}
            {waiting
              ? `${pending} ${pending === 1 ? "change" : "changes"} will be saved when the connection returns.`
              : "Your changes can't be saved until the connection returns."}
          </span>
        </span>
      )}
    </div>
  );
}

export { OfflineIndicator };
