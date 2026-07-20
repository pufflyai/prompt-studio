import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";

export interface WorkbenchPanelsState {
  openByRegionId: Record<string, boolean>;
}

export interface PersistedWorkbenchPanels {
  openByRegionId: Record<string, boolean>;
}

export interface WorkbenchPanelsPersistenceAdapter {
  getPanelStates(): PersistedWorkbenchPanels | undefined;
  setPanelStates(state: PersistedWorkbenchPanels): void;
}

export type WorkbenchPanelsChangeListener = (state: WorkbenchPanelsState) => void;

export interface WorkbenchPanelsController {
  store: WorkbenchStore<WorkbenchPanelsState>;
  isOpen(regionId: string): boolean;
  setOpen(regionId: string, open: boolean): void;
  toggle(regionId: string): void;
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
    initialState: { openByRegionId: persisted?.openByRegionId ?? {} },
  });

  const persistState = () => {
    if (!input.persistence) return;
    input.persistence.setPanelStates({ openByRegionId: store.getState().openByRegionId });
  };

  const isOpen = (regionId: string) => store.getState().openByRegionId[regionId] ?? true;

  return {
    store,

    isOpen,

    setOpen(regionId, open) {
      const snapshot = store.getState();
      if ((snapshot.openByRegionId[regionId] ?? true) === open) return;
      store.setState(
        {
          openByRegionId: { ...snapshot.openByRegionId, [regionId]: open },
        },
        false,
        "setPanelOpen",
      );
      persistState();
    },

    toggle(regionId) {
      this.setOpen(regionId, !isOpen(regionId));
    },

    onDidChange(listener) {
      const unsubscribe = store.subscribe((state) => listener(state));
      return createDisposable(unsubscribe);
    },
  };
};
