import { Box } from "@chakra-ui/react";
import type { CanvasMeta } from "@pstdio/canvas";
import { ExtensionsPanelView } from "./extensions-panel-view";

const meta = {
  title: "Proposals/PS-264 Extension author and scope",
  description:
    "Show Me/Prompt Studio authorship alongside This Project/All Projects scope. Enabled extensions and other installed extensions have separate groups, with warnings and load errors beside extension names. Authorship uses explicit sample metadata. RB 1.A.2, RB 4.A.4, RB 4.A.8.",
  fullscreen: true,
} satisfies CanvasMeta;
export default meta;

export const InstalledExtensions = {
  name: "Installed extensions",
  description:
    "The Enabled group shows all four author/scope combinations; Installed contains extensions that are off. Toggle an extension to move it between groups. Open the warning beside Notes or the error beside Release tools to inspect the existing health popovers. Filter author and scope independently, search, or open an extension name for installation details. Returning preserves the filters. All interactions use local state.",
  render: () => (
    <Box w="full" h="full" minW="0" bg="bg" color="fg">
      <ExtensionsPanelView />
    </Box>
  ),
};
