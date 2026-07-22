import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";
import type { WorkbenchCoreContributionContext } from "../../workbench-core";
import type { WorkbenchLayout } from "../layout/layout-model";

export type WorkbenchModeActivationContext = WorkbenchCoreContributionContext;

export type WorkbenchModeActivationResult = Disposable | readonly Disposable[] | undefined;

export interface WorkbenchModeContribution {
  id: string;
  label?: string;
  activate(ctx: WorkbenchModeActivationContext): WorkbenchModeActivationResult;
}

export type WorkbenchModeChangeListener = () => void;

export interface WorkbenchModeStoreState {
  modes: Record<string, WorkbenchModeContribution>;
  activeModeId: string | undefined;
}

export interface WorkbenchModeRegistry {
  store: WorkbenchStore<WorkbenchModeStoreState>;
  registerMode(mode: WorkbenchModeContribution): Disposable;
  getMode(id: string): WorkbenchModeContribution | undefined;
  listModes(): WorkbenchModeContribution[];
  getActiveModeId(): string | undefined;
  isTransitioning(): boolean;
  setActiveMode(id: string | undefined): void;
  onDidChangeActive(listener: WorkbenchModeChangeListener): Disposable;
}

const toDisposables = (result: WorkbenchModeActivationResult) => {
  if (!result) return [] as Disposable[];
  return Array.isArray(result) ? [...result] : [result as Disposable];
};

export interface CreateWorkbenchModeRegistryInput {
  resolveContext(): WorkbenchModeActivationContext;
}

export const createWorkbenchModeRegistry = (input: CreateWorkbenchModeRegistryInput): WorkbenchModeRegistry => {
  const store = createWorkbenchStore<WorkbenchModeStoreState>({
    name: "workbench.modes",
    initialState: { modes: {}, activeModeId: undefined },
  });

  let activeDisposables: Disposable[] = [];
  let activePlacementIds = new Set<string>();
  let activeBaselinePlacementIds = new Set<string>();
  let activeLayoutSubscription: (() => void) | undefined;
  let activeModeContext: Disposable | undefined;
  let transitioning = false;

  const listPlacementIds = (layout: WorkbenchLayout) =>
    Object.values(layout.regions).flatMap((region) => region.widgets.map((placement) => placement.widgetId));

  const captureActivePlacements = (layout: WorkbenchLayout) => {
    for (const placement of Object.values(layout.regions).flatMap((region) => region.widgets)) {
      // Location-aware placements belong to their persisted workspace; modes only
      // own anonymous content chrome created while the mode is active.
      if (placement.role !== "content") continue;
      if (!activeBaselinePlacementIds.has(placement.widgetId)) activePlacementIds.add(placement.widgetId);
    }
  };

  const disposeActive = (options: { publish?: boolean } = {}) => {
    const context = input.resolveContext();
    activeLayoutSubscription?.();
    activeLayoutSubscription = undefined;
    for (let index = activeDisposables.length - 1; index >= 0; index -= 1) {
      activeDisposables[index]?.dispose();
    }
    for (const widgetId of activePlacementIds) {
      context.layout.removeWidgetPlacement(widgetId);
    }
    activeDisposables = [];
    activePlacementIds = new Set();
    activeBaselinePlacementIds = new Set();
    activeModeContext?.dispose();
    activeModeContext = undefined;
    if (options.publish !== false) {
      store.setState({ ...store.getState(), activeModeId: undefined }, false, "deactivateMode");
    }
  };

  const activate = (id: string) => {
    const context = input.resolveContext();
    const mode = store.getState().modes[id];
    if (!mode) throw new Error(`Workbench mode not registered: ${id}`);

    const before = new Set(listPlacementIds(context.layout.getLayout()));
    activeBaselinePlacementIds = before;
    const contextScope = context.context.createScope("workbench.mode");
    contextScope.set("activeWorkbenchMode", id);
    contextScope.set(`workbenchMode.${id}`, true);
    activeModeContext = contextScope;

    activeLayoutSubscription = context.layout.store.subscribe((state) => captureActivePlacements(state.layout));
    store.setState({ ...store.getState(), activeModeId: id }, false, "activateMode");
    try {
      activeDisposables = toDisposables(mode.activate(context));
      captureActivePlacements(context.layout.getLayout());
    } catch (error) {
      disposeActive();
      throw error;
    }
  };

  return {
    store,

    registerMode(mode) {
      const snapshot = store.getState();
      if (snapshot.modes[mode.id]) throw new Error(`Workbench mode already registered: ${mode.id}`);

      store.setState({ ...snapshot, modes: { ...snapshot.modes, [mode.id]: mode } }, false, "registerMode");

      return createDisposable(() => {
        const current = store.getState();
        if (current.modes[mode.id] !== mode) return;
        if (current.activeModeId === mode.id) disposeActive();
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

    isTransitioning() {
      return transitioning;
    },

    setActiveMode(id) {
      if (id === store.getState().activeModeId) return;
      transitioning = true;
      try {
        disposeActive({ publish: id === undefined });
        if (id !== undefined) activate(id);
      } finally {
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
