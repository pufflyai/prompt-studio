import { createWorkbenchStore } from "@pstdio/workbench";
import { useSyncExternalStore } from "react";

// Extensions paused from the performance monitor in this window. Their views
// unload until Resume. Nothing is stored, so restarting the app resumes them.
const store = createWorkbenchStore<{ paused: ReadonlySet<string> }>({
  name: "dashboard.paused-extensions",
  initialState: { paused: new Set() },
});

const replace = (next: ReadonlySet<string>) => {
  store.setState({ paused: next }, false, "replacePaused");
};

export const pausedExtensions = {
  get: () => store.getState().paused,
  pause: (installedExtensionId: string) => {
    const paused = store.getState().paused;
    if (!paused.has(installedExtensionId)) replace(new Set([...paused, installedExtensionId]));
  },
  resume: (installedExtensionId: string) => {
    const paused = store.getState().paused;
    if (paused.has(installedExtensionId)) replace(new Set([...paused].filter((id) => id !== installedExtensionId)));
  },
  subscribe: (listener: () => void) => store.subscribeSelector((state) => state.paused, listener),
};

export const usePausedExtensions = () => useSyncExternalStore(pausedExtensions.subscribe, pausedExtensions.get);
