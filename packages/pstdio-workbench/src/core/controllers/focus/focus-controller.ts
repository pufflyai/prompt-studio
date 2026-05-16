import type { ContextKeyService } from "../../shared/context/context-key-service";
import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";

export const workbenchFocusAreas = ["activityBar", "sideBar", "main", "panel", "statusBar"] as const;

export type WorkbenchFocusArea = (typeof workbenchFocusAreas)[number];

export type WorkbenchFocusChangeListener = (area: WorkbenchFocusArea | undefined) => void;

export interface WorkbenchFocusState {
  activeArea: WorkbenchFocusArea | undefined;
}

export interface WorkbenchFocusController {
  store: WorkbenchStore<WorkbenchFocusState>;
  setActiveArea(area: WorkbenchFocusArea): void;
  clearFocus(): void;
  getActiveArea(): WorkbenchFocusArea | undefined;
  onDidChange(listener: WorkbenchFocusChangeListener): Disposable;
}

export interface CreateWorkbenchFocusControllerInput {
  context: ContextKeyService;
}

const focusContextByArea = {
  activityBar: "activityBarFocus",
  sideBar: "sideBarFocus",
  main: "mainFocus",
  panel: "panelFocus",
  statusBar: "statusBarFocus",
} as const satisfies Record<WorkbenchFocusArea, string>;

export const createWorkbenchFocusController = (
  input: CreateWorkbenchFocusControllerInput,
): WorkbenchFocusController => {
  const store = createWorkbenchStore<WorkbenchFocusState>({
    name: "workbench.focus",
    initialState: { activeArea: undefined },
  });
  const context = input.context.createScope("workbench.focus");

  const applyContext = (area: WorkbenchFocusArea | undefined) => {
    context.set("workbenchFocus", area !== undefined);
    context.set("activeWorkbenchFocusArea", area);
    for (const focusArea of workbenchFocusAreas) {
      context.set(focusContextByArea[focusArea], focusArea === area);
    }
  };

  applyContext(undefined);

  return {
    store,

    setActiveArea(area) {
      if (store.getState().activeArea === area) return;
      store.setState({ activeArea: area }, false, "setActiveWorkbenchFocusArea");
      applyContext(area);
    },

    clearFocus() {
      if (store.getState().activeArea === undefined) return;
      store.setState({ activeArea: undefined }, false, "clearWorkbenchFocusArea");
      applyContext(undefined);
    },

    getActiveArea() {
      return store.getState().activeArea;
    },

    onDidChange(listener) {
      const unsubscribe = store.subscribeSelector(
        (state) => state.activeArea,
        (area) => listener(area),
      );
      return createDisposable(unsubscribe);
    },
  };
};
