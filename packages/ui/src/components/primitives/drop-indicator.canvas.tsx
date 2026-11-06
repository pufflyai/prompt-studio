import { Box } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { createCanvasExampleNavigator } from "@/docs/canvas-example-navigator";
import { DropIndicator } from "./drop-indicator";

const meta = {
  title: "Design system/Components/Feedback/Drop indicator",
  component: DropIndicator,
  render: (args) => (
    <Box position="relative" w="64" h="12" layerStyle="tabDropZone">
      <DropIndicator {...args} />
    </Box>
  ),
} satisfies CanvasMeta<typeof DropIndicator>;
export default {
  title: "Design system/Components/Feedback/Drop indicator",
  fullscreen: true,
};
type Story = CanvasFrame<typeof meta>;
const Horizontal: Story = {
  id: "components-drop-indicator--horizontal",
  args: { orientation: "horizontal", bottom: "0" },
};
const Vertical: Story = {
  id: "components-drop-indicator--vertical",
  args: { orientation: "vertical", left: "0" },
};

const Examples = createCanvasExampleNavigator(meta, { Horizontal, Vertical });
const ExamplePage = { name: "Explore", render: () => <Examples /> };

export { ExamplePage as Horizontal };
