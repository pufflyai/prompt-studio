import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";

export type WorkbenchSessionPanelMode = "bubble" | "closed" | "attached";

export type WorkbenchSessionPanelChangeListener = (mode: WorkbenchSessionPanelMode) => void;

export interface WorkbenchSessionPanelState {
  mode: WorkbenchSessionPanelMode;
}

export interface WorkbenchSessionPanelController {
  store: WorkbenchStore<WorkbenchSessionPanelState>;
  getMode(): WorkbenchSessionPanelMode;
  setMode(mode: WorkbenchSessionPanelMode): void;
  onDidChange(listener: WorkbenchSessionPanelChangeListener): Disposable;
}

export interface CreateWorkbenchSessionPanelControllerInput {
  initialMode?: WorkbenchSessionPanelMode;
}

export const createWorkbenchSessionPanelController = (
  input: CreateWorkbenchSessionPanelControllerInput = {},
): WorkbenchSessionPanelController => {
  const internal = createWorkbenchStore<WorkbenchSessionPanelState>({
    name: "workbench.sessionPanel",
    initialState: { mode: input.initialMode ?? "bubble" },
  });

  return {
    store: internal,
    getMode() {
      return internal.getState().mode;
    },
    setMode(next) {
      if (internal.getState().mode === next) return;
      internal.setState({ mode: next }, false, "setMode");
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
