import type { CommandParamSchema, WorkbenchCommandExecutionContext } from "../../registries/commands/command-registry";
import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";

export type WorkbenchCommandPaletteChangeListener = (open: boolean) => void;
export type WorkbenchCommandPaletteView = "main" | "theme";

// A pending request to collect a command's params before running it. Held on the
// controller (not in a single React tree) so any surface — palette entries, header
// actions, tree actions — can open the one shared params dialog.
export interface WorkbenchCommandParamsRequest {
  record: {
    command: {
      id: string;
      label: string;
      params?: CommandParamSchema;
      resourceMutation?: import("@pstdio/sdk/extensions").CommandDefinition["resourceMutation"];
    };
  };
  label: string;
  args?: unknown;
  context?: WorkbenchCommandExecutionContext;
}

export interface WorkbenchCommandConfirmation {
  label: string;
  resolve(confirmed: boolean): void;
}

export interface WorkbenchCommandPaletteState {
  confirmation: WorkbenchCommandConfirmation | null;
  open: boolean;
  view: WorkbenchCommandPaletteView;
  initialQuery: string;
  paramsRequest: WorkbenchCommandParamsRequest | null;
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
  getParamsRequest(): WorkbenchCommandParamsRequest | null;
  open(input?: WorkbenchCommandPaletteOpenInput): void;
  close(): void;
  toggle(): void;
  requestConfirmation(label: string): Promise<boolean>;
  requestParams(request: WorkbenchCommandParamsRequest): void;
  clearParams(): void;
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
    initialState: {
      open: input.initialOpen ?? false,
      view: "main",
      initialQuery: "",
      paramsRequest: null,
      confirmation: null,
    },
  });

  // Patches open/view/initialQuery while preserving paramsRequest, which has its own
  // lifecycle (a request can outlive the palette being closed).
  const setOpenState = (next: Pick<WorkbenchCommandPaletteState, "open" | "view" | "initialQuery">) => {
    const current = internal.getState();
    if (current.open === next.open && current.view === next.view && current.initialQuery === next.initialQuery) return;
    internal.setState({ ...current, ...next }, false, "setCommandPaletteState");
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
    getParamsRequest() {
      return internal.getState().paramsRequest;
    },
    open(openInput = {}) {
      setOpenState({ open: true, view: openInput.view ?? "main", initialQuery: openInput.initialQuery ?? "" });
    },
    close() {
      setOpenState({ open: false, view: "main", initialQuery: "" });
    },
    toggle() {
      setOpenState({ open: !internal.getState().open, view: "main", initialQuery: "" });
    },
    requestConfirmation(label) {
      internal.getState().confirmation?.resolve(false);
      return new Promise<boolean>((resolve) => {
        const confirmation = {
          label,
          resolve: (confirmed: boolean) => {
            if (internal.getState().confirmation === confirmation)
              internal.setState({ ...internal.getState(), confirmation: null });
            resolve(confirmed);
          },
        };
        internal.setState({ ...internal.getState(), confirmation });
      });
    },
    requestParams(request) {
      internal.setState({ ...internal.getState(), paramsRequest: request }, false, "requestCommandParams");
    },
    clearParams() {
      if (!internal.getState().paramsRequest) return;
      internal.setState(
        { ...internal.getState(), paramsRequest: null, confirmation: null },
        false,
        "clearCommandParams",
      );
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
