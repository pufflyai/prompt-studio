import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore } from "../../shared/store/workbench-store";
import { runWorkbenchEffect } from "../../shared/workbench-effect";
import type { WorkbenchLayout } from "../layout/layout-model";
import {
  applyModePanelAvailability,
  disposeReverse,
  panelsForMode,
  restoreModeLayout,
  restoreUnscopedModeLayout,
} from "./mode-layout";
import { setWorkbenchModeRegistryInternals } from "./mode-registry-internals";
import type {
  CreateWorkbenchModeRegistryInput,
  WorkbenchModeActivationResult,
  WorkbenchModeContribution,
  WorkbenchModeRegistry,
  WorkbenchModeStoreState,
} from "./mode-registry-types";
import { seedModeScope } from "./mode-seed-scope";

export { getWorkbenchModePanelForRegion, isWorkbenchModePanelAvailable } from "./mode-layout";
export type {
  CreateWorkbenchModeRegistryInput,
  WorkbenchModeActivationContext,
  WorkbenchModeActivationResult,
  WorkbenchModeAddablePanel,
  WorkbenchModeAddablePanelContext,
  WorkbenchModeChangeListener,
  WorkbenchModeContribution,
  WorkbenchModeRegistry,
  WorkbenchModeStoreState,
} from "./mode-registry-types";

const toDisposables = (result: WorkbenchModeActivationResult) => {
  if (!result) return [] as Disposable[];
  return Array.isArray(result) ? [...result] : [result as Disposable];
};

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
    const disposables = toDisposables(
      runWorkbenchEffect(`mode ${mode.id}.activate`, () => mode.activate(input.resolveContext())),
    );
    initializedModes.set(mode.id, disposables);
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
      seedModeScope(mode, context, input.establishLocation);
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
    runWorkbenchEffect(`mode ${mode.id}.reconcile`, () => mode.reconcile?.(input.resolveContext()));
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

  const activatePageMode = (id: string | undefined, applyLayout: () => void) => {
    if (id && !store.getState().modes[id]) throw new Error(`Workbench mode not registered: ${id}`);
    if (id === store.getState().activeModeId) {
      applyLayout();
      return;
    }
    // Publish the page's mode before its layout. Layout listeners may open panels
    // owned by that mode as soon as the new primary resource appears.
    transitioning = true;
    deferredSeedModeId = undefined;
    try {
      disposeActive();
      if (id === undefined) {
        store.setState({ ...store.getState(), activeModeId: undefined }, false, "deactivatePageMode");
        applyLayout();
        return;
      }
      activate(id, { seed: false, afterPublish: applyLayout });
    } finally {
      transitioning = false;
    }
  };

  const disposeActive = () => {
    disposeReverse(activeDisposables);
    activeDisposables = [];
    activeModeContext?.dispose();
    activeModeContext = undefined;
  };

  const activate = (id: string, options: { seed: boolean; afterPublish?: () => void }) => {
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
      options.afterPublish?.();
      if (options.seed) prepareScope(mode);
      activeDisposables = toDisposables(runWorkbenchEffect(`mode ${mode.id}.enter`, () => mode.enter?.(context)));
      if (options.seed) runWorkbenchEffect(`mode ${mode.id}.reconcile`, () => mode.reconcile?.(input.resolveContext()));
    } catch (error) {
      disposeActive();
      store.setState({ ...store.getState(), activeModeId: undefined }, false, "deactivateMode");
      throw error;
    }
  };

  const scopeSubscription = input.layout.onDidChangePersistenceScope(() => {
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

  const registry: WorkbenchModeRegistry = {
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

  setWorkbenchModeRegistryInternals(registry, { activatePageMode });
  return registry;
};
