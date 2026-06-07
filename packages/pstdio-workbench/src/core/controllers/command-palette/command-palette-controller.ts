import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";

export type WorkbenchCommandPaletteChangeListener = (open: boolean) => void;
export type WorkbenchCommandPaletteView = "main" | "theme" | "mode";

export interface WorkbenchCommandPaletteState {
  open: boolean;
  view: WorkbenchCommandPaletteView;
  initialQuery: string;
}

export interface WorkbenchCommandPaletteOpenInput {
  view?: WorkbenchCommandPaletteView;
  initialQuery?: string;
}

export interface WorkbenchCommandPaletteController {
  store: WorkbenchStore<WorkbenchCommandPaletteState>;
  isOpen(): boolean;
  getView(): WorkbenchCommandPaletteView;
  getInitialQuery(): string;
  open(input?: WorkbenchCommandPaletteOpenInput): void;
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
    initialState: { open: input.initialOpen ?? false, view: "main", initialQuery: "" },
  });

  const setState = (next: WorkbenchCommandPaletteState) => {
    const current = internal.getState();
    if (current.open === next.open && current.view === next.view && current.initialQuery === next.initialQuery) return;
    internal.setState(next, false, "setCommandPaletteState");
  };

  return {
    store: internal,
    isOpen() {
      return internal.getState().open;
    },
    getView() {
      return internal.getState().view;
    },
    getInitialQuery() {
      return internal.getState().initialQuery;
    },
    open(openInput = {}) {
      setState({ open: true, view: openInput.view ?? "main", initialQuery: openInput.initialQuery ?? "" });
    },
    close() {
      setState({ open: false, view: "main", initialQuery: "" });
    },
    toggle() {
      if (internal.getState().open) {
        setState({ open: false, view: "main", initialQuery: "" });
        return;
      }

      setState({ open: true, view: "main", initialQuery: "" });
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
