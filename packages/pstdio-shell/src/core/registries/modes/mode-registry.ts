import { createDisposable, type Disposable } from "../../shared/disposable";
import { createShellStore, type ShellStore } from "../../shared/store/shell-store";
import type { ShellCoreContributionContext } from "../../shell-core";

export type ShellModeActivationContext = ShellCoreContributionContext;

export type ShellModeActivationResult = Disposable | readonly Disposable[] | undefined;

export interface ShellModeContribution {
  id: string;
  label?: string;
  activate(ctx: ShellModeActivationContext): ShellModeActivationResult;
}

export type ShellModeChangeListener = () => void;

export interface ShellModeStoreState {
  modes: Record<string, ShellModeContribution>;
  activeModeId: string | undefined;
}

export interface ShellModeRegistry {
  store: ShellStore<ShellModeStoreState>;
  registerMode(mode: ShellModeContribution): Disposable;
  getMode(id: string): ShellModeContribution | undefined;
  listModes(): ShellModeContribution[];
  getActiveModeId(): string | undefined;
  setActiveMode(id: string | undefined): void;
  onDidChangeActive(listener: ShellModeChangeListener): Disposable;
}

const toDisposables = (result: ShellModeActivationResult) => {
  if (!result) return [] as Disposable[];
  return Array.isArray(result) ? [...result] : [result as Disposable];
};

export interface CreateShellModeRegistryInput {
  resolveContext(): ShellModeActivationContext;
}

export const createShellModeRegistry = (input: CreateShellModeRegistryInput): ShellModeRegistry => {
  const store = createShellStore<ShellModeStoreState>({
    name: "shell.modes",
    initialState: { modes: {}, activeModeId: undefined },
  });

  let activeDisposables: Disposable[] = [];

  const disposeActive = () => {
    for (let index = activeDisposables.length - 1; index >= 0; index -= 1) {
      activeDisposables[index]?.dispose();
    }
    activeDisposables = [];
    store.setState({ ...store.getState(), activeModeId: undefined }, false, "deactivateMode");
  };

  const activate = (id: string) => {
    const mode = store.getState().modes[id];
    if (!mode) throw new Error(`Shell mode not registered: ${id}`);

    activeDisposables = toDisposables(mode.activate(input.resolveContext()));
    store.setState({ ...store.getState(), activeModeId: id }, false, "activateMode");
  };

  return {
    store,

    registerMode(mode) {
      const snapshot = store.getState();
      if (snapshot.modes[mode.id]) throw new Error(`Shell mode already registered: ${mode.id}`);

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

    setActiveMode(id) {
      if (id === store.getState().activeModeId) return;
      disposeActive();
      if (id !== undefined) activate(id);
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
