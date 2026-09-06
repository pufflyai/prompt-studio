import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";

export type WorkbenchSidePanelMode = "floating" | "closed" | "attached";

export type WorkbenchSidePanelChangeListener = (mode: WorkbenchSidePanelMode) => void;

export interface WorkbenchSidePanelState {
  mode: WorkbenchSidePanelMode;
}

export interface WorkbenchSidePanelController {
  canFloat(): boolean;
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
  getFloatingPanels?(): "visible" | "hidden";
  onDidChangePolicy?(listener: () => void): Disposable;
  initialMode?: WorkbenchSidePanelMode;
  persistence?: WorkbenchSidePanelPersistenceAdapter;
}

export const createWorkbenchSidePanelController = (input: CreateWorkbenchSidePanelControllerInput = {}) => {
  const canFloat = () => input.getFloatingPanels?.() !== "hidden";
  const resolveMode = (mode: WorkbenchSidePanelMode) => (!canFloat() && mode === "floating" ? "attached" : mode);
  const internal = createWorkbenchStore<WorkbenchSidePanelState>({
    name: "workbench.sidePanel",
    // What the user last chose outranks the app's opening default.
    initialState: { mode: resolveMode(input.persistence?.getMode() ?? input.initialMode ?? "floating") },
  });

  const setMode = (mode: WorkbenchSidePanelMode) => {
    const next = resolveMode(mode);
    if (internal.getState().mode === next) return;
    internal.setState({ mode: next }, false, "setMode");
    input.persistence?.setMode(next);
  };
  input.onDidChangePolicy?.(() => setMode(internal.getState().mode));

  return {
    canFloat,
    store: internal,
    getMode() {
      return internal.getState().mode;
    },
    setMode,
    onDidChange(listener: WorkbenchSidePanelChangeListener) {
      const unsubscribe = internal.subscribeSelector(
        (state) => state.mode,
        (mode) => listener(mode),
      );
      return createDisposable(unsubscribe);
    },
  };
};
