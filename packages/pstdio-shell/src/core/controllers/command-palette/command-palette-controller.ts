import { createDisposable, type Disposable } from "../../shared/disposable";
import { createShellStore, type ShellStore } from "../../shared/store/shell-store";

export type ShellCommandPaletteChangeListener = (open: boolean) => void;

export interface ShellCommandPaletteState {
  open: boolean;
}

export interface ShellCommandPaletteController {
  store: ShellStore<ShellCommandPaletteState>;
  isOpen(): boolean;
  open(): void;
  close(): void;
  toggle(): void;
  onDidChange(listener: ShellCommandPaletteChangeListener): Disposable;
}

export interface CreateShellCommandPaletteControllerInput {
  initialOpen?: boolean;
}

export const createShellCommandPaletteController = (
  input: CreateShellCommandPaletteControllerInput = {},
): ShellCommandPaletteController => {
  const internal = createShellStore<ShellCommandPaletteState>({
    name: "shell.commandPalette",
    initialState: { open: input.initialOpen ?? false },
  });

  const setOpen = (next: boolean) => {
    if (internal.getState().open === next) return;
    internal.setState({ open: next }, false, "setCommandPaletteOpen");
  };

  return {
    store: internal,
    isOpen() {
      return internal.getState().open;
    },
    open() {
      setOpen(true);
    },
    close() {
      setOpen(false);
    },
    toggle() {
      setOpen(!internal.getState().open);
    },
    onDidChange(listener) {
      const unsubscribe = internal.subscribeSelector(
        (state) => state.open,
        (value) => listener(value),
      );
      return createDisposable(unsubscribe);
    },
  };
};
