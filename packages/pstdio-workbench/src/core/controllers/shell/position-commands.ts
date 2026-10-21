import type { WorkbenchPanelPosition, WorkbenchPositionedRegion } from "../../registries/layout/panel-positions";
import type { WorkbenchCore } from "../../workbench-core-types";

export const registerPositionCommands = (core: WorkbenchCore) => {
  const position = {
    type: "string" as const,
    label: "Position",
    required: true,
    options: ["left", "right", "top", "bottom"].map((value) => ({ label: value, value })),
  };
  core.commands.registerCommand<{ region: WorkbenchPositionedRegion; position: WorkbenchPanelPosition }>(
    {
      id: "workbench.repositionPanel",
      label: "Change panel position",
      category: "Workbench",
      params: {
        region: {
          type: "string",
          label: "Panel",
          required: true,
          options: [
            { label: "Main", value: "main" },
            { label: "Side", value: "side" },
            { label: "Bottom", value: "secondary" },
            { label: "Navigation", value: "sidenav" },
          ],
        },
        position,
      },
    },
    { execute: (args) => core.shell.repositionPanel(args.region, args.position) },
  );
  core.commands.registerCommand<{ position: WorkbenchPanelPosition }>(
    {
      id: "workbench.setActionBarPosition",
      label: "Change action bar position",
      category: "Workbench",
      params: { position },
    },
    { execute: (args) => core.shell.repositionPanel("activity", args.position) },
  );
};
