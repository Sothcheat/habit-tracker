import { useEffect, useState } from "react";

/**
 * Moves focus to an element by id *after* the next commit.
 *
 * Focusing inline fails whenever the target is disabled in the current render
 * — e.g. right after a request settles, before `pending = false` has been
 * committed. Browsers silently ignore focus() on disabled inputs. Deferring
 * to an effect runs it once the field is interactive again.
 */
export function useFocusRequest() {
  // Wrapped in an object so asking for the same id twice still re-fires.
  const [request, setRequest] = useState<{ id: string } | null>(null);

  useEffect(() => {
    if (request) document.getElementById(request.id)?.focus();
  }, [request]);

  return (id: string) => setRequest({ id });
}
