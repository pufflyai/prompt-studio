import type { WorkbenchActivation } from "../../workbench-activation";
import type { WorkbenchPageBrowserEntry, WorkbenchPageLocationBrowser } from "./page-location-types";
import { isPageHistoryState } from "./page-url-resolver";

interface BrowserOwner {
  active(): boolean;
  pop(entry: WorkbenchPageBrowserEntry): void;
  step(direction: number, entry?: WorkbenchPageBrowserEntry): void;
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
const belongsToPreviousWindow = (entry: WorkbenchPageBrowserEntry, windowId: string, known: boolean) => {
  const stamp = windowState(entry);
  return stamp ? stamp.windowId !== windowId : !known && isPageHistoryState(entry.state);
};
const createWindowId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

/** One window history projects the active owner's history once the browser is shared. */
const createWindowHistory = (browser: WorkbenchPageLocationBrowser) => {
  let windowId = createWindowId();
  const owners = new Set<BrowserOwner>();
  const entries: { key: string; owner?: BrowserOwner }[] = [{ key: entryKey(browser.current()) }];
  let index = 0;
  let shared = false;
  const write = (entry: WorkbenchPageBrowserEntry, method: "push" | "replace", owner: BrowserOwner) => {
    const unmapped = index < 0;
    const nextWindowId = unmapped ? createWindowId() : windowId;
    let position = index;
    if (unmapped) position = 0;
    else if (method === "push") position++;
    const projected = shared
      ? {
          url: entry.url,
          state: {
            kind: "pstdio.window-history",
            windowId: nextWindowId,
            position,
            value: entry.state,
          } satisfies WindowHistoryState,
        }
      : entry;
    browser[method](projected);
    if (unmapped) {
      windowId = nextWindowId;
      entries.length = 0;
    } else if (method === "push") {
      entries.splice(index + 1);
    }
    index = position;
    entries[index] = { key: entryKey(entry), owner };
  };
  const subscription = browser.onPopState((entry) => {
    const stamp = windowState(entry);
    const owner = [...owners].find((owner) => owner.active());
    const nextIndex =
      stamp?.windowId === windowId ? stamp.position : entries.findIndex(({ key }) => key === entryKey(entry));
    if (!shared) {
      if (nextIndex >= 0) index = nextIndex;
      owner?.pop(unwrap(entry));
      return;
    }
    // A reload keeps native stamps but discards the private history they indexed.
    if (belongsToPreviousWindow(entry, windowId, nextIndex >= 0)) {
      index = nextIndex;
      owner?.pop(unwrap(entry));
      return;
    }
    if (nextIndex < 0 || nextIndex === index) return;
    const direction = nextIndex > index ? 1 : -1;
    const ownEntry = entries[nextIndex]?.owner === owner ? unwrap(entry) : undefined;
    const returning = index < 0 && ownEntry;
    index = nextIndex;
    if (returning) owner?.pop(returning);
    else owner?.step(direction, ownEntry);
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
  const pop = (entry: WorkbenchPageBrowserEntry) => {
    const next = entries.findIndex((candidate) => entryKey(candidate) === entryKey(entry));
    if (next >= 0) index = next;
    else entries[index] = entry;
    notify();
  };
  const step = (direction: number, entry?: WorkbenchPageBrowserEntry) => {
    const next = Math.max(0, Math.min(entries.length - 1, index + direction));
    // Native history can retain this owner's entries from before its private history was rebuilt.
    if (next === index && entry) {
      pop(entry);
      return;
    }
    window.write(entries[next]!, "replace", owner);
    if (next === index) return;
    index = next;
    notify();
  };
  const owner: BrowserOwner = {
    active: activation.isActive,
    step,
    pop,
  };
  const unregister = window.register(owner);
  const unsubscribe = activation.store.subscribe((state, previous) => {
    if (state.active && !previous.active && written) window.write(current(), "replace", owner);
  });
  const write = (entry: WorkbenchPageBrowserEntry, method: "push" | "replace") => {
    // Complete a fallible window write before committing private history.
    if (activation.isActive()) window.write(entry, method, owner);
    if (method === "push") {
      entries.splice(index + 1);
      index++;
    }
    entries[index] = entry;
    written = true;
  };
  const traverse = (direction: number) => {
    if (!activation.isActive()) return;
    const next = index + direction;
    if (window.isShared() && next >= 0 && next < entries.length) step(direction);
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
