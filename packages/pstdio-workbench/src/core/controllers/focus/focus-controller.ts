import type { ContextKeyService } from "../../shared/context/context-key-service";
import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";

export const workbenchFocusRegions = ["activity", "sidenav", "main", "secondary", "side", "status"] as const;

export type WorkbenchFocusRegionId = (typeof workbenchFocusRegions)[number];

export type WorkbenchFocusChangeListener = (region: WorkbenchFocusRegionId | undefined) => void;

export interface WorkbenchFocusState {
  activeRegion: WorkbenchFocusRegionId | undefined;
}

export interface WorkbenchFocusController {
  store: WorkbenchStore<WorkbenchFocusState>;
  setActiveRegion(region: WorkbenchFocusRegionId): void;
  clearFocus(): void;
  getActiveRegion(): WorkbenchFocusRegionId | undefined;
  onDidChange(listener: WorkbenchFocusChangeListener): Disposable;
}

export interface CreateWorkbenchFocusControllerInput {
  context: ContextKeyService;
  isRegionFocusable?: (region: WorkbenchFocusRegionId) => boolean;
}

const focusContextByRegion = {
  activity: "activityFocus",
  sidenav: "sidenavFocus",
  main: "mainFocus",
  secondary: "secondaryFocus",
  side: "sideFocus",
  status: "statusFocus",
} as const satisfies Record<WorkbenchFocusRegionId, string>;

export const createWorkbenchFocusController = (
  input: CreateWorkbenchFocusControllerInput,
): WorkbenchFocusController => {
  const store = createWorkbenchStore<WorkbenchFocusState>({
    name: "workbench.focus",
    initialState: { activeRegion: undefined },
  });
  const context = input.context.createScope("workbench.focus");

  const applyContext = (region: WorkbenchFocusRegionId | undefined) => {
    context.set("workbenchFocus", region !== undefined);
    context.set("activeWorkbenchFocusRegion", region);
    for (const focusRegion of workbenchFocusRegions) {
      context.set(focusContextByRegion[focusRegion], focusRegion === region);
    }
  };

  applyContext(undefined);

  return {
    store,

    setActiveRegion(region) {
      if (input.isRegionFocusable?.(region) === false) return;
      if (store.getState().activeRegion === region) return;
      store.setState({ activeRegion: region }, false, "setActiveWorkbenchFocusRegion");
      applyContext(region);
    },

    clearFocus() {
      if (store.getState().activeRegion === undefined) return;
      store.setState({ activeRegion: undefined }, false, "clearWorkbenchFocusRegion");
      applyContext(undefined);
    },

    getActiveRegion() {
      return store.getState().activeRegion;
    },

    onDidChange(listener) {
      const unsubscribe = store.subscribeSelector(
        (state) => state.activeRegion,
        (region) => listener(region),
      );
      return createDisposable(unsubscribe);
    },
  };
};
