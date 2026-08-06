import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";

export type WorkbenchSidePanelMode = "floating" | "closed" | "attached";

export type WorkbenchSidePanelChangeListener = (mode: WorkbenchSidePanelMode) => void;

export interface WorkbenchSidePanelState {
  mode: WorkbenchSidePanelMode;
}

export interface WorkbenchSidePanelController {
  store: WorkbenchStore<WorkbenchSidePanelState>;
  getMode(): WorkbenchSidePanelMode;
  setMode(mode: WorkbenchSidePanelMode): void;
  onDidChange(listener: WorkbenchSidePanelChangeListener): Disposable;
}

export interface WorkbenchSidePanelPersistenceAdapter {
  getMode(): WorkbenchSidePanelMode | undefined;
  setMode(mode: WorkbenchSidePanelMode): void;
}

export interface CreateWorkbenchSidePanelControllerInput {
  initialMode?: WorkbenchSidePanelMode;
  persistence?: WorkbenchSidePanelPersistenceAdapter;
}

export const createWorkbenchSidePanelController = (
  input: CreateWorkbenchSidePanelControllerInput = {},
): WorkbenchSidePanelController => {
  const internal = createWorkbenchStore<WorkbenchSidePanelState>({
    name: "workbench.sidePanel",
    // What the user last chose outranks the app's opening default.
    initialState: { mode: input.persistence?.getMode() ?? input.initialMode ?? "floating" },
  });

  return {
    store: internal,
    getMode() {
      return internal.getState().mode;
    },
    setMode(next) {
      if (internal.getState().mode === next) return;
      internal.setState({ mode: next }, false, "setMode");
      input.persistence?.setMode(next);
    },
    onDidChange(listener) {
      const unsubscribe = internal.subscribeSelector(
        (state) => state.mode,
        (mode) => listener(mode),
      );
      return createDisposable(unsubscribe);
    },
  };
};
