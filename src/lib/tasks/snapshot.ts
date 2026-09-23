import type { TrackerData } from "@/lib/tasks/useTracker";

/**
 * The last tracker state this device saw, so the app opens to your tasks
 * rather than an error when the network is gone.
 *
 * This is the read half of working offline; `outbox.ts` is the write half.
 * Without it the outbox is nearly pointless on a cold start: a queue of taps
 * is no use when there are no cards on screen to tap.
 *
 * It holds exactly what `load()` returns, including any changes the outbox has
 * not sent yet — what you last saw is what you see again.
 */

/**
 * Bump when `TrackerData` changes shape. An old snapshot is then discarded
 * rather than fed to code that expects different fields, which would fail
 * somewhere far away from the cause.
 */
const VERSION = 1;

type Stored = { v: number; data: TrackerData };

const storageKey = (userId: string) => `cadence-snapshot:${userId}`;

export function readSnapshot(userId: string): TrackerData | null {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    return parsed?.v === VERSION ? parsed.data : null;
  } catch {
    // Blocked site data, private mode, or a half-written value.
    return null;
  }
}

export function writeSnapshot(userId: string, data: TrackerData) {
  try {
    const stored: Stored = { v: VERSION, data };
    localStorage.setItem(storageKey(userId), JSON.stringify(stored));
  } catch {
    // Almost always the 5MB quota, reached by a long history of logs. The
    // app is fully working; it just will not open offline. Not worth failing
    // the change the user actually made, so this stays silent.
  }
}

/**
 * Drops the snapshot. Called on sign-out: the next person to use the device
 * should not open the app to someone else's tasks, and unlike the outbox —
 * which holds work still owed to the server — a snapshot is only a copy of
 * what the server already has.
 */
export function clearSnapshot(userId: string) {
  try {
    localStorage.removeItem(storageKey(userId));
  } catch {
    // Nothing to do: if it cannot be removed it cannot have been written.
  }
}
