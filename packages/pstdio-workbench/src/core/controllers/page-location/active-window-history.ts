import type { WorkbenchPageBrowserEntry, WorkbenchPageLocationBrowser } from "./page-location-types";
import { isPageHistoryState } from "./page-url-resolver";

export interface BrowserHistoryOwner {
  id: string;
  active(): boolean;
  pop(entry: WorkbenchPageBrowserEntry): void;
  step(direction: number, entry?: WorkbenchPageBrowserEntry): void;
}

interface WindowHistoryState {
  kind: "pstdio.window-history";
  windowId: string;
  position: number;
  ownerId?: string;
  value: unknown;
}

const windowState = (entry: WorkbenchPageBrowserEntry) => {
  const state = entry.state;
  if (!state || typeof state !== "object" || !("kind" in state) || state.kind !== "pstdio.window-history")
    return undefined;
  const stamp = state as WindowHistoryState;
  return typeof stamp.windowId === "string" && Number.isSafeInteger(stamp.position) && stamp.position >= 0
    ? stamp
    : undefined;
};
export const unwrapHistoryEntry = (entry: WorkbenchPageBrowserEntry) => {
  const stamp = windowState(entry);
  return stamp ? { url: entry.url, state: stamp.value } : entry;
};
export const historyEntryKey = (entry: WorkbenchPageBrowserEntry) => JSON.stringify(unwrapHistoryEntry(entry));
export const createHistoryId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

type WindowEntries = Map<number, { key: string; ownerId?: string }>;
const recordWindowEntry = (
  entries: WindowEntries,
  index: number,
  entry: WorkbenchPageBrowserEntry,
  ownerId: string,
  push: boolean,
) => {
  if (push) for (const key of entries.keys()) if (key > index) entries.delete(key);
  entries.delete(index);
  entries.set(index, { key: historyEntryKey(entry), ownerId });
  while (entries.size > 128) entries.delete(entries.keys().next().value!);
};
const identifyWindowEntry = (entry: WorkbenchPageBrowserEntry, windowId: string, entries: WindowEntries) => {
  const stamp = windowState(entry);
  const known = [...entries].find(([, value]) => value.key === historyEntryKey(entry));
  const index = stamp?.windowId === windowId ? stamp.position : (known?.[0] ?? -1);
  return {
    index,
    ownerId: stamp?.ownerId ?? entries.get(index)?.ownerId,
    // Native stamps survive metadata eviction; only the window identity signals a reload.
    previousWindow: stamp ? stamp.windowId !== windowId : index < 0 && isPageHistoryState(entry.state),
  };
};

const windows = new WeakMap<WorkbenchPageLocationBrowser, ReturnType<typeof createWindowHistory>>();

/** Only reconstructible native-position metadata is bounded; owner histories remain ordered ledgers. */
const createWindowHistory = (browser: WorkbenchPageLocationBrowser) => {
  let windowId = createHistoryId();
  const owners = new Map<string, BrowserHistoryOwner>();
  const entries: WindowEntries = new Map([[0, { key: historyEntryKey(browser.current()) }]]);
  let index = 0;
  let shared = false;
  let disposed = false;
  const write = (entry: WorkbenchPageBrowserEntry, method: "push" | "replace", owner: BrowserHistoryOwner) => {
    if (disposed || !owners.has(owner.id)) return;
    const unmapped = index < 0;
    const nextWindowId = unmapped ? createHistoryId() : windowId;
    let position = index;
    if (unmapped) position = 0;
    else if (method === "push") position++;
    const projected = {
      url: entry.url,
      state: {
        kind: "pstdio.window-history",
        windowId: nextWindowId,
        position,
        ownerId: owner.id,
        value: entry.state,
      } satisfies WindowHistoryState,
    };
    browser[method](projected);
    if (disposed || !owners.has(owner.id)) return;
    if (unmapped) {
      windowId = nextWindowId;
      entries.clear();
    }
    index = position;
    recordWindowEntry(entries, index, entry, owner.id, method === "push");
  };
  const subscription = browser.onPopState((entry) => {
    if (disposed) return;
    const owner = [...owners.values()].find((owner) => owner.active());
    const { index: nextIndex, ownerId, previousWindow } = identifyWindowEntry(entry, windowId, entries);
    if (!shared || previousWindow) {
      index = nextIndex;
      owner?.pop(unwrapHistoryEntry(entry));
      return;
    }
    if (nextIndex < 0 || nextIndex === index) return;
    const direction = nextIndex > index ? 1 : -1;
    const ownEntry = ownerId === owner?.id ? unwrapHistoryEntry(entry) : undefined;
    const returning = index < 0 && ownEntry;
    index = nextIndex;
    if (returning) owner?.pop(returning);
    else owner?.step(direction, ownEntry);
  });
  return {
    write,
    isShared: () => shared,
    inspect: () => ({ owners: owners.size, metadata: entries.size }),
    register(owner: BrowserHistoryOwner) {
      owners.set(owner.id, owner);
      shared ||= owners.size > 1;
      return () => {
        if (!owners.delete(owner.id)) return;
        for (const [key, value] of entries) if (value.ownerId === owner.id) entries.delete(key);
        if (owners.size) return;
        disposed = true;
        entries.clear();
        windows.delete(browser);
        subscription.dispose();
      };
    },
  };
};

export const getActiveWindowHistory = (browser: WorkbenchPageLocationBrowser) => {
  let window = windows.get(browser);
  if (!window) {
    window = createWindowHistory(browser);
    windows.set(browser, window);
  }
  return window;
};
