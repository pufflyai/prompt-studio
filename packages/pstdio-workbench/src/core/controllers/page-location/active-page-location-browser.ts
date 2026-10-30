import type { WorkbenchActivation } from "../../workbench-activation";
import type { WorkbenchPageBrowserEntry, WorkbenchPageLocationBrowser } from "./page-location-types";

interface BrowserOwner {
  active(): boolean;
  pop(entry: WorkbenchPageBrowserEntry): void;
  step(direction: number): void;
}

interface WindowHistoryState {
  kind: "pstdio.window-history";
  windowId: string;
  position: number;
  value: unknown;
}
const windowState = (entry: WorkbenchPageBrowserEntry) => {
  const state = entry.state;
  if (!state || typeof state !== "object" || !("kind" in state) || state.kind !== "pstdio.window-history")
    return undefined;
  return state as WindowHistoryState;
};
const unwrap = (entry: WorkbenchPageBrowserEntry) =>
  windowState(entry) ? { url: entry.url, state: windowState(entry)!.value } : entry;
const entryKey = (entry: WorkbenchPageBrowserEntry) => JSON.stringify(unwrap(entry));

/** One window history projects the active owner's history once the browser is shared. */
const createWindowHistory = (browser: WorkbenchPageLocationBrowser) => {
  const windowId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  const owners = new Set<BrowserOwner>();
  const entries = [entryKey(browser.current())];
  let index = 0;
  let shared = false;
  const write = (entry: WorkbenchPageBrowserEntry, method: "push" | "replace") => {
    const position = method === "push" ? index + 1 : index;
    const projected = shared
      ? {
          url: entry.url,
          state: { kind: "pstdio.window-history", windowId, position, value: entry.state } satisfies WindowHistoryState,
        }
      : entry;
    browser[method](projected);
    if (method === "push") {
      entries.splice(index + 1);
      index++;
    }
    entries[index] = entryKey(entry);
  };
  const subscription = browser.onPopState((entry) => {
    const stamp = windowState(entry);
    const nextIndex = stamp?.windowId === windowId ? stamp.position : entries.indexOf(entryKey(entry));
    const direction = nextIndex > index ? 1 : -1;
    if (nextIndex >= 0) index = nextIndex;
    const owner = [...owners].find((owner) => owner.active());
    if (shared) owner?.step(direction);
    else owner?.pop(unwrap(entry));
  });
  return {
    write,
    isShared: () => shared,
    register(owner: BrowserOwner) {
      owners.add(owner);
      shared ||= owners.size > 1;
      return () => {
        owners.delete(owner);
        if (!owners.size) {
          subscription.dispose();
          windows.delete(browser);
        }
      };
    },
  };
};

const windows = new WeakMap<WorkbenchPageLocationBrowser, ReturnType<typeof createWindowHistory>>();

export const createActivePageLocationBrowser = (
  browser: WorkbenchPageLocationBrowser,
  activation: WorkbenchActivation,
) => {
  let windowHistory = windows.get(browser);
  if (!windowHistory) {
    windowHistory = createWindowHistory(browser);
    windows.set(browser, windowHistory);
  }
  const window = windowHistory;
  const entries = [unwrap(browser.current())];
  let index = 0;
  let written = false;
  const listeners = new Set<(entry: WorkbenchPageBrowserEntry) => void>();
  const current = () => entries[index]!;
  const notify = () => {
    for (const listener of listeners) listener(current());
  };
  const step = (direction: number) => {
    const next = Math.max(0, Math.min(entries.length - 1, index + direction));
    window.write(entries[next]!, "replace");
    if (next === index) return;
    index = next;
    notify();
  };
  const unregister = window.register({
    active: activation.isActive,
    step,
    pop(entry) {
      const next = entries.findIndex((candidate) => entryKey(candidate) === entryKey(entry));
      if (next >= 0) index = next;
      else entries[index] = entry;
      notify();
    },
  });
  const unsubscribe = activation.store.subscribe((state, previous) => {
    if (state.active && !previous.active && written) window.write(current(), "replace");
  });
  const write = (entry: WorkbenchPageBrowserEntry, method: "push" | "replace") => {
    // Complete a fallible window write before committing private history.
    if (activation.isActive()) window.write(entry, method);
    if (method === "push") {
      entries.splice(index + 1);
      index++;
    }
    entries[index] = entry;
    written = true;
  };
  const traverse = (direction: number) => {
    if (!activation.isActive()) return;
    if (window.isShared()) step(direction);
    else if (direction < 0) browser.back();
    else browser.forward();
  };
  return {
    browser: {
      current: () => (activation.isActive() && !window.isShared() ? unwrap(browser.current()) : current()),
      push: (entry) => write(entry, "push"),
      replace: (entry) => write(entry, "replace"),
      back: () => traverse(-1),
      forward: () => traverse(1),
      onPopState(listener) {
        listeners.add(listener);
        return {
          dispose: () => {
            listeners.delete(listener);
          },
        };
      },
    } satisfies WorkbenchPageLocationBrowser,
    dispose() {
      unsubscribe();
      unregister();
      listeners.clear();
    },
  };
};
