import { Button, Code, HStack, Text } from "@chakra-ui/react";
import type { CommandExecuteResponse, WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { useState } from "react";
import { createWorkbenchCore, type WorkbenchLayout, type WorkbenchModuleContribution } from "../../core";
import { registerWorkbenchExtensionContributions } from "../../extensions";
import { useWorkbenchStore } from "../../react";
import { ApiWorkbenchFrame } from "./api-story-frame";

const extensionId = "pstdio.api-placement";
export const placementPanelId = `${extensionId}.view.outline`;
const treeBodyCommandId = `${placementPanelId}.tree.body`;
const placementModeId = `${extensionId}.mode.placement`;
const placementRegions = ["sidenav", "main", "secondary", "side"] as const;

const placementMetadata = {
  extensions: [{ id: extensionId, name: "api-placement", displayName: "API placement", sourcePath: "" }],
  commands: [{ id: treeBodyCommandId, extensionId, title: "List outline" }],
  menuContributions: [],
  commandPaletteContributions: [],
  modes: [
    {
      id: placementModeId,
      localId: "placement",
      extensionId,
      label: "Panel placement",
      regions: [...placementRegions],
    },
  ],
  pages: [],
  views: [
    {
      id: placementPanelId,
      localId: "outline",
      extensionId,
      title: "Outline",
      body: {
        kind: "tree",
        bodyHandlerId: treeBodyCommandId,
        defaultExpandedSectionIds: ["placement"],
      },
    },
  ],
  viewMenus: [],
  placements: [
    {
      id: `${extensionId}.placement.outline`,
      localId: "outline",
      extensionId,
      mode: { extensionId, kind: "mode", id: "placement" },
      item: { kind: "view", view: { extensionId, kind: "view", id: "outline" } },
      region: "main",
      defaultOpen: true,
      required: true,
      movableTo: ["main", "sidenav"],
    },
  ],
  resourceKinds: [],
  resourceViews: [],
  navigationItems: [],
  statusBarItems: [],
  statuses: [],
  settingsPanels: [],
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
              { id: "default", label: "The placement defines the default" },
              { id: "saved", label: "Saved placement stays inside movableTo" },
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
