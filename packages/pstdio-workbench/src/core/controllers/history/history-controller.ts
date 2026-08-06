import type { LayoutModel } from "../../registries/layout/layout-model";
import { findPlacementByWidgetId } from "../../registries/layout/layout-operations";
import type { WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import {
  type WorkbenchPanelRegion,
  type WorkbenchRegion,
  workbenchPanelRegions,
} from "../../registries/layout/layout-types";
import type { WorkbenchModeRegistry } from "../../registries/modes/mode-registry";
import type { ResourceRegistry } from "../../registries/resources/resource-registry";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";
import { createHistoryControllerApi } from "./history-controller-api";
import { createHistoryCursorMover, createHistoryRestoreFinisher, trackLayoutScopeRotation } from "./history-navigation";
import { createHistoryPersistenceScheduler } from "./history-persistence";
import { emptyHistoryState, hydrateHistoryState } from "./history-reconciliation";
import { activateHistoryResource } from "./history-resource-activation";
import {
  closedNavigationEntry,
  compactNavigationEntries,
  entryFromCurrentSnapshot,
  findSubPanelPlacement,
  isSameNavigationEntry,
  withoutSubPanelSelection,
  workbenchNavigationPanelRegions,
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

export const createHistoryController = (input: CreateHistoryControllerInput): HistoryController => {
  const store = createWorkbenchStore<HistoryStoreState>({
    name: "workbench.history",
    initialState: emptyHistoryState(),
  });
  let counter = 0;
  let navigating = false;
  let awaitingRestore = false;
  const isRotatingLayoutScope = trackLayoutScopeRotation(input.layout);
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

  const recordSnapshot = (fromLayoutChange = false, completedResourceOpen = false) => {
    const paused = navigating || awaitingRestore || isRotatingLayoutScope();
    if (paused || (!completedResourceOpen && input.resources.isOpeningResource())) return;
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
    if (role === "location" && input.resources.isOpeningResource()) return;
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
      if (awaitingRestore || isRotatingLayoutScope()) {
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
  // A completed open owns a history commit even if another independent async
  // open is still in flight. Layout listeners remain suppressed until their
  // resource transaction completes, so each open still records one snapshot.
  input.resources.onDidOpenResource(() => recordSnapshot(false, true));

  const restoreSelections = (entry: WorkbenchNavigationEntry) => {
    for (const region of workbenchNavigationPanelRegions) {
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

  const replayResource = (entry: WorkbenchNavigationEntry, scope: string | undefined, replaceActive: boolean) => {
    const resource = entry.resource!;
    replayingResourceUris.add(resource.uri);
    return input.resources.openResource(resource, { replaceActive }).finally(() => {
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
        replayResource: (candidate, replaceActive) => replayResource(candidate, replayScope, replaceActive),
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
