import { useSyncExternalStore } from "react";

// Extension views mounted in this window: for each installed extension, how many
// distinct webviews have a mounted frame. The performance popover lists them even
// where no process can be measured.
const frames = new Map<string, Map<string, number>>();
let views: ReadonlyMap<string, number> = new Map();
const listeners = new Set<() => void>();

const change = (installedExtensionId: string, webviewId: string, delta: number) => {
  const webviews = frames.get(installedExtensionId) ?? new Map<string, number>();
  const count = (webviews.get(webviewId) ?? 0) + delta;
  if (count > 0) webviews.set(webviewId, count);
  else webviews.delete(webviewId);
  if (webviews.size > 0) frames.set(installedExtensionId, webviews);
  else frames.delete(installedExtensionId);
  views = new Map([...frames].map(([id, mounted]) => [id, mounted.size]));
  for (const listener of listeners) listener();
};

export const openExtensionViews = {
  get: () => views,
  open: (installedExtensionId: string, webviewId: string) => {
    change(installedExtensionId, webviewId, 1);
    return () => change(installedExtensionId, webviewId, -1);
  },
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export const useOpenExtensionViews = () => useSyncExternalStore(openExtensionViews.subscribe, openExtensionViews.get);
