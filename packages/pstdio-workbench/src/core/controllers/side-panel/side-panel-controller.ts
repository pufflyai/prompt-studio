import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";

export type WorkbenchSidePanelMode = "floating" | "closed" | "attached";

export type WorkbenchSidePanelChangeListener = (mode: WorkbenchSidePanelMode) => void;

export interface WorkbenchSidePanelState {
  mode: WorkbenchSidePanelMode;
}

export interface WorkbenchSidePanelController {
  readonly detachable: boolean;
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
  detachable?: boolean;
  initialMode?: WorkbenchSidePanelMode;
  persistence?: WorkbenchSidePanelPersistenceAdapter;
}

export const createWorkbenchSidePanelController = (input: CreateWorkbenchSidePanelControllerInput = {}) => {
  const detachable = input.detachable ?? true;
  const resolveMode = (mode: WorkbenchSidePanelMode) => (!detachable && mode === "floating" ? "attached" : mode);
  const internal = createWorkbenchStore<WorkbenchSidePanelState>({
    name: "workbench.sidePanel",
    // What the user last chose outranks the app's opening default.
    initialState: { mode: resolveMode(input.persistence?.getMode() ?? input.initialMode ?? "floating") },
  });

  return {
    detachable,
    store: internal,
    getMode() {
      return internal.getState().mode;
    },
    setMode(mode: WorkbenchSidePanelMode) {
      const next = resolveMode(mode);
      if (internal.getState().mode === next) return;
      internal.setState({ mode: next }, false, "setMode");
      input.persistence?.setMode(next);
    },
    onDidChange(listener: WorkbenchSidePanelChangeListener) {
      const unsubscribe = internal.subscribeSelector(
        (state) => state.mode,
        (mode) => listener(mode),
      );
      return createDisposable(unsubscribe);
    },
  };
};
