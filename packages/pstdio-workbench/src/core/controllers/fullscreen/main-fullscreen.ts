import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";
import type { WorkbenchCore } from "../../workbench-core-types";
import type { WorkbenchFocusRegionId } from "../focus/focus-controller";

export interface MainFullscreenState {
  active: boolean;
  sideOpen: boolean;
}

export const isFullscreenRegionFocusable = (core: WorkbenchCore | undefined, region: WorkbenchFocusRegionId) => {
  const fullscreen = core?.fullscreen.store.getState();
  if (!fullscreen?.active) return undefined;
  return region === "main" || (region === "side" && fullscreen.sideOpen);
};

export const createMainFullscreen = (getCore: () => WorkbenchCore) => {
  const store = createWorkbenchStore<MainFullscreenState>({
    name: "workbench.fullscreen",
    initialState: { active: false, sideOpen: false },
  });
  const sidePolicy = () => getCore().shell.getPanelPolicy("side");
  const canEnter = () => {
    const modes = getCore().modes;
    const id = modes.getActiveModeId();
    return !id || modes.getMode(id)?.canFullscreen !== false;
  };
  const exit = () => {
    if (!store.getState().active) return;
    store.setState({ active: false, sideOpen: false });
    getCore().focus.clearFocus();
  };
  return {
    store: store as WorkbenchStore<MainFullscreenState>,
    canEnter,
    canShowSide: () => {
      const policy = sidePolicy();
      return store.getState().active && policy.provided && policy.floatable && policy.canOpen;
    },
    enter() {
      if (!canEnter()) throw new Error("Fullscreen is not available in this mode");
      if (store.getState().active) return;
      const policy = sidePolicy();
      store.setState({ active: true, sideOpen: policy.open && policy.floatable });
      getCore().focus.setActiveRegion("main");
    },
    exit,
    showSide() {
      if (!store.getState().active) throw new Error("Main fullscreen is not active");
      const policy = sidePolicy();
      if (!policy.provided) throw new Error("Panel is not provided: side");
      if (!policy.floatable) throw new Error("Panel cannot float: side");
      if (!policy.canOpen) throw new Error("Panel cannot open: side");
      store.setState({ sideOpen: true });
      getCore().focus.setActiveRegion("side");
    },
    hideSide() {
      if (!store.getState().active) throw new Error("Main fullscreen is not active");
      if (!sidePolicy().canClose) throw new Error("Panel cannot close: side");
      store.setState({ sideOpen: false });
      getCore().focus.clearFocus();
    },
  };
};

export type MainFullscreenController = ReturnType<typeof createMainFullscreen>;

export const connectMainFullscreen = (core: WorkbenchCore) => {
  const subscriptions = [
    core.modes.store.subscribeSelector((state) => state.activeModeId, core.fullscreen.exit),
    core.pages.store.subscribeSelector((state) => state.projectId, core.fullscreen.exit),
    core.layout.store.subscribe((state, previous) => {
      if (!core.fullscreen.store.getState().sideOpen) return;
      const side = state.layout.regions.side;
      const before = previous.layout.regions.side;
      const closed = before.visible && !side.visible;
      const emptied = before.widgets.length > 0 && side.widgets.length === 0;
      if ((closed || emptied) && core.shell.getPanelPolicy("side").canClose) core.fullscreen.hideSide();
    }),
  ];
  const toggleId = "workbench.toggleMainFullscreen";
  core.commands.registerCommand(
    { id: toggleId, label: "Toggle Main fullscreen", category: "Panels and tabs", icon: "Maximize" },
    {
      isEnabled: () => core.fullscreen.store.getState().active || core.fullscreen.canEnter(),
      execute: () => {
        if (core.fullscreen.store.getState().active) core.fullscreen.exit();
        else core.fullscreen.enter();
      },
    },
  );
  core.keybindings.registerKeybinding({
    id: toggleId,
    action: { kind: "command", commandId: toggleId },
    keybinding: "Alt+Shift+Z",
    allowInInputs: true,
  });
  for (const [id, label, execute] of [
    ["enterMainFullscreen", "Enter Main fullscreen", core.fullscreen.enter],
    ["exitMainFullscreen", "Exit Main fullscreen", core.fullscreen.exit],
    ["showFullscreenSide", "Show fullscreen Side Panel", core.fullscreen.showSide],
    ["hideFullscreenSide", "Hide fullscreen Side Panel", core.fullscreen.hideSide],
  ] as const) {
    core.commands.registerCommand(
      { id: `workbench.${id}`, label, category: "Workbench" },
      { execute, isEnabled: id === "enterMainFullscreen" ? core.fullscreen.canEnter : undefined },
    );
  }
  return () => {
    for (const unsubscribe of subscriptions) unsubscribe();
    core.fullscreen.exit();
  };
};
