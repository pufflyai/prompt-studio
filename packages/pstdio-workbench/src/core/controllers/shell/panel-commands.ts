import { workbenchCommandPaletteMenuPath } from "../../registries/menus/workbench-menu-paths";
import type { WorkbenchCore } from "../../workbench-core-types";

export const registerPanelCommands = (core: WorkbenchCore) => {
  for (const [region, name, label, icon] of [
    ["side", "SidePanel", "Side Panel", "PanelRight"],
    ["secondary", "SecondaryPanel", "Secondary Panel", "PanelBottom"],
    ["aside", "PageSide", "Page side", "PanelRight"],
    ["bottom", "PageBottom", "Page bottom", "PanelBottom"],
  ] as const) {
    for (const action of ["open", "close", "toggle"] as const) {
      const id = `workbench.${action}${name}`;
      const allowed = () => {
        const policy = core.shell.getPanelPolicy(region);
        return { open: policy.canOpen, close: policy.canClose, toggle: policy.canToggle }[action];
      };
      core.commands.registerCommand(
        { id, label: `${action[0]!.toUpperCase()}${action.slice(1)} ${label}`, category: "Workbench", icon },
        {
          isVisible: () =>
            allowed() && (action === "toggle" || core.shell.getRegionState(region).open === (action === "close")),
          isEnabled: allowed,
          execute: () =>
            core.shell.setRegionOpen(
              region,
              action === "toggle" ? !core.shell.getRegionState(region).open : action === "open",
            ),
        },
      );
      core.layout.registerMenuItem(workbenchCommandPaletteMenuPath, { commandId: id, group: "Workbench" });
    }
  }
};
