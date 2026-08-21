import { Button, Code, HStack, Text } from "@chakra-ui/react";
import type { CommandExecuteResponse, WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { useState } from "react";
import {
  createWorkbenchCore,
  type WorkbenchLayout,
  type WorkbenchModuleContribution,
  type WorkbenchPanelRegion,
} from "../../core";
import { registerWorkbenchExtensionContributions } from "../../extensions";
import { useWorkbenchStore } from "../../react";
import { ApiWorkbenchFrame } from "./api-story-frame";

const extensionId = "pstdio.api-placement";
export const placementPanelId = "api-placement.outline";
const treeRendererId = "api-placement.outline-tree";
const treeBodyCommandId = "api-placement.outline-body";
const placementModeId = "api-placement.mode";
const panelRegions: WorkbenchPanelRegion[] = ["main", "secondary", "side"];
const placementRegions = ["sidenav", "main", "secondary", "side"] as const;

const placementMetadata = {
  extensions: [{ id: extensionId, name: "api-placement", displayName: "API placement", sourcePath: "" }],
  commands: [{ id: treeBodyCommandId, extensionId, title: "List outline" }],
  menuContributions: [],
  commandPaletteContributions: [],
  modes: [
    {
      id: "api-placement.mode-record",
      extensionId,
      modeId: placementModeId,
      label: "Panel placement",
      panelRegions,
    },
  ],
  panels: [
    {
      id: placementPanelId,
      extensionId,
      title: "Outline",
      show: { region: "main", allowedRegions: ["main", "sidenav"], required: true },
      renderer: { kind: "tree", id: treeRendererId },
    },
  ],
  routes: [],
  settingsPanels: [],
  treeItems: [],
  treeRenderers: [
    {
      id: treeRendererId,
      extensionId,
      title: "Outline",
      bodyHandlerId: treeBodyCommandId,
      defaultExpandedSectionIds: ["placement"],
    },
  ],
  diagnostics: [],
} satisfies WorkbenchExtensionMetadata;

const placementSuccess = (value: unknown): CommandExecuteResponse => ({
  commandId: treeBodyCommandId,
  extensionId,
  outcome: { ok: true, status: "success", value },
});

const placementModule: WorkbenchModuleContribution = {
  id: "api.extension-placement",
  activate(ctx) {
    const registration = registerWorkbenchExtensionContributions({
      executeCommand: () =>
        placementSuccess([
          {
            id: "placement",
            label: "Placement API",
            nodes: [
              { id: "show", label: "show defines the default" },
              { id: "saved", label: "saved placement stays inside allowedRegions" },
            ],
          },
        ]),
      metadata: placementMetadata,
      projectId: "storybook-api",
      workbench: ctx,
    });
    ctx.modes.setActiveMode(placementModeId);
    return registration;
  },
};

const createExtensionPlacementWorkbench = () => {
  const workbench = createWorkbenchCore();
  workbench.registerModule(placementModule);
  return workbench;
};

const placementRegion = (layout: WorkbenchLayout) =>
  placementRegions.find((region) =>
    layout.regions[region].widgets.some((placement) => placement.contributionId === placementPanelId),
  );

export const ExtensionPlacementExample = () => {
  const [workbench] = useState(createExtensionPlacementWorkbench);
  const layout = useWorkbenchStore(workbench.layout.store, (state) => state.layout);
  const region = placementRegion(layout);
  const movePanel = (nextRegion: "main" | "sidenav") => {
    workbench.layout.openPanel(placementPanelId, {
      region: nextRegion,
      role: nextRegion === "main" ? "location" : "sub-panel",
      closable: false,
      pinned: true,
      strategy: { kind: "persistent" },
    });
  };

  return (
    <ApiWorkbenchFrame workbench={workbench}>
      <HStack justify="space-between" wrap="wrap">
        <HStack>
          <Button size="sm" variant="outline" onClick={() => movePanel("main")}>
            Move to main
          </Button>
          <Button size="sm" variant="outline" onClick={() => movePanel("sidenav")}>
            Move to sidenav
          </Button>
        </HStack>
        <Text>
          Resolved region: <Code data-testid="placement-region">{region ?? "not placed"}</Code>
        </Text>
      </HStack>
    </ApiWorkbenchFrame>
  );
};
