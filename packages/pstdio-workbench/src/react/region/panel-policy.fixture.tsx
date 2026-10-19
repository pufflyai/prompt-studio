import { Box, Text } from "@chakra-ui/react";
import { createWorkbench } from "../../core";
import type { WorkbenchRegionSettings } from "../../core/registries/layout/layout-types";

export const createPolicyWorkbench = (settings: WorkbenchRegionSettings = {}, legacy = false) => {
  const page = { kind: "page", extensionId: "storybook", id: "policy" } as const;
  const w = createWorkbench({ startPage: page, initialSidePanelMode: "attached" });
  w.modes.registerMode({
    id: "policy",
    activate() {},
    panelHeaders: legacy ? "legacy" : undefined,
    chrome: { status: "status" },
    regionSettings: { main: { showHeader: false }, side: settings, secondary: settings },
  });
  for (const [id, title] of [
    ["main", "Main page"],
    ["side", "Session"],
    ["secondary", "Terminal"],
    ["status", "Mode status"],
  ]) {
    w.views.registerView({
      id,
      title,
      body: {
        kind: "react",
        render: () => (
          <Box p="md">
            <Text>{title} content</Text>
          </Box>
        ),
      },
    });
  }
  w.pages.registerPage({
    id: "policy",
    ref: page,
    path: "policy",
    modeId: "policy",
    main: { kind: "view", view: { kind: "view", id: "main" }, cardinality: "one" },
    slots: [],
  });
  for (const region of ["side", "secondary"] as const) {
    w.modePlacements.registerPlacement({
      id: region,
      ref: { kind: "placement", extensionId: "storybook", id: region },
      modeId: "policy",
      region,
      item: { kind: "view", view: { kind: "view", id: region }, presence: "open" },
    });
  }
  w.pageLocations.switchProject("panel-policy");
  w.pageLocations.navigate({ kind: "page", page });
  return w;
};
