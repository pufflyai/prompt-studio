import { Box } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { DropIndicator } from "./drop-indicator";

const meta = {
  title: "Components/Drop indicator",
  component: DropIndicator,
  render: (args) => (
    <Box position="relative" w="64" h="12" layerStyle="tabDropZone">
      <DropIndicator {...args} />
    </Box>
  ),
} satisfies CanvasMeta<typeof DropIndicator>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const Horizontal: Story = {
  id: "components-drop-indicator--horizontal",
  args: { orientation: "horizontal", bottom: "0" },
};
export const Vertical: Story = {
  id: "components-drop-indicator--vertical",
  args: { orientation: "vertical", left: "0" },
};
