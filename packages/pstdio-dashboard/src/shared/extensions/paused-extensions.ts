import { useSyncExternalStore } from "react";

// Extensions paused from the performance monitor in this window. Their views
// unload until Resume. Nothing is stored, so restarting the app resumes them.
let paused: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();

const replace = (next: ReadonlySet<string>) => {
  paused = next;
  for (const listener of listeners) listener();
};

export const pausedExtensions = {
  get: () => paused,
  pause: (installedExtensionId: string) => {
    if (!paused.has(installedExtensionId)) replace(new Set([...paused, installedExtensionId]));
  },
  resume: (installedExtensionId: string) => {
    if (paused.has(installedExtensionId)) replace(new Set([...paused].filter((id) => id !== installedExtensionId)));
  },
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export const usePausedExtensions = () => useSyncExternalStore(pausedExtensions.subscribe, pausedExtensions.get);
