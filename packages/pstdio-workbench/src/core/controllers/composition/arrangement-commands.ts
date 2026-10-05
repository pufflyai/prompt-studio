import type { WorkbenchPanelRegion, WorkbenchTabPosition } from "../../registries/layout/layout-types";
import type { WorkbenchCore } from "../../workbench-core-types";

export const registerArrangementCommands = (core: WorkbenchCore) => {
  core.commands.registerCommand(
    {
      id: "workbench.resetLayout",
      label: "Reset workbench layout",
      category: "Workbench",
      icon: "RotateCcw",
    },
    { execute: () => core.resetLayout() },
  );
  core.commands.registerCommand<{ instanceId: string; region: WorkbenchPanelRegion; position?: WorkbenchTabPosition }>(
    {
      id: "workbench.movePanel",
      label: "Move workbench tab",
      category: "Workbench",
      icon: "PanelsTopLeft",
      params: {
        instanceId: { type: "string", label: "Tab instance", required: true },
        region: {
          type: "string",
          label: "Destination",
          required: true,
          options: [
            { label: "Main", value: "main" },
            { label: "Side", value: "side" },
            { label: "Secondary", value: "secondary" },
          ],
        },
      },
    },
    { execute: (args) => core.movePanel(args.instanceId, args.region, args.position) },
  );
};
