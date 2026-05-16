import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";

export type WorkbenchCommandPaletteChangeListener = (open: boolean) => void;

export interface WorkbenchCommandPaletteState {
  open: boolean;
}

export interface WorkbenchCommandPaletteController {
  store: WorkbenchStore<WorkbenchCommandPaletteState>;
  isOpen(): boolean;
  open(): void;
  close(): void;
  toggle(): void;
  onDidChange(listener: WorkbenchCommandPaletteChangeListener): Disposable;
}

export interface CreateWorkbenchCommandPaletteControllerInput {
  initialOpen?: boolean;
}

export const createWorkbenchCommandPaletteController = (
  input: CreateWorkbenchCommandPaletteControllerInput = {},
): WorkbenchCommandPaletteController => {
  const internal = createWorkbenchStore<WorkbenchCommandPaletteState>({
    name: "workbench.commandPalette",
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
