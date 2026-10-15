import type { WorkbenchRegion, WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import type { WorkbenchPageRegistryStoreState } from "../../registries/pages/page-registry";
import { createWorkbenchStore } from "../../shared/store/workbench-store";
import type { WorkbenchCore } from "../../workbench-core-types";

export const createMainFullscreenController = (resolve: () => WorkbenchCore) => {
  const store = createWorkbenchStore({ name: "workbench.fullscreen", initialState: { active: false } });
  const active = () => store.getState().active;
  const disconnect: (() => void)[] = [];
  const exit = () => {
    if (active()) store.setState({ active: false }, false, "exitMainFullscreen");
  };
  const canEnter = () => {
    const core = resolve();
    const pageId = core.pages.store.getState().activePageId;
    return !!pageId && core.pages.getPage(pageId)?.expandable !== false;
  };
  const sidePolicy = () => resolve().shell.getPanelPolicy("side");
  const getSideMode = () => {
    if (!active()) return resolve().sidePanel.getMode();
    const policy = sidePolicy();
    return policy.provided && policy.floatable && policy.open ? "floating" : "closed";
  };
  const requireSideAction = (action: "open" | "close") => {
    const policy = sidePolicy();
    if (!active()) throw new Error("Main fullscreen is not active");
    if (!policy.provided || !policy.floatable) throw new Error("Fullscreen Side is unavailable");
    if (!(action === "open" ? policy.canOpen : policy.canClose)) throw new Error(`Panel cannot ${action}: side`);
  };
  return {
    store,
    canEnter,
    enter() {
      if (!canEnter()) return { ok: false, message: "This page cannot expand" } as const;
      if (!active()) store.setState({ active: true }, false, "enterMainFullscreen");
      return { ok: true } as const;
    },
    exit,
    getSideMode,
    showSide() {
      requireSideAction("open");
      // Open records visibility intent; the saved attachment is independent of fullscreen.
      return resolve().shell.setRegionOpen("side", true);
    },
    hideSide() {
      requireSideAction("close");
      return resolve().shell.setRegionOpen("side", false);
    },
    beforeReveal(region: WorkbenchRegion) {
      if (region === "secondary" || (region === "side" && !sidePolicy().floatable)) exit();
    },
    beforeTransition(state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>) {
      if (!active()) return;
      const previous = resolve().pages.store.getState();
      if (
        state.projectId !== previous.projectId ||
        state.activeModeId !== previous.activeModeId ||
        !state.activePageId ||
        state.pages[state.activePageId]?.expandable === false
      )
        exit();
    },
    isRegionVisible(region: WorkbenchRegion) {
      if (!active()) return resolve().layout.getLayout().regions[region].visible;
      if (region === "side") return getSideMode() === "floating";
      return (
        (region === "main" || region === "aside" || region === "bottom") && resolve().shell.getPanelPolicy(region).open
      );
    },
    connect() {
      const core = resolve();
      const mode = core.modes.onDidChangeActive(exit);
      disconnect.push(() => mode.dispose());
      disconnect.push(
        core.pages.store.subscribe((state, previous) => {
          if (
            state.projectId !== previous.projectId ||
            (state.activePageId && state.pages[state.activePageId]?.expandable === false)
          )
            exit();
        }),
      );
    },
    dispose() {
      exit();
      for (const unsubscribe of disconnect.splice(0)) unsubscribe();
    },
  };
};

export type MainFullscreenController = ReturnType<typeof createMainFullscreenController>;
