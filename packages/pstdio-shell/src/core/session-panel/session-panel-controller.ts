import { createDisposable, type Disposable } from "../disposable";

export type ShellSessionPanelMode = "bubble" | "closed" | "attached";

export type ShellSessionPanelChangeListener = (mode: ShellSessionPanelMode) => void;

export interface ShellSessionPanelController {
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
  let mode: ShellSessionPanelMode = input.initialMode ?? "bubble";
  const listeners = new Set<ShellSessionPanelChangeListener>();

  return {
    getMode() {
      return mode;
    },
    setMode(next) {
      if (mode === next) return;
      mode = next;
      for (const listener of listeners) listener(mode);
    },
    onDidChange(listener) {
      listeners.add(listener);
      return createDisposable(() => {
        listeners.delete(listener);
      });
    },
  };
};
