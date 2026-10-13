import type { WorkbenchPanelRegion, WorkbenchTabPosition } from "../../registries/layout/layout-types";
import type { WorkbenchCore } from "../../workbench-core-types";

export const registerArrangementCommands = (core: WorkbenchCore) => {
  core.commands.registerCommand<{
    panel: import("../../registries/layout/panel-geometry").MovablePanel;
    edge: import("@pstdio/sdk/extensions").PanelEdge;
  }>(
    {
      id: "workbench.repositionPanel",
      label: "Reposition whole panel",
      category: "Workbench",
      params: {
        panel: {
          type: "string",
          label: "Panel",
          required: true,
          options: ["main", "secondary", "side", "sidenav", "aside", "bottom"].map((value) => ({
            label: value,
            value,
          })),
        },
        edge: {
          type: "string",
          label: "Edge",
          required: true,
          options: ["left", "right", "top", "bottom"].map((value) => ({ label: value, value })),
        },
      },
    },
    { execute: ({ panel, edge }) => core.repositionPanel(panel, edge) },
  );
  core.commands.registerCommand<{ edge: import("@pstdio/sdk/extensions").PanelEdge }>(
    {
      id: "workbench.setActionBarPosition",
      label: "Move action bar",
      category: "Workbench",
      params: {
        edge: {
          type: "string",
          label: "Edge",
          required: true,
          options: ["left", "right", "top", "bottom"].map((value) => ({ label: value, value })),
        },
      },
    },
    { execute: ({ edge }) => core.setActionBarPosition(edge) },
  );
  core.commands.registerCommand(
    {
      id: "workbench.resetLayout",
      label: "Reset workbench layout",
      category: "Workbench",
      icon: "RotateCcw",
    },
    { execute: () => core.resetLayout() },
  );
  core.commands.registerCommand<{ instanceId: string; region: WorkbenchPanelRegion }>(
    {
      id: "workbench.dropPanelOnEdge",
      label: "Drop tab on closed panel edge",
      category: "Workbench",
      params: {
        instanceId: { type: "string", label: "Tab instance", required: true },
        region: {
          type: "string",
          label: "Destination",
          required: true,
          options: ["side", "secondary", "aside", "bottom"].map((value) => ({ label: value, value })),
        },
      },
    },
    { execute: (args) => core.dropPanelOnEdge(args.instanceId, args.region) },
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
            { label: "Page side panel", value: "aside" },
            { label: "Page bottom panel", value: "bottom" },
            { label: "Side", value: "side" },
            { label: "Secondary", value: "secondary" },
          ],
        },
      },
    },
    { execute: (args) => core.movePanel(args.instanceId, args.region, args.position) },
  );
};
