import { Box, Text } from "@chakra-ui/react";
import type { WorkbenchCore } from "../../core";
import { windowingExtensionId } from "./resources";

export const registerWindowingPagePanels = (workbench: WorkbenchCore) => {
  for (const [id, label] of [
    ["workspace-menu", "Workspace tools"],
    ["inspector", "Inspector"],
    ["mode-tools", "Mode tools"],
    ["proposal", "Proposal"],
  ]) {
    workbench.views.registerView({
      id: `windowing.${id}`,
      title: label,
      body: {
        kind: "react",
        render: ({ instance }) => (
          <Box p="md">
            <Text>{label}</Text>
            <Text aria-label={`${label} binding`}>{instance.resource?.label ?? "Project"}</Text>
          </Box>
        ),
      },
    });
  }
  workbench.pages.registerPage({
    id: "windowing.ticket",
    ref: { kind: "page", extensionId: windowingExtensionId, id: "ticket" },
    title: "Ticket",
    path: "windowing/ticket",
    modeId: "windowing",
    main: { kind: "view", view: { kind: "view", id: "windowing.proposal" }, cardinality: "one" },
    panelMenus: { right: { view: { kind: "view", id: "windowing.inspector" }, size: { defaultPx: 240 } } },
    slots: [],
  });
  workbench.modePlacements.registerPlacement({
    id: "windowing.mode-tools",
    ref: { kind: "placement", extensionId: windowingExtensionId, id: "mode-tools" },
    modeId: "windowing",
    region: "secondary",
    item: { kind: "view", view: { kind: "view", id: "windowing.mode-tools" }, presence: "open" },
  });
};
