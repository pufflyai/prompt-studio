import type { WorkbenchPanelRegion } from "../../registries/layout/layout-types";
import type { WorkbenchCore } from "../../workbench-core-types";
import type { WorkbenchShellOpenRegion } from "./shell-controller";

export const registerPanelCommands = (core: WorkbenchCore) => {
  core.commands.registerCommand<{ region: WorkbenchShellOpenRegion; size: number }>(
    {
      id: "workbench.resizePanel",
      label: "Resize a panel",
      category: "Workbench",
      params: {
        region: {
          type: "string",
          label: "Panel",
          required: true,
          options: [
            { label: "Navigation", value: "sidenav" },
            { label: "Bottom", value: "secondary" },
            { label: "Side", value: "side" },
          ],
        },
        size: { type: "number", label: "Size in pixels", required: true },
      },
    },
    { execute: ({ region, size }) => core.shell.setRegionSize(region, size) },
  );
  core.commands.registerCommand<{ presentation: "attached" | "floating" | "closed" }>(
    {
      id: "workbench.setSidePanelPresentation",
      label: "Set Side Panel presentation",
      category: "Workbench",
      params: {
        presentation: {
          type: "string",
          label: "Presentation",
          required: true,
          options: [
            { label: "Attached", value: "attached" },
            { label: "Floating", value: "floating" },
            { label: "Closed", value: "closed" },
          ],
        },
      },
    },
    { execute: ({ presentation }) => core.shell.setSidePanelPresentation(presentation) },
  );
  core.commands.registerCommand<{ region: WorkbenchShellOpenRegion; open: boolean }>(
    {
      id: "workbench.setPanelOpen",
      label: "Show or hide a panel",
      category: "Workbench",
      params: {
        region: {
          type: "string",
          label: "Panel",
          required: true,
          options: [
            { label: "Navigation", value: "sidenav" },
            { label: "Bottom", value: "secondary" },
            { label: "Side", value: "side" },
          ],
        },
        open: { type: "boolean", label: "Open", required: true },
      },
    },
    { execute: ({ region, open }) => core.shell.setRegionOpen(region, open) },
  );
  core.commands.registerCommand<{ region: WorkbenchPanelRegion; visible: boolean }>(
    {
      id: "workbench.setPanelHeaderVisible",
      label: "Show or hide a panel header",
      category: "Workbench",
      params: {
        region: {
          type: "string",
          label: "Panel",
          required: true,
          options: [
            { label: "Main", value: "main" },
            { label: "Bottom", value: "secondary" },
            { label: "Side", value: "side" },
          ],
        },
        visible: { type: "boolean", label: "Header visible", required: true },
      },
    },
    { execute: ({ region, visible }) => core.shell.setHeaderVisible(region, visible) },
  );
};
