import { Box } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { PausedExtensionView } from "./paused-extension-view";

const meta = {
  title: "Extensions/Paused extension view",
  component: PausedExtensionView,
  args: { installedExtensionId: "shader", name: "Shader Lab" },
} satisfies CanvasMeta<typeof PausedExtensionView>;
export default meta;
type Story = CanvasFrame<typeof meta>;
// A view in a panel gets the full empty state.
export const Panel: Story = {
  id: "extensions-paused-extension-view--panel",
  decorators: [
    (Story) => (
      <Box h="2xl" w="full" borderWidth="1px" borderColor="border.subtle">
        <Story />
      </Box>
    ),
  ],
};
// A view in a header or status bar shrinks to one line.
export const Chrome: Story = {
  id: "extensions-paused-extension-view--chrome",
  decorators: [
    (Story) => (
      <Box h="10" w="full" borderWidth="1px" borderColor="border.subtle">
        <Story />
      </Box>
    ),
  ],
};
