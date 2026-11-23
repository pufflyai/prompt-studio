import { Box, Button, HStack, Stack, Text, useSlotRecipe } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { createCanvasExampleNavigator } from "@/docs/canvas-example-navigator";
import { ListRow } from "../list-row/list-row";
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

const SurfaceFeedback = () => {
  const [active, setActive] = useState(true);
  const status = useSlotRecipe({ key: "statusBar" })();
  return (
    <Stack gap="md">
      <Text>
        Existing panels show an outline only when targeted. Panel alignment and insertion marks stay compact and
        borderless. Widget drop indicators retain their original height, using the same floating-panel drop colors.
      </Text>
      <Button onClick={() => setActive((value) => !value)}>{active ? "Show idle" : "Show active"}</Button>
      <HStack gap="lg" align="start">
        <Stack>
          <Text>Drop onto an existing panel</Text>
          <Box position="relative" boxSize="24" layerStyle={active ? "tabDropZone" : undefined} />
          <Text>Widget landing</Text>
          <Box position="relative" boxSize="24" layerStyle="panelDropZone" data-drop-active={active || undefined} />
          <Text>Panel edge</Text>
          <Box
            position="relative"
            w="3"
            h="24"
            data-orientation="vertical"
            layerStyle="panelDropZone"
            data-drop-active={active || undefined}
          />
        </Stack>
        <Stack>
          <Text>Floating panel</Text>
          <Box layerStyle="panelSnapIndicator" data-drop-active={active || undefined} />
          <Text>Bubble</Text>
          <Box layerStyle="panelSnapIndicator" data-drop-surface="bubble" data-drop-active={active || undefined} />
        </Stack>
        <Stack>
          <Text>Status widget</Text>
          <Box position="relative" w="24" h="12">
            <Box css={status.placeholder} w="full" />
          </Box>
          <Text>List insertion</Text>
          <Box position="relative" w="24" h="6">
            <DropIndicator orientation="horizontal" bottom="0" />
          </Box>
          <Text>Selected row</Text>
          <Box layerStyle={active ? "dropTarget" : undefined}>
            <ListRow id="drop-preview" label="Drop into this row" isSelected />
          </Box>
        </Stack>
      </HStack>
    </Stack>
  );
};
const Surfaces: Story = { id: "components-drop-indicator--surfaces", render: SurfaceFeedback };
const Examples = createCanvasExampleNavigator(meta, { Horizontal, Vertical, Surfaces });
const ExamplePage = { name: "Explore", render: () => <Examples /> };

export { ExamplePage as Horizontal };
