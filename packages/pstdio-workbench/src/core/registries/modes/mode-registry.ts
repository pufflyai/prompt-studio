import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";
import type { WorkbenchCoreContributionContext } from "../../workbench-core";
import type { Frame } from "../layout/frame-types";

export type WorkbenchModeActivationContext = WorkbenchCoreContributionContext;

export type WorkbenchModeActivationResult = Disposable | readonly Disposable[] | undefined;

export interface WorkbenchModeContribution {
  id: string;
  label?: string;
  frame: Frame;
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
  let activeModeContext: Disposable | undefined;

  const restoreDefaultFrame = () => {
    const layout = input.resolveContext().layout;
    layout.setFrame(layout.getDefaultFrame());
  };

  const disposeActive = (options: { publish?: boolean } = {}) => {
    for (let index = activeDisposables.length - 1; index >= 0; index -= 1) {
      activeDisposables[index]?.dispose();
    }
    activeDisposables = [];
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

    const contextScope = context.context.createScope("workbench.mode");
    contextScope.set("activeWorkbenchMode", id);
    contextScope.set(`workbenchMode.${id}`, true);
    activeModeContext = contextScope;

    context.layout.setPersistenceScope({ mode: id });
    context.layout.setFrame(mode.frame);
    store.setState({ ...store.getState(), activeModeId: id }, false, "activateMode");
    try {
      activeDisposables = toDisposables(mode.activate(context));
    } catch (error) {
      disposeActive();
      restoreDefaultFrame();
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
        if (current.activeModeId === mode.id) {
          disposeActive();
          restoreDefaultFrame();
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

    setActiveMode(id) {
      if (id === store.getState().activeModeId) return;
      disposeActive({ publish: id === undefined });
      if (id !== undefined) activate(id);
      else restoreDefaultFrame();
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
