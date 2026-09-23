import { useRegisterSW } from "virtual:pwa-register/react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Offers the new version rather than taking it.
 *
 * The service worker is registered with `registerType: "prompt"`, so a new
 * build installs and then waits instead of activating under the user's feet.
 * That matters here: a tracker holds unsaved state — a half-typed task, a
 * dialog mid-edit, an outbox still draining — and reloading the page without
 * asking would throw it away. The user picks the moment.
 *
 * `updateServiceWorker(true)` tells the waiting worker to take over and
 * reloads the page once it has, so the reload and the activation cannot race.
 */
function UpdateToast() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      // A failed registration costs the offline features, not the app, so it
      // is logged rather than shown — there is nothing the user could do.
      console.error("Service worker registration failed", error);
    },
  });

  return (
    // Rendered unconditionally and filled later, per the design system: a live
    // region created at the same moment as its text is announced unreliably.
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex justify-center empty:hidden sm:inset-x-auto sm:right-6 sm:bottom-6"
    >
      {needRefresh && (
        <div className="pointer-events-auto flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-lg sm:w-auto">
          <p className="flex-1 text-card-foreground text-sm">
            New version available
          </p>
          <Button onClick={() => updateServiceWorker(true)}>
            <RefreshCw aria-hidden="true" />
            Refresh
          </Button>
          <Button
            variant="ghost"
            onClick={() => setNeedRefresh(false)}
            aria-label="Dismiss, and keep this version"
          >
            Later
          </Button>
        </div>
      )}
    </div>
  );
}

export { UpdateToast };
