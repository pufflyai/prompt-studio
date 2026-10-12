import { Box, Text } from "@chakra-ui/react";
import type { WorkbenchCore } from "../../core";
import { windowingExtensionId } from "./resources";

export const registerWindowingPagePanels = (workbench: WorkbenchCore) => {
  for (const [id, label] of [
    ["workspace-menu", "Workspace tools"],
    ["inspector", "Inspector"],
    ["mode-tools", "Mode tools"],
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
  workbench.modePlacements.registerPlacement({
    id: "windowing.mode-tools",
    ref: { kind: "placement", extensionId: windowingExtensionId, id: "mode-tools" },
    modeId: "windowing",
    region: "secondary",
    item: { kind: "view", view: { kind: "view", id: "windowing.mode-tools" }, presence: "fixed" },
  });
};
