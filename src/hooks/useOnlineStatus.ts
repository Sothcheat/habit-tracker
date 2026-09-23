import { useSyncExternalStore } from "react";

/**
 * Whether the browser currently has a network connection.
 *
 * `navigator.onLine` is only trustworthy in one direction: `false` means there
 * is definitely no connection, while `true` means no more than "a network
 * interface is up" — a captive portal or a dead uplink still reads `true`. So
 * treat this as a reliable "offline", never as a promise of "online".
 *
 * `useSyncExternalStore` rather than `useState` + `useEffect`: it is the API
 * built for reading a value that lives outside React. Subscribing in an effect
 * leaves a gap between the first render and the effect running, and a
 * connection dropped inside that gap is never heard.
 */
function subscribe(onStoreChange: () => void) {
  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);
  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
}

const getSnapshot = () => navigator.onLine;

function useOnlineStatus() {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export { useOnlineStatus };
