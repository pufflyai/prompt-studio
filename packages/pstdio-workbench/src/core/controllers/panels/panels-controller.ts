import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";

export interface WorkbenchPanelsState {
  openByAreaId: Record<string, boolean>;
}

export interface PersistedWorkbenchPanels {
  openByAreaId: Record<string, boolean>;
}

export interface WorkbenchPanelsPersistenceAdapter {
  getPanelStates(): PersistedWorkbenchPanels | undefined;
  setPanelStates(state: PersistedWorkbenchPanels): void;
}

export type WorkbenchPanelsChangeListener = (state: WorkbenchPanelsState) => void;

export interface WorkbenchPanelsController {
  store: WorkbenchStore<WorkbenchPanelsState>;
  isOpen(areaId: string): boolean;
  setOpen(areaId: string, open: boolean): void;
  toggle(areaId: string): void;
  onDidChange(listener: WorkbenchPanelsChangeListener): Disposable;
}

export interface CreateWorkbenchPanelsControllerInput {
  persistence?: WorkbenchPanelsPersistenceAdapter;
}

export const createWorkbenchPanelsController = (
  input: CreateWorkbenchPanelsControllerInput = {},
): WorkbenchPanelsController => {
  const persisted = input.persistence?.getPanelStates();

  const store = createWorkbenchStore<WorkbenchPanelsState>({
    name: "workbench.panels",
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
