import type { LayoutModel } from "../../registries/layout/layout-model";
import { findPlacementByWidgetId, getActivePlacement } from "../../registries/layout/layout-operations";
import type { WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import { resolveAnchorRegion } from "../../registries/layout/surface-map";
import type { WorkbenchModeRegistry } from "../../registries/modes/mode-registry";
import type { ResourceRef, ResourceRegistry } from "../../registries/resources/resource-registry";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";

export interface HistoryEntry {
  entryId: string;
  recordedAt: number;
  kind: "resource" | "widget" | "mode";
  modeId?: string;
  resource?: ResourceRef;
  widgetId?: string;
  contributionId?: string;
  title?: string;
}

export interface HistoryStoreState {
  entries: readonly HistoryEntry[];
  cursor: number; // -1 when entries is empty
  recentlyClosed: readonly HistoryEntry[];
}

export interface HistoryController {
  store: WorkbenchStore<HistoryStoreState>;
  goBack(): HistoryEntry | undefined;
  goForward(): HistoryEntry | undefined;
  goPrevious(): HistoryEntry | undefined;
  recentlyClosed(): readonly HistoryEntry[];
  reopenLastClosed(): HistoryEntry | undefined;
  clear(): void;
}

export interface CreateHistoryControllerInput {
  layout: LayoutModel;
  modes?: Pick<
    WorkbenchModeRegistry,
    "getActiveModeId" | "getMode" | "isTransitioning" | "onDidChangeActive" | "setActiveMode"
  >;
  resources: ResourceRegistry;
  maxEntries?: number;
}

const DEFAULT_MAX_ENTRIES = 50;
const RECENTLY_CLOSED_LIMIT = 20;

const isSameEntry = (left: HistoryEntry | undefined, right: HistoryEntry | undefined) => {
  if (!left || !right) return false;
  if (left.kind !== right.kind) return false;
  if (left.kind === "resource") return left.resource?.uri === right.resource?.uri;
  if (left.kind === "mode") return left.modeId === right.modeId;
  return left.widgetId === right.widgetId;
};

const compactAdjacentEntries = (entries: readonly HistoryEntry[]) => {
  const compacted: HistoryEntry[] = [];
  for (const entry of entries) {
    const lastIndex = compacted.length - 1;
    if (isSameEntry(compacted[lastIndex], entry)) compacted[lastIndex] = entry;
    else compacted.push(entry);
  }
  return compacted;
};

const findLastEquivalentEntry = (entries: readonly HistoryEntry[], target: HistoryEntry) => {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    if (isSameEntry(entries[index], target)) return index;
  }
  return -1;
};

// History tracks the PRIMARY (main) region's live placements only, so supporting surfaces never
// push Back/Forward entries.
const activePlacementFromLayout = (layout: LayoutModel) =>
  getActivePlacement(layout.getLayout().regions[resolveAnchorRegion("primary")]);

const createEntryBase = (counter: number) => {
  const recordedAt = Date.now();
  return { entryId: `history-${recordedAt}-${counter}`, recordedAt };
};

const entryFromPlacement = (
  placement: WorkbenchWidgetPlacement,
  counter: number,
  modeId: string | undefined,
): HistoryEntry => ({
  ...createEntryBase(counter),
  kind: placement.resource ? "resource" : "widget",
  modeId,
  resource: placement.resource,
  widgetId: placement.widgetId,
  contributionId: placement.contributionId,
  title: placement.title,
});

const entryFromMode = (
  mode: ReturnType<WorkbenchModeRegistry["getMode"]>,
  counter: number,
  modeId: string | undefined,
): HistoryEntry => ({
  ...createEntryBase(counter),
  kind: "mode",
  modeId,
  title: mode?.label ?? modeId,
});

export const createHistoryController = (input: CreateHistoryControllerInput): HistoryController => {
  const maxEntries = input.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const store = createWorkbenchStore<HistoryStoreState>({
    name: "workbench.history",
    initialState: { entries: [], cursor: -1, recentlyClosed: [] },
  });

  let counter = 0;
  let navigating = false;
  let silentLayoutChanged = false;
  let restoredModeDuringReplay = false;
  const replayingResourceUris = new Set<string>();

  const appendHistoryEntry = (candidate: HistoryEntry) => {
    const snapshot = store.getState();
    const current = snapshot.entries[snapshot.cursor];
    if (isSameEntry(current, candidate)) return;

    const trimmed = snapshot.entries.slice(0, snapshot.cursor + 1);
    const replacesCurrentMode =
      current?.kind === "mode" && candidate.kind !== "mode" && current.modeId === candidate.modeId;
    const withCandidate = replacesCurrentMode ? [...trimmed.slice(0, -1), candidate] : [...trimmed, candidate];
    const overflow = withCandidate.length - maxEntries;
    const entries = overflow > 0 ? withCandidate.slice(overflow) : withCandidate;
    const cursor = entries.length - 1;

    store.setState({ ...snapshot, entries, cursor }, false, "history.record");
  };

  const appendEntry = (placement: WorkbenchWidgetPlacement) => {
    if (placement.pinned) return;

    counter += 1;
    appendHistoryEntry(entryFromPlacement(placement, counter, input.modes?.getActiveModeId()));
  };

  const appendModeEntry = () => {
    if (navigating) return;

    const modeId = input.modes?.getActiveModeId();
    counter += 1;
    appendHistoryEntry(entryFromMode(modeId ? input.modes?.getMode(modeId) : undefined, counter, modeId));
  };

  const pushRecentlyClosed = (placement: WorkbenchWidgetPlacement) => {
    counter += 1;
    const closed = entryFromPlacement(placement, counter, input.modes?.getActiveModeId());
    const snapshot = store.getState();
    const next = [...snapshot.recentlyClosed.filter((entry) => !isSameEntry(entry, closed)), closed];
    const trimmed = next.length > RECENTLY_CLOSED_LIMIT ? next.slice(next.length - RECENTLY_CLOSED_LIMIT) : next;
    store.setState({ ...snapshot, recentlyClosed: trimmed }, false, "history.recordClosed");
  };

  const placementsByWidgetId = (layout = input.layout.getLayout()) => {
    const map = new Map<string, WorkbenchWidgetPlacement>();
    for (const region of Object.values(layout.regions)) {
      for (const placement of region.widgets) map.set(placement.widgetId, placement);
    }
    return map;
  };

  let lastPlacements = placementsByWidgetId();

  const pruneRemovedPlacement = (placement: WorkbenchWidgetPlacement) => {
    const snapshot = store.getState();
    const current = snapshot.entries[snapshot.cursor];
    // Mode changes tear down their placements before activating the next layout. Keep those
    // entries so Back can reactivate the mode and reopen its resource; an explicitly closed tab
    // outside that transition should still be removed from history.
    if (input.modes?.isTransitioning()) return;
    if (!input.layout.getWidget(placement.contributionId)) return;
    const retained = snapshot.entries.filter((entry) => entry.widgetId !== placement.widgetId);
    if (retained.length === snapshot.entries.length) return;
    const entries = compactAdjacentEntries(retained);

    const retainedCursor = current ? entries.findIndex((entry) => entry.entryId === current.entryId) : -1;
    const equivalentCursor = current ? findLastEquivalentEntry(entries, current) : -1;
    let cursor = Math.min(snapshot.cursor, entries.length - 1);
    if (equivalentCursor >= 0) cursor = equivalentCursor;
    if (retainedCursor >= 0) cursor = retainedCursor;
    store.setState({ ...snapshot, entries, cursor }, false, "history.pruneRemovedPlacement");
  };

  const layoutListener = () => {
    const snapshot = input.layout.getLayout();
    const nextPlacements = placementsByWidgetId(snapshot);

    // Detect closed widgets to feed recentlyClosed.
    for (const [widgetId, placement] of lastPlacements) {
      if (nextPlacements.has(widgetId)) continue;
      if (placement.closable) pushRecentlyClosed(placement);
      pruneRemovedPlacement(placement);
    }
    lastPlacements = nextPlacements;

    if (navigating) {
      silentLayoutChanged = true;
      return;
    }

    const active = activePlacementFromLayout(input.layout);
    if (!active) return;
    appendEntry(active);
  };

  input.layout.store.subscribeSelector(
    (state) => state.layout,
    () => layoutListener(),
  );

  input.modes?.onDidChangeActive(() => appendModeEntry());

  input.resources.onDidOpenResource((resource) => {
    if (navigating) return;
    if (replayingResourceUris.has(resource.uri)) return;
    const active = activePlacementFromLayout(input.layout);
    if (active?.resourceUri === resource.uri) appendEntry(active);
  });

  const runSilent = (action: () => unknown) => {
    navigating = true;
    silentLayoutChanged = false;
    restoredModeDuringReplay = false;
    let deferred = false;
    try {
      const result = action();
      if (
        result &&
        typeof (result as Promise<unknown>).finally === "function" &&
        (!silentLayoutChanged || restoredModeDuringReplay)
      ) {
        deferred = true;
        void (result as Promise<unknown>).then(
          () => {
            navigating = false;
          },
          () => {
            navigating = false;
          },
        );
        return;
      }
    } finally {
      if (!deferred) navigating = false;
    }
  };

  const restoreMode = (entry: HistoryEntry) => {
    if (!input.modes) return;
    if (input.modes.getActiveModeId() === entry.modeId) return;
    restoredModeDuringReplay = true;
    input.modes.setActiveMode(entry.modeId);
  };

  const activateEntry = (entry: HistoryEntry) => {
    restoreMode(entry);

    if (entry.kind === "mode") return;

    const placement = entry.widgetId
      ? findPlacementByWidgetId(input.layout.getLayout(), entry.widgetId)?.placement
      : undefined;

    if (entry.kind === "resource" && entry.resource) {
      if (placement?.resourceUri === entry.resource.uri) return input.layout.activateWidget(placement.widgetId);
      replayingResourceUris.add(entry.resource.uri);
      return input.resources.openResource(entry.resource, { replaceActive: Boolean(placement) }).finally(() => {
        if (entry.resource) replayingResourceUris.delete(entry.resource.uri);
      });
    }
    if (!placement && entry.contributionId && input.layout.getWidget(entry.contributionId)) {
      return input.layout.openWidget(entry.contributionId, { title: entry.title });
    }
    if (!placement) return;
    return input.layout.activateWidget(placement.widgetId);
  };

  const reopenClosed = (entry: HistoryEntry) => {
    restoreMode(entry);

    if (entry.kind === "mode") return;
    if (entry.kind === "resource" && entry.resource) return input.resources.openResource(entry.resource);
    if (entry.kind === "widget" && entry.widgetId) {
      return input.layout.openWidget(entry.contributionId ?? entry.widgetId);
    }
  };

  const moveCursor = (delta: number): HistoryEntry | undefined => {
    const snapshot = store.getState();
    const nextCursor = snapshot.cursor + delta;
    const entry = snapshot.entries[nextCursor];
    if (!entry) return undefined;

    store.setState({ ...snapshot, cursor: nextCursor }, false, delta < 0 ? "history.goBack" : "history.goForward");
    runSilent(() => activateEntry(entry));
    return entry;
  };

  return {
    store,

    goBack() {
      return moveCursor(-1);
    },

    goForward() {
      return moveCursor(1);
    },

    goPrevious() {
      // VS Code-style: jump to the most recent entry that is not the current one.
      const snapshot = store.getState();
      const current = snapshot.entries[snapshot.cursor];
      for (let index = snapshot.entries.length - 1; index >= 0; index -= 1) {
        const candidate = snapshot.entries[index];
        if (!isSameEntry(candidate, current)) {
          store.setState({ ...snapshot, cursor: index }, false, "history.goPrevious");
          runSilent(() => activateEntry(candidate));
          return candidate;
        }
      }
      return undefined;
    },

    recentlyClosed() {
      return store.getState().recentlyClosed;
    },

    reopenLastClosed() {
      const snapshot = store.getState();
      const last = snapshot.recentlyClosed[snapshot.recentlyClosed.length - 1];
      if (!last) return undefined;

      store.setState(
        { ...snapshot, recentlyClosed: snapshot.recentlyClosed.slice(0, -1) },
        false,
        "history.reopenLastClosed",
      );
      runSilent(() => reopenClosed(last));
      return last;
    },

    clear() {
      store.setState({ entries: [], cursor: -1, recentlyClosed: [] }, false, "history.clear");
    },
  };
};
