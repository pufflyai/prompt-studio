import type { WorkbenchCore } from "../../workbench-core-types";

export const registerKeyboardPanelVisibility = (core: WorkbenchCore) => {
  for (const [region, key, label] of [
    ["secondary", "B", "Toggle secondary panel"],
    ["side", "E", "Toggle side panel"],
  ] as const) {
    const id = `workbench.keyboard.toggle.${region}`;
    core.commands.registerCommand(
      { id, label, category: "Panels and tabs" },
      {
        isEnabled: () => {
          const policy = core.shell.getPanelPolicy(region);
          return policy.open ? policy.canClose : policy.canOpen;
        },
        execute: () => core.shell.setRegionOpen(region, !core.shell.getRegionState(region).open),
      },
    );
    core.keybindings.registerKeybinding({
      id,
      action: { kind: "command", commandId: id },
      keybinding: `Alt+Shift+${key}`,
      allowInInputs: true,
      sticky: true,
    });
  }
};
