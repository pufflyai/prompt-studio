import { useSyncExternalStore } from "react";

const subscribe = (listener: () => void) => {
  document.addEventListener("visibilitychange", listener);
  return () => document.removeEventListener("visibilitychange", listener);
};
const visible = () => !document.hidden;

/** Includes the host's visibility updates for retained, inactive webview placements. */
export const useWebviewVisibility = () => useSyncExternalStore(subscribe, visible, () => true);
