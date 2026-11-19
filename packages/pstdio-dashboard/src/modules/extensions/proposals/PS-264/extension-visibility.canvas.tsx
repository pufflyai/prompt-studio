import { Box } from "@chakra-ui/react";
import type { CanvasMeta } from "@pstdio/canvas";
import { ExtensionsPanelView } from "./extensions-panel-view";

const meta = {
  title: "Proposals/PS-264 Extension visibility and scope",
  description:
    "Separate public/private visibility from project/user installation scope. User extensions are shared across local projects, even when private. Proposed visibility values are explicit synthetic metadata; no publication or permission behavior is implemented. RB 1.A.2, RB 4.A.4, RB 4.A.8.",
  fullscreen: true,
} satisfies CanvasMeta;
export default meta;

export const InstalledExtensions = {
  name: "Installed extensions",
  description:
    "All four combinations are visible in the first four rows. Filter visibility and scope independently, search, toggle an extension, or open its name to inspect installation details. Open My snippets to see private sharing across projects on this computer. Return to Extensions to retain the filters. The frame uses only local state. Marketplace, upgrades and unrelated settings are outside this focused preview.",
  render: () => (
    <Box w="full" h="full" minW="0" bg="bg" color="fg">
      <ExtensionsPanelView />
    </Box>
  ),
};
