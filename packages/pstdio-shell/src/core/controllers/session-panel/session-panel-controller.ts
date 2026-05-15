import { createDisposable, type Disposable } from "../../shared/disposable";
import { createShellStore, type ShellStore } from "../../shared/store/shell-store";

export type ShellSessionPanelMode = "bubble" | "closed" | "attached";

export type ShellSessionPanelChangeListener = (mode: ShellSessionPanelMode) => void;

export interface ShellSessionPanelState {
  mode: ShellSessionPanelMode;
}

export interface ShellSessionPanelController {
  store: ShellStore<ShellSessionPanelState>;
  getMode(): ShellSessionPanelMode;
  setMode(mode: ShellSessionPanelMode): void;
  onDidChange(listener: ShellSessionPanelChangeListener): Disposable;
}

export interface CreateShellSessionPanelControllerInput {
  initialMode?: ShellSessionPanelMode;
}

export const createShellSessionPanelController = (
  input: CreateShellSessionPanelControllerInput = {},
): ShellSessionPanelController => {
  const internal = createShellStore<ShellSessionPanelState>({
    name: "shell.sessionPanel",
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
