import type { LayoutModel } from "../../registries/layout/layout-model";
import { findPlacementByWidgetId, getActiveLocationPlacement } from "../../registries/layout/layout-operations";
import type { WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import {
  type WorkbenchPanelRegion,
  type WorkbenchRegion,
  workbenchPanelRegions,
} from "../../registries/layout/layout-types";
import type { WorkbenchModeRegistry } from "../../registries/modes/mode-registry";
import type { ResourceRegistry } from "../../registries/resources/resource-registry";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";
import {
  emptyHistoryState,
  hydrateHistoryState,
  reconcileHistoryState,
  WORKBENCH_HISTORY_VERSION,
} from "./history-reconciliation";
import {
  closedNavigationEntry,
  compactNavigationEntries,
  entryFromCurrentSnapshot,
  findSubPanelPlacement,
  isSameNavigationEntry,
  withoutSubPanelSelection,
  workbenchPlacementRole,
} from "./history-snapshot";
import type {
  HistoryEntry,
  HistoryStoreState,
  WorkbenchHistoryPersistence,
  WorkbenchNavigationEntry,
} from "./history-types";

export type {
  HistoryEntry,
  HistoryStoreState,
  PersistedWorkbenchHistory,
  WorkbenchHistoryPersistence,
  WorkbenchLocation,
  WorkbenchLocationRef,
  WorkbenchLocationWorkspaceState,
  WorkbenchNavigationEntry,
  WorkbenchPanelMenuRef,
  WorkbenchPanelMenuWorkspaceState,
  WorkbenchPanelWorkspaceState,
  WorkbenchSubPanelRef,
} from "./history-types";

export interface HistoryController {
  store: WorkbenchStore<HistoryStoreState>;
  goBack(): HistoryEntry | undefined;
  goForward(): HistoryEntry | undefined;
  goPrevious(): HistoryEntry | undefined;
  recentlyClosed(): readonly HistoryEntry[];
  reopenLastClosed(): HistoryEntry | undefined;
  setPersistenceScope(scope: string | undefined): void;
  getPersistenceScope(): string | undefined;
  restore(): HistoryEntry | undefined;
  flush(): void;
  clear(): void;
}

export interface CreateHistoryControllerInput {
  layout: LayoutModel;
  modes?: Pick<
    WorkbenchModeRegistry,
    "getActiveModeId" | "getMode" | "isTransitioning" | "onDidChangeActive" | "setActiveMode"
  >;
  resources: ResourceRegistry;
  persistence?: WorkbenchHistoryPersistence;
  maxEntries?: number;
}

const DEFAULT_MAX_ENTRIES = 50;
const RECENTLY_CLOSED_LIMIT = 20;
const PERSISTENCE_DELAY_MS = 50;

interface HistoryPersistenceSchedulerInput {
  persistence?: WorkbenchHistoryPersistence;
  store: WorkbenchStore<HistoryStoreState>;
  getScope(): string | undefined;
}

const createHistoryPersistenceScheduler = (input: HistoryPersistenceSchedulerInput) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    if (!input.persistence) return;
    const { hydrating: _hydrating, ...state } = input.store.getState();
    input.persistence.setHistory({ ...state, version: WORKBENCH_HISTORY_VERSION }, input.getScope());
  };

  return {
    flush,
    schedule() {
      if (!input.persistence || timer) return;
      timer = setTimeout(flush, PERSISTENCE_DELAY_MS);
    },
  };
};

const suppressTransitionSnapshot = (
  current: WorkbenchNavigationEntry | undefined,
  entry: WorkbenchNavigationEntry | undefined,
  fromLayoutChange: boolean,
  transitioning: boolean,
) => {
  if (!transitioning) return false;
  if (!fromLayoutChange) return entry?.kind !== "mode";
  if (entry?.kind === "mode") return true;
  return current?.location.resource?.uri === entry?.location.resource?.uri;
};

const currentNavigationEntry = (state: HistoryStoreState) => state.entries[state.cursor];

const placementsByWidgetId = (layout: LayoutModel) => {
  const placements = new Map<string, { placement: WorkbenchWidgetPlacement; region: WorkbenchRegion }>();
  for (const region of Object.values(layout.getLayout().regions)) {
    for (const placement of region.widgets) placements.set(placement.widgetId, { placement, region: region.id });
  }
  return placements;
};

interface ActivateHistoryResourceInput {
  entry: WorkbenchNavigationEntry;
  resource: NonNullable<WorkbenchNavigationEntry["resource"]>;
  placement?: WorkbenchWidgetPlacement;
  layout: LayoutModel;
  resources: ResourceRegistry;
  replayCurrentLocation?: boolean;
  replayResource(entry: WorkbenchNavigationEntry): Promise<unknown>;
  restoreSelections(entry: WorkbenchNavigationEntry): void;
}

const activateHistoryResource = (input: ActivateHistoryResourceInput) => {
  const { entry, layout, placement, replayCurrentLocation, replayResource, resource, resources, restoreSelections } =
    input;
  const opener = Object.values(resources.store.getState().openers).find((candidate) => candidate.canOpen(resource));
  const activeLocationUri = getActiveLocationPlacement(layout.getLayout())?.resourceUri;
  if (opener && (replayCurrentLocation || activeLocationUri !== resource.uri)) return replayResource(entry);

  if (placement?.resourceUri === resource.uri) layout.activateWidget(placement.widgetId);
  else if (entry.contributionId && layout.getWidget(entry.contributionId)?.role === "location") {
    layout.openWidget(entry.contributionId, {
      resource,
      title: entry.title,
      replaceActive: Boolean(placement),
    });
  } else if (placement) layout.activateWidget(placement.widgetId);
  else if (entry.contributionId && layout.getWidget(entry.contributionId)) {
    layout.openWidget(entry.contributionId, { title: entry.title });
  }
  restoreSelections(entry);
  return undefined;
};

interface CreateHistoryControllerApiInput {
  controllerInput: CreateHistoryControllerInput;
  store: WorkbenchStore<HistoryStoreState>;
  activateEntry(
    entry: WorkbenchNavigationEntry,
    options?: { replayCurrentLocation?: boolean },
  ): Promise<unknown> | undefined;
  finishRestore(scope?: string, restoredEntryId?: string): void;
  flush(): void;
  getPersistenceScope(): string | undefined;
  moveCursor(delta: number): WorkbenchNavigationEntry | undefined;
  runSilent(action: () => unknown): void;
  setPersistenceScope(scope: string | undefined): void;
  setState(state: HistoryStoreState, action: string, persist?: boolean): void;
}

const createHistoryControllerApi = (input: CreateHistoryControllerApiInput): HistoryController => {
  const {
    activateEntry,
    controllerInput,
    finishRestore,
    flush,
    getPersistenceScope,
    moveCursor,
    runSilent,
    setPersistenceScope,
    setState,
    store,
  } = input;

  return {
    store,
    goBack: () => moveCursor(-1),
    goForward: () => moveCursor(1),
    goPrevious() {
      const snapshot = store.getState();
      if (snapshot.hydrating) return undefined;
      const current = snapshot.entries[snapshot.cursor];
      for (let index = snapshot.entries.length - 1; index >= 0; index -= 1) {
        const candidate = snapshot.entries[index];
        if (isSameNavigationEntry(candidate, current)) continue;
        setState({ ...snapshot, cursor: index }, "history.goPrevious");
        runSilent(() => activateEntry(candidate));
        return candidate;
      }
      return undefined;
    },
    recentlyClosed: () => store.getState().recentlyClosed,
    reopenLastClosed() {
      const snapshot = store.getState();
      if (snapshot.hydrating) return undefined;
      const last = snapshot.recentlyClosed.at(-1);
      if (!last) return undefined;
      setState({ ...snapshot, recentlyClosed: snapshot.recentlyClosed.slice(0, -1) }, "history.reopenClosed");
      runSilent(() => {
        const pending = activateEntry(last);
        const reopenSubPanel = () => {
          if (!last.closedSubPanel) return;
          controllerInput.layout.openWidget(last.closedSubPanel.reference.contributionId, {
            region: last.closedSubPanel.region,
            resource: last.closedSubPanel.resource,
            title: last.closedSubPanel.title,
            closable: true,
          });
        };
        if (pending instanceof Promise) void pending.then(reopenSubPanel);
        else reopenSubPanel();
      });
      return last;
    },
    setPersistenceScope,
    getPersistenceScope,
    restore() {
      const snapshot = reconcileHistoryState({
        state: store.getState(),
        layout: controllerInput.layout,
        modes: controllerInput.modes,
        resources: controllerInput.resources,
      });
      setState(snapshot, "history.reconcile");
      const entry = snapshot.entries[snapshot.cursor];
      const scope = getPersistenceScope();
      let pending: Promise<unknown> | undefined;
      if (entry) {
        runSilent(() => {
          const result = activateEntry(entry, { replayCurrentLocation: true });
          if (result instanceof Promise) pending = result;
        });
      }
      if (pending)
        void pending.then(
          () => finishRestore(scope, entry?.entryId),
          () => finishRestore(scope, entry?.entryId),
        );
      else finishRestore(scope, entry?.entryId);
      return entry;
    },
    flush,
    clear() {
      finishRestore();
      setState(emptyHistoryState(), "history.clear");
    },
  };
};

interface HistoryRestoreFinisherInput {
  store: WorkbenchStore<HistoryStoreState>;
  activateEntry(entry: WorkbenchNavigationEntry): Promise<unknown> | undefined;
  getScope(): string | undefined;
  onFinish(): void;
  runSilent(action: () => unknown): void;
  setState(state: HistoryStoreState, action: string, persist?: boolean): void;
}

const createHistoryRestoreFinisher = (input: HistoryRestoreFinisherInput) => {
  const finish = (scope: string | undefined, restoredEntryId?: string) => {
    if (scope !== undefined && scope !== input.getScope()) return;
    const snapshot = input.store.getState();
    const requestedEntry = snapshot.entries[snapshot.cursor];
    if (restoredEntryId && requestedEntry && requestedEntry.entryId !== restoredEntryId) {
      let pending: Promise<unknown> | undefined;
      input.runSilent(() => {
        const result = input.activateEntry(requestedEntry);
        if (result instanceof Promise) pending = result;
      });
      if (pending) {
        void pending.then(
          () => finish(scope, requestedEntry.entryId),
          () => finish(scope, requestedEntry.entryId),
        );
      } else finish(scope, requestedEntry.entryId);
      return;
    }
    input.onFinish();
    if (snapshot.hydrating) {
      input.setState({ ...snapshot, hydrating: false }, "history.finishRestore", false);
    }
  };
  return finish;
};

interface HistoryCursorMoverInput {
  store: WorkbenchStore<HistoryStoreState>;
  activateEntry(entry: WorkbenchNavigationEntry): Promise<unknown> | undefined;
  flush(): void;
  runSilent(action: () => unknown): void;
  setState(state: HistoryStoreState, action: string): void;
}

const createHistoryCursorMover = (input: HistoryCursorMoverInput) => (delta: number) => {
  const snapshot = input.store.getState();
  const cursor = snapshot.cursor + delta;
  const entry = snapshot.entries[cursor];
  if (!entry) return undefined;
  input.setState({ ...snapshot, cursor }, delta < 0 ? "history.goBack" : "history.goForward");
  input.flush();
  if (!snapshot.hydrating) input.runSilent(() => input.activateEntry(entry));
  return entry;
};

export const createHistoryController = (input: CreateHistoryControllerInput): HistoryController => {
  const store = createWorkbenchStore<HistoryStoreState>({
    name: "workbench.history",
    initialState: emptyHistoryState(),
  });
  let counter = 0;
  let navigating = false;
  let awaitingRestore = false;
  let currentScope: string | undefined;
  const replayingResourceUris = new Set<string>();
  const { flush, schedule: schedulePersist } = createHistoryPersistenceScheduler({
    persistence: input.persistence,
    store,
    getScope: () => currentScope,
  });

  const setState = (state: HistoryStoreState, action: string, persist = true) => {
    store.setState(state, false, action);
    if (persist) schedulePersist();
  };

  const appendEntry = (candidate: WorkbenchNavigationEntry | undefined) => {
    if (!candidate) return;
    const snapshot = store.getState();
    const current = snapshot.entries[snapshot.cursor];
    if (isSameNavigationEntry(current, candidate)) return;
    const trimmed = snapshot.entries.slice(0, snapshot.cursor + 1);
    const replacesCurrentMode =
      current?.kind === "mode" && candidate.kind !== "mode" && current.modeId === candidate.modeId;
    const appended = compactNavigationEntries(
      replacesCurrentMode ? [...trimmed.slice(0, -1), candidate] : [...trimmed, candidate],
    );
    const entries = appended.slice(Math.max(0, appended.length - (input.maxEntries ?? DEFAULT_MAX_ENTRIES)));
    setState({ ...snapshot, entries, cursor: entries.length - 1 }, "history.record");
  };

  const recordSnapshot = (fromLayoutChange = false) => {
    if (navigating || awaitingRestore) return;
    counter += 1;
    const entry = entryFromCurrentSnapshot({ counter, layout: input.layout, modes: input.modes });
    const current = currentNavigationEntry(store.getState());
    if (suppressTransitionSnapshot(current, entry, fromLayoutChange, input.modes?.isTransitioning() ?? false)) return;
    if (entry?.location.resource && replayingResourceUris.has(entry.location.resource.uri)) return;
    appendEntry(entry);
  };

  let lastPlacements = placementsByWidgetId(input.layout);

  const normalizeRemovedPlacement = (placement: WorkbenchWidgetPlacement) => {
    const snapshot = store.getState();
    const role = workbenchPlacementRole(input.layout, placement);
    if (role === "location") return;
    if (role !== "sub-panel") {
      if (input.modes?.isTransitioning() || !input.layout.getWidget(placement.contributionId)) return;
      const entries = compactNavigationEntries(
        snapshot.entries.filter((entry) => entry.widgetId !== placement.widgetId),
      );
      if (entries.length === snapshot.entries.length) return;
      setState({ ...snapshot, entries, cursor: Math.min(snapshot.cursor, entries.length - 1) }, "history.prune");
      return;
    }

    const currentId = snapshot.entries[snapshot.cursor]?.entryId;
    const entries = compactNavigationEntries(
      snapshot.entries.map((entry) => withoutSubPanelSelection(entry, placement)),
    );
    const retainedCursor = currentId ? entries.findIndex((entry) => entry.entryId === currentId) : -1;
    setState(
      {
        ...snapshot,
        entries,
        cursor: retainedCursor >= 0 ? retainedCursor : Math.min(snapshot.cursor, entries.length - 1),
      },
      "history.removeSubPanel",
    );
  };

  const pushRecentlyClosed = (placement: WorkbenchWidgetPlacement, region: WorkbenchRegion) => {
    counter += 1;
    const snapshot = store.getState();
    const role = workbenchPlacementRole(input.layout, placement);
    const entry = closedNavigationEntry({
      placement,
      counter,
      current: role === "sub-panel" ? snapshot.entries[snapshot.cursor] : undefined,
      modeId: input.modes?.getActiveModeId(),
      closedSubPanel:
        role === "sub-panel" && workbenchPanelRegions.includes(region as WorkbenchPanelRegion)
          ? {
              region: region as WorkbenchPanelRegion,
              reference: {
                contributionId: placement.contributionId,
                resourceUri: placement.resourceUri,
                instanceKey: placement.widgetId,
              },
              resource: placement.resource,
              title: placement.title,
            }
          : undefined,
    });
    const recentlyClosed = [
      ...snapshot.recentlyClosed.filter((candidate) => !isSameNavigationEntry(candidate, entry)),
      entry,
    ].slice(-RECENTLY_CLOSED_LIMIT);
    setState({ ...snapshot, recentlyClosed }, "history.recordClosed");
  };

  input.layout.store.subscribeSelector(
    (state) => state.layout,
    () => {
      const nextPlacements = placementsByWidgetId(input.layout);
      if (awaitingRestore) {
        lastPlacements = nextPlacements;
        return;
      }
      for (const [widgetId, tracked] of lastPlacements) {
        if (nextPlacements.has(widgetId)) continue;
        if (tracked.placement.closable) pushRecentlyClosed(tracked.placement, tracked.region);
        normalizeRemovedPlacement(tracked.placement);
      }
      lastPlacements = nextPlacements;
      recordSnapshot(true);
    },
  );
  input.modes?.onDidChangeActive(recordSnapshot);

  const restoreSelections = (entry: WorkbenchNavigationEntry) => {
    for (const region of workbenchPanelRegions) {
      const reference = entry.selectedSubPanels[region];
      const placement = reference ? findSubPanelPlacement(input.layout, reference) : undefined;
      if (placement) {
        input.layout.activateWidget(placement.widgetId);
        continue;
      }
      const fallbackWidgetId = region === "main" ? input.layout.getLayout().activeLocationWidgetId : undefined;
      input.layout.setRegionActiveWidget(region, fallbackWidgetId);
    }
  };

  const restoreMode = (entry: WorkbenchNavigationEntry) => {
    if (input.modes && input.modes.getActiveModeId() !== entry.modeId) input.modes.setActiveMode(entry.modeId);
  };

  const replayResource = (entry: WorkbenchNavigationEntry, scope: string | undefined) => {
    const resource = entry.resource!;
    replayingResourceUris.add(resource.uri);
    return input.resources.openResource(resource).finally(() => {
      if (scope === currentScope) restoreSelections(entry);
      replayingResourceUris.delete(resource.uri);
    });
  };

  const activateEntry = (entry: WorkbenchNavigationEntry, options: { replayCurrentLocation?: boolean } = {}) => {
    const replayScope = currentScope;
    restoreMode(entry);
    if (entry.kind === "mode") {
      restoreSelections(entry);
      return undefined;
    }
    const placement = entry.widgetId
      ? findPlacementByWidgetId(input.layout.getLayout(), entry.widgetId)?.placement
      : undefined;
    if (entry.kind === "resource" && entry.resource) {
      return activateHistoryResource({
        entry,
        resource: entry.resource,
        placement,
        layout: input.layout,
        resources: input.resources,
        replayCurrentLocation: options.replayCurrentLocation,
        replayResource: (candidate) => replayResource(candidate, replayScope),
        restoreSelections,
      });
    }
    if (placement) input.layout.activateWidget(placement.widgetId);
    else if (entry.contributionId && input.layout.getWidget(entry.contributionId)) {
      input.layout.openWidget(entry.contributionId, { title: entry.title });
    }
    restoreSelections(entry);
    return undefined;
  };

  const runSilent = (action: () => unknown) => {
    navigating = true;
    try {
      action();
    } finally {
      navigating = false;
    }
  };

  const moveCursor = createHistoryCursorMover({ store, activateEntry, flush, runSilent, setState });

  const setPersistenceScope = (scope: string | undefined) => {
    if (scope === currentScope) return;
    flush();
    currentScope = scope;
    const hydrated = hydrateHistoryState(input.persistence?.getHistory(scope));
    awaitingRestore = hydrated.entries.length > 0;
    setState({ ...hydrated, hydrating: awaitingRestore }, "history.setPersistenceScope", false);
  };

  input.layout.onDidChangePersistenceScope(setPersistenceScope);

  if (typeof window !== "undefined") window.addEventListener("pagehide", flush);

  const finishRestore = createHistoryRestoreFinisher({
    store,
    activateEntry,
    getScope: () => currentScope,
    onFinish: () => {
      awaitingRestore = false;
    },
    runSilent,
    setState,
  });

  return createHistoryControllerApi({
    controllerInput: input,
    store,
    finishRestore,
    setPersistenceScope,
    getPersistenceScope: () => currentScope,
    activateEntry,
    moveCursor,
    runSilent,
    setState,
    flush,
  });
};
