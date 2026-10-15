import { workbenchCommandPaletteMenuPath } from "../../registries/menus/workbench-menu-paths";
import type { WorkbenchCore } from "../../workbench-core-types";

export const registerFullscreenCommands = (core: WorkbenchCore) => {
  for (const [id, label, icon, execute] of [
    ["enterMainFullscreen", "Expand page", "Maximize", core.fullscreen.enter],
    ["exitMainFullscreen", "Exit fullscreen", "Minimize", core.fullscreen.exit],
    ["showFullscreenSide", "Show Sidebar", "PanelRight", core.fullscreen.showSide],
    ["hideFullscreenSide", "Hide Sidebar", "PanelRight", core.fullscreen.hideSide],
  ] as const) {
    core.commands.registerCommand(
      { id: `workbench.${id}`, label, icon, category: "Workbench" },
      {
        execute: async () => execute(),
        isVisible: () => {
          const active = core.fullscreen.store.getState().active;
          if (id === "enterMainFullscreen") return !active && core.fullscreen.canEnter();
          if (id === "exitMainFullscreen") return active;
          const policy = core.shell.getPanelPolicy("side");
          return (
            active &&
            policy.floatable &&
            (id === "showFullscreenSide" ? !policy.open && policy.canOpen : policy.open && policy.canClose)
          );
        },
      },
    );
    core.layout.registerMenuItem(workbenchCommandPaletteMenuPath, { commandId: `workbench.${id}`, group: "Workbench" });
  }
};
