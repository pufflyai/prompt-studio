import type { WorkbenchActivation } from "../../workbench-activation";
import {
  type BrowserHistoryOwner,
  createHistoryId,
  getActiveWindowHistory,
  historyEntryKey,
  unwrapHistoryEntry,
} from "./active-window-history";
import type { WorkbenchPageBrowserEntry, WorkbenchPageLocationBrowser } from "./page-location-types";

export const createActivePageLocationBrowser = (
  browser: WorkbenchPageLocationBrowser,
  activation: WorkbenchActivation,
) => {
  const window = getActiveWindowHistory(browser);
  const entries = [unwrapHistoryEntry(browser.current())];
  let index = 0;
  let written = false;
  let disposed = false;
  const listeners = new Set<(entry: WorkbenchPageBrowserEntry) => void>();
  const current = () => (disposed ? { url: "/" } : entries[index]!);
  const notify = () => {
    for (const listener of listeners) listener(current());
  };
  const pop = (entry: WorkbenchPageBrowserEntry) => {
    if (disposed) return;
    const next = entries.findIndex((candidate) => historyEntryKey(candidate) === historyEntryKey(entry));
    if (next >= 0) index = next;
    else entries[index] = entry;
    notify();
  };
  const step = (direction: number, entry?: WorkbenchPageBrowserEntry) => {
    if (disposed) return;
    const next = Math.max(0, Math.min(entries.length - 1, index + direction));
    // Native history can retain this owner's entries from before its private history was rebuilt.
    if (next === index && entry) {
      pop(entry);
      return;
    }
    window.write(entries[next]!, "replace", owner);
    if (disposed) return;
    if (next === index) return;
    index = next;
    notify();
  };
  const owner: BrowserHistoryOwner = {
    id: createHistoryId(),
    active: () => !disposed && activation.isActive(),
    step,
    pop,
  };
  const unregister = window.register(owner);
  const unsubscribe = activation.store.subscribe((state, previous) => {
    if (!disposed && state.active && !previous.active && written) window.write(current(), "replace", owner);
  });
  const write = (entry: WorkbenchPageBrowserEntry, method: "push" | "replace") => {
    if (disposed) return;
    // Complete a fallible window write before committing private history.
    if (activation.isActive()) window.write(entry, method, owner);
    if (disposed) return;
    if (method === "push") {
      entries.splice(index + 1);
      index++;
    }
    entries[index] = entry;
    written = true;
  };
  const traverse = (direction: number) => {
    if (disposed || !activation.isActive()) return;
    const next = index + direction;
    if (window.isShared() && next >= 0 && next < entries.length) step(direction);
    else if (direction < 0) browser.back();
    else browser.forward();
  };
  return {
    browser: {
      current: () =>
        !disposed && activation.isActive() && !window.isShared() ? unwrapHistoryEntry(browser.current()) : current(),
      push: (entry) => write(entry, "push"),
      replace: (entry) => write(entry, "replace"),
      back: () => traverse(-1),
      forward: () => traverse(1),
      onPopState(listener) {
        if (!disposed) listeners.add(listener);
        return {
          dispose: () => {
            listeners.delete(listener);
          },
        };
      },
    } satisfies WorkbenchPageLocationBrowser,
    inspect: () => ({ entries: entries.length, listeners: listeners.size, ...window.inspect() }),
    dispose() {
      if (disposed) return;
      disposed = true;
      entries.length = 0;
      listeners.clear();
      try {
        unsubscribe();
      } finally {
        unregister();
      }
    },
  };
};
