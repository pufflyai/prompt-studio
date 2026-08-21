import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";
import type { WorkbenchCoreContributionContext } from "../../workbench-core";
import {
  type WorkbenchLayout,
  type WorkbenchPanelRegion,
  type WorkbenchRegion,
  type WorkbenchWidgetPlacement,
  workbenchPanelRegions,
} from "../layout/layout-model";
import type { ResourceRef } from "../resources/resource-registry";

export type WorkbenchModeActivationContext = WorkbenchCoreContributionContext;

export type WorkbenchModeActivationResult = Disposable | readonly Disposable[] | undefined;

export interface WorkbenchModeAddablePanel {
  panelId: string;
  region: WorkbenchPanelRegion;
  allowedRegions?: readonly WorkbenchRegion[];
  pinned?: boolean;
}

export interface WorkbenchModeAddablePanelContext {
  layout: WorkbenchLayout;
  resource?: ResourceRef;
}

export interface WorkbenchModeContribution {
  id: string;
  label?: string;
  panels?: readonly WorkbenchPanelRegion[];
  // Resource kinds this mode accepts. The atomic navigator validates targets
  // against this list; a mode without kinds navigates with a cleared resource.
  resourceKinds?: readonly string[];
  // Fallback resource when the mode is entered without a compatible resource.
  defaultResource?: ResourceRef | (() => Promise<ResourceRef | undefined> | ResourceRef | undefined);
  // Returns optional composition panels that are closed in the current context.
  listAddablePanels?(context: WorkbenchModeAddablePanelContext): readonly WorkbenchModeAddablePanel[];
  // Registers the mode's contributions once for the lifetime of the mode.
  activate(ctx: WorkbenchModeActivationContext): WorkbenchModeActivationResult;
  // Seeds default placements only when the persistence scope has no layout yet.
  seed?(ctx: WorkbenchModeActivationContext): void;
  // Activates non-layout behavior while the mode is current.
  enter?(ctx: WorkbenchModeActivationContext): WorkbenchModeActivationResult;
  // Repairs required layout structure whenever the mode-scope context activates:
  // first activation, reselecting the active mode, and persistence-scope changes.
  // Reconciliation must not reset valid optional user state.
  reconcile?(ctx: WorkbenchModeActivationContext): void;
}

export type WorkbenchModeChangeListener = () => void;

export interface WorkbenchModeStoreState {
  modes: Record<string, WorkbenchModeContribution>;
  activeModeId: string | undefined;
}

export interface WorkbenchModeRegistry {
  store: WorkbenchStore<WorkbenchModeStoreState>;
  dispose(): void;
  registerMode(mode: WorkbenchModeContribution): Disposable;
  getMode(id: string): WorkbenchModeContribution | undefined;
  listModes(): WorkbenchModeContribution[];
  getActiveModeId(): string | undefined;
  isTransitioning(): boolean;
  setActiveMode(id: string | undefined, input?: { deferSeed?: boolean }): void;
  seedActiveMode(): void;
  onDidChangeActive(listener: WorkbenchModeChangeListener): Disposable;
}

const toDisposables = (result: WorkbenchModeActivationResult) => {
  if (!result) return [] as Disposable[];
  return Array.isArray(result) ? [...result] : [result as Disposable];
};

const modePanelRegions = {
  main: ["main-header", "main-left-menu", "main", "main-right-menu"],
  secondary: ["secondary-header", "secondary-left-menu", "secondary", "secondary-right-menu"],
  side: ["side-header", "side-left-menu", "side", "side-right-menu"],
} as const satisfies Record<WorkbenchPanelRegion, readonly WorkbenchRegion[]>;

const allModeRegions = Object.values(modePanelRegions).flat();
const panelsForMode = (mode: WorkbenchModeContribution) => mode.panels ?? workbenchPanelRegions;

export const getWorkbenchModePanelForRegion = (region: WorkbenchRegion) =>
  (Object.keys(modePanelRegions) as WorkbenchPanelRegion[]).find((panel) =>
    modePanelRegions[panel].some((candidate) => candidate === region),
  );

export const isWorkbenchModePanelAvailable = (
  mode: WorkbenchModeContribution | undefined,
  panel: WorkbenchPanelRegion,
) => !mode || panelsForMode(mode).includes(panel);

const placementById = (layout: WorkbenchLayout, widgetId: string | undefined) => {
  if (!widgetId) return undefined;
  return Object.values(layout.regions)
    .flatMap((region) => region.widgets)
    .find((placement) => placement.widgetId === widgetId);
};

const withActivePlacement = (
  layout: WorkbenchLayout,
  candidates: readonly (WorkbenchWidgetPlacement | undefined)[],
) => {
  const active = candidates.find((placement) => placement && placementById(layout, placement.widgetId));
  return {
    ...layout,
    activeWidgetId: active?.widgetId,
    activeResourceUri: active?.resourceUri,
  };
};

const clearRegions = (layout: WorkbenchLayout, regionIds: readonly WorkbenchRegion[]) => {
  if (regionIds.length === 0) return layout;
  const clearedPanels = new Set(
    (Object.keys(modePanelRegions) as WorkbenchPanelRegion[]).filter((panel) =>
      modePanelRegions[panel].some((region) => regionIds.includes(region)),
    ),
  );
  const regionsNeedClearing = regionIds.some((regionId) => {
    const region = layout.regions[regionId];
    return region.widgets.length > 0 || region.activeWidgetId !== undefined || region.visible;
  });
  const selectionsNeedClearing = Object.values(layout.locationSubPanelSelections ?? {}).some((selections) =>
    Object.keys(selections).some((panel) => clearedPanels.has(panel as WorkbenchPanelRegion)),
  );
  if (!regionsNeedClearing && !selectionsNeedClearing) return layout;

  const regions = { ...layout.regions };
  for (const regionId of regionIds) {
    regions[regionId] = { ...regions[regionId], widgets: [], activeWidgetId: undefined, visible: false };
  }
  const locationSubPanelSelections = Object.fromEntries(
    Object.entries(layout.locationSubPanelSelections ?? {}).map(([resourceUri, selections]) => [
      resourceUri,
      Object.fromEntries(
        Object.entries(selections).filter(([panel]) => !clearedPanels.has(panel as WorkbenchPanelRegion)),
      ),
    ]),
  );
  const next = { ...layout, regions };
  return {
    ...withActivePlacement(next, [placementById(next, layout.activeWidgetId)]),
    activeLocationWidgetId: placementById(next, layout.activeLocationWidgetId)?.widgetId,
    locationSubPanelSelections,
  };
};

const applyModePanelAvailability = (layout: WorkbenchLayout, panels: readonly WorkbenchPanelRegion[]) => {
  const available = new Set(panels);
  const unavailableRegions = (Object.keys(modePanelRegions) as WorkbenchPanelRegion[])
    .filter((panel) => !available.has(panel))
    .flatMap((panel) => modePanelRegions[panel]);
  return clearRegions(layout, unavailableRegions);
};

const restoreUnscopedModeLayout = (
  current: WorkbenchLayout,
  saved: WorkbenchLayout | undefined,
  panels: readonly WorkbenchPanelRegion[],
) => {
  if (!saved) {
    const regions = { ...current.regions };
    for (const regionId of allModeRegions) {
      const region = regions[regionId];
      const widgets = region.widgets.filter((placement) => placement.role !== "content");
      regions[regionId] = {
        ...region,
        widgets,
        activeWidgetId: widgets.some((placement) => placement.widgetId === region.activeWidgetId)
          ? region.activeWidgetId
          : undefined,
      };
    }
    const withoutModeContent = { ...current, regions };
    return applyModePanelAvailability(
      {
        ...withActivePlacement(withoutModeContent, [placementById(withoutModeContent, current.activeWidgetId)]),
        activeLocationWidgetId: placementById(withoutModeContent, current.activeLocationWidgetId)?.widgetId,
      },
      panels,
    );
  }

  const regions = { ...current.regions };
  for (const regionId of allModeRegions) regions[regionId] = saved.regions[regionId];
  const merged = applyModePanelAvailability({ ...current, regions }, panels);
  const savedActive = placementById(merged, saved.activeWidgetId);
  const currentActive = placementById(merged, current.activeWidgetId);
  return {
    ...withActivePlacement(merged, [savedActive, currentActive]),
    activeLocationWidgetId:
      placementById(merged, saved.activeLocationWidgetId)?.widgetId ??
      placementById(merged, current.activeLocationWidgetId)?.widgetId,
    locationSubPanelSelections: saved.locationSubPanelSelections,
  };
};

const disposeReverse = (disposables: readonly Disposable[]) => {
  for (let index = disposables.length - 1; index >= 0; index -= 1) {
    disposables[index]?.dispose();
  }
};

const restoreModeLayout = (context: WorkbenchModeActivationContext, layout: WorkbenchLayout) => {
  if (layout !== context.layout.getLayout()) context.layout.restoreLayout(layout);
  for (const panel of workbenchPanelRegions) context.panels.setOpen(panel, layout.regions[panel].visible);
};

export interface CreateWorkbenchModeRegistryInput {
  establishLocation?(instanceId: string): void;
  resolveContext(): WorkbenchModeActivationContext;
}

export const createWorkbenchModeRegistry = (input: CreateWorkbenchModeRegistryInput): WorkbenchModeRegistry => {
  const store = createWorkbenchStore<WorkbenchModeStoreState>({
    name: "workbench.modes",
    initialState: { modes: {}, activeModeId: undefined },
  });

  const initializedModes = new Map<string, Disposable[]>();
  const seededScopes = new Set<string>();
  const unscopedLayouts = new Map<string, WorkbenchLayout>();
  let activeDisposables: Disposable[] = [];
  let activeModeContext: Disposable | undefined;
  let deferredSeedModeId: string | undefined;
  let transitioning = false;

  const initializeMode = (mode: WorkbenchModeContribution) => {
    if (initializedModes.has(mode.id)) return;
    const disposables = toDisposables(mode.activate(input.resolveContext()));
    initializedModes.set(mode.id, disposables);
  };

  const seedScope = (mode: WorkbenchModeContribution, context: WorkbenchModeActivationContext) => {
    let locationEstablished = false;
    let unsubscribeMainPanel: () => void = () => undefined;
    const establishSeededLocation = () => {
      if (locationEstablished) return;
      const primary = context.layout.getActivePanel("main");
      if (!primary) return;
      // Sub Panels cannot become Locations; keep waiting for a Location-capable
      // placement instead of consuming the one-shot on a tab.
      const placement = context.layout
        .getLayout()
        .regions.main.widgets.find((candidate) => candidate.widgetId === primary.instanceId);
      if (placement && (placement.role === "sub-panel" || placement.role === "panel-menu")) return;
      locationEstablished = true;
      unsubscribeMainPanel();
      input.establishLocation?.(primary.instanceId);
    };

    unsubscribeMainPanel = context.layout.store.subscribeSelector(
      (state) => state.layout.regions.main,
      establishSeededLocation,
    );
    try {
      mode.seed?.(context);
      establishSeededLocation();
    } finally {
      unsubscribeMainPanel();
    }
  };

  // Applies panel availability and seeds default placements only when the scope is
  // new: no persisted layout and not seeded earlier in this session.
  const prepareScope = (mode: WorkbenchModeContribution) => {
    const context = input.resolveContext();
    const scopeKey = `${mode.id}\0${context.layout.getPersistenceScope() ?? "unscoped"}`;
    const availableLayout = applyModePanelAvailability(context.layout.getLayout(), panelsForMode(mode));
    restoreModeLayout(context, availableLayout);
    context.layout.reconcilePanelMenus();
    if (!seededScopes.has(scopeKey) && !context.layout.enteredWithPersistedLayout()) {
      seedScope(mode, context);
    }
    seededScopes.add(scopeKey);
  };

  // One reconciliation pass for every context activation: first activation,
  // reselecting the active mode, and persistence-scope changes. Repair of required
  // structure belongs to mode.reconcile and runs every time, so a user can recover
  // required placements by reselecting the active mode. Reconciliation must not
  // rerun activate or enter.
  const reconcileScope = (mode: WorkbenchModeContribution) => {
    prepareScope(mode);
    mode.reconcile?.(input.resolveContext());
  };

  // Switching modes stashes the outgoing unscoped layout, disposes the active mode,
  // and restores the incoming mode's unscoped layout before activating it. Scoped
  // layouts are owned by the persistence scope instead.
  const transitionToMode = (id: string | undefined) => {
    const context = input.resolveContext();
    const previousModeId = store.getState().activeModeId;
    const unscoped = context.layout.getPersistenceScope() === undefined;
    if (previousModeId && unscoped) unscopedLayouts.set(previousModeId, context.layout.getLayout());

    disposeActive();
    if (id === undefined) {
      store.setState({ ...store.getState(), activeModeId: undefined }, false, "deactivateMode");
      return;
    }

    const mode = store.getState().modes[id];
    if (!mode) throw new Error(`Workbench mode not registered: ${id}`);
    if (unscoped) {
      restoreModeLayout(
        context,
        restoreUnscopedModeLayout(context.layout.getLayout(), unscopedLayouts.get(id), panelsForMode(mode)),
      );
    }
    activate(id, { seed: deferredSeedModeId !== id });
  };

  const disposeActive = () => {
    disposeReverse(activeDisposables);
    activeDisposables = [];
    activeModeContext?.dispose();
    activeModeContext = undefined;
  };

  const activate = (id: string, options: { seed: boolean }) => {
    const context = input.resolveContext();
    const mode = store.getState().modes[id];
    if (!mode) throw new Error(`Workbench mode not registered: ${id}`);

    const contextScope = context.context.createScope("workbench.mode");
    contextScope.set("activeWorkbenchMode", id);
    contextScope.set(`workbenchMode.${id}`, true);
    activeModeContext = contextScope;
    try {
      initializeMode(mode);
      store.setState({ ...store.getState(), activeModeId: id }, false, "activateMode");
      if (options.seed) prepareScope(mode);
      activeDisposables = toDisposables(mode.enter?.(context));
      if (options.seed) mode.reconcile?.(input.resolveContext());
    } catch (error) {
      disposeActive();
      store.setState({ ...store.getState(), activeModeId: undefined }, false, "deactivateMode");
      throw error;
    }
  };

  const scopeSubscription = input.resolveContext().layout.onDidChangePersistenceScope(() => {
    const activeModeId = store.getState().activeModeId;
    if (activeModeId === deferredSeedModeId) return;
    const mode = activeModeId ? store.getState().modes[activeModeId] : undefined;
    if (mode) reconcileScope(mode);
  });
  const registryDisposable = createDisposable(() => {
    scopeSubscription.dispose();
    disposeActive();
    for (const disposables of initializedModes.values()) disposeReverse(disposables);
    initializedModes.clear();
    seededScopes.clear();
    unscopedLayouts.clear();
    store.setState({ modes: {}, activeModeId: undefined }, false, "disposeModes");
  });

  return {
    store,

    dispose() {
      registryDisposable.dispose();
    },

    registerMode(mode) {
      const snapshot = store.getState();
      if (snapshot.modes[mode.id]) throw new Error(`Workbench mode already registered: ${mode.id}`);

      store.setState({ ...snapshot, modes: { ...snapshot.modes, [mode.id]: mode } }, false, "registerMode");

      return createDisposable(() => {
        const current = store.getState();
        if (current.modes[mode.id] !== mode) return;
        if (current.activeModeId === mode.id) {
          disposeActive();
          store.setState({ ...store.getState(), activeModeId: undefined }, false, "deactivateMode");
        }
        disposeReverse(initializedModes.get(mode.id) ?? []);
        initializedModes.delete(mode.id);
        unscopedLayouts.delete(mode.id);
        for (const scopeKey of seededScopes) {
          if (scopeKey.startsWith(`${mode.id}\0`)) seededScopes.delete(scopeKey);
        }
        const { [mode.id]: _removed, ...rest } = current.modes;
        store.setState({ ...store.getState(), modes: rest }, false, "unregisterMode");
      });
    },

    getMode(id) {
      return store.getState().modes[id];
    },

    listModes() {
      return Object.values(store.getState().modes);
    },

    getActiveModeId() {
      return store.getState().activeModeId;
    },

    // A deferred seed is the second half of one transition: the caller rotates the
    // layout persistence scope between the two halves. Observers must not treat the
    // gap as a settled context, so the transition is not over until the seed runs.
    isTransitioning() {
      return transitioning || deferredSeedModeId !== undefined;
    },

    setActiveMode(id, setActiveInput = {}) {
      if (id === store.getState().activeModeId) {
        // Reselecting the active mode reconciles its layout without disposing or
        // rerunning enter, so a missing required placement can recover.
        const mode = id ? store.getState().modes[id] : undefined;
        if (mode && id !== deferredSeedModeId) reconcileScope(mode);
        return;
      }
      transitioning = true;
      deferredSeedModeId = setActiveInput.deferSeed ? id : undefined;
      try {
        transitionToMode(id);
      } finally {
        transitioning = false;
      }
    },

    seedActiveMode() {
      const activeModeId = store.getState().activeModeId;
      const mode = activeModeId ? store.getState().modes[activeModeId] : undefined;
      transitioning = true;
      try {
        if (mode) reconcileScope(mode);
      } finally {
        deferredSeedModeId = undefined;
        transitioning = false;
      }
    },

    onDidChangeActive(listener) {
      const unsubscribe = store.subscribeSelector(
        (state) => state.activeModeId,
        () => listener(),
      );
      return createDisposable(unsubscribe);
    },
  };
};
