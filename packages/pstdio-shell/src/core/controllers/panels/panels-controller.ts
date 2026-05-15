import { createDisposable, type Disposable } from "../../shared/disposable";
import { createShellStore, type ShellStore } from "../../shared/store/shell-store";

export interface ShellPanelsState {
  openByAreaId: Record<string, boolean>;
}

export interface PersistedShellPanels {
  openByAreaId: Record<string, boolean>;
}

export interface ShellPanelsPersistenceAdapter {
  getPanelStates(): PersistedShellPanels | undefined;
  setPanelStates(state: PersistedShellPanels): void;
}

export type ShellPanelsChangeListener = (state: ShellPanelsState) => void;

export interface ShellPanelsController {
  store: ShellStore<ShellPanelsState>;
  isOpen(areaId: string): boolean;
  setOpen(areaId: string, open: boolean): void;
  toggle(areaId: string): void;
  onDidChange(listener: ShellPanelsChangeListener): Disposable;
}

export interface CreateShellPanelsControllerInput {
  persistence?: ShellPanelsPersistenceAdapter;
}

export const createShellPanelsController = (input: CreateShellPanelsControllerInput = {}): ShellPanelsController => {
  const persisted = input.persistence?.getPanelStates();

  const store = createShellStore<ShellPanelsState>({
    name: "shell.panels",
    initialState: { openByAreaId: persisted?.openByAreaId ?? {} },
  });

  const persistState = () => {
    if (!input.persistence) return;
    input.persistence.setPanelStates({ openByAreaId: store.getState().openByAreaId });
  };

  const isOpen = (areaId: string) => store.getState().openByAreaId[areaId] ?? true;

  return {
    store,

    isOpen,

    setOpen(areaId, open) {
      const snapshot = store.getState();
      if ((snapshot.openByAreaId[areaId] ?? true) === open) return;
      store.setState(
        {
          openByAreaId: { ...snapshot.openByAreaId, [areaId]: open },
        },
        false,
        "setPanelOpen",
      );
      persistState();
    },

    toggle(areaId) {
      this.setOpen(areaId, !isOpen(areaId));
    },

    onDidChange(listener) {
      const unsubscribe = store.subscribe((state) => listener(state));
      return createDisposable(unsubscribe);
    },
  };
};
