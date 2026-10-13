import { workbenchCommandPaletteMenuPath } from "../../registries/menus/workbench-menu-paths";
import type { WorkbenchCore } from "../../workbench-core-types";
import { requireFloatingBubblePosition } from "../side-panel/floating-bubble-position";

export const registerPanelCommands = (core: WorkbenchCore) => {
  core.commands.registerCommand(
    { id: "workbench.setFloatingBubblePosition", label: "Move floating bubble", category: "Workbench" },
    { execute: (args: unknown) => core.sidePanel.setBubblePosition(requireFloatingBubblePosition(args)) },
  );
  for (const [region, name, label, icon] of [
    ["side", "SidePanel", "Side Panel", "PanelRight"],
    ["secondary", "SecondaryPanel", "Secondary Panel", "PanelBottom"],
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
          execute: (args: { presentation?: "attached" | "floating" } | undefined) => {
            const presentation = args?.presentation;
            if (presentation !== undefined && presentation !== "attached" && presentation !== "floating")
              throw new Error("Invalid Side presentation");
            const current = core.shell.getRegionState(region).open;
            const samePresentation = !presentation || core.sidePanel.getMode() === presentation;
            return core.shell.setRegionOpen(
              region,
              action === "toggle" ? !(current && samePresentation) : action === "open",
              presentation,
            );
          },
        },
      );
      core.layout.registerMenuItem(workbenchCommandPaletteMenuPath, { commandId: id, group: "Workbench" });
    }
  }
};
