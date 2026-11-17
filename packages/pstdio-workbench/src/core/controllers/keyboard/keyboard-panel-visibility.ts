import { workbenchCommandPaletteMenuPath } from "../../registries/menus/workbench-menu-paths";
import type { WorkbenchCore } from "../../workbench-core-types";

export const registerKeyboardPanelVisibility = (core: WorkbenchCore) => {
  for (const [region, key, label] of [
    ["sidenav", "S", "Toggle navigation sidebar"],
    ["secondary", "B", "Toggle secondary panel"],
    ["side", "E", "Toggle side panel"],
  ] as const) {
    const id = region === "sidenav" ? "workbench.toggleSideBar" : `workbench.keyboard.toggle.${region}`;
    core.commands.registerCommand(
      {
        id,
        label,
        category: "Layout",
        icon: { sidenav: "PanelLeft", secondary: "PanelBottom", side: "PanelRight" }[region],
      },
      {
        isEnabled: () => {
          const policy = core.shell.getPanelPolicy(region);
          return policy.open ? policy.canClose : policy.canOpen;
        },
        execute: () => core.shell.setRegionOpen(region, !core.shell.getRegionState(region).open),
      },
    );
    core.keybindings.registerKeybinding({
      id: region === "sidenav" ? undefined : id,
      action: { kind: "command", commandId: id },
      keybinding: `Alt+Shift+${key}`,
      allowInInputs: true,
    });
    core.layout.registerMenuItem(workbenchCommandPaletteMenuPath, { commandId: id });
  }
};
