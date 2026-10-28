import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { DropIndicator } from "./drop-indicator";

const meta = {
  title: "Components/Drop indicator",
  component: DropIndicator,
  render: (args) => (
    <Box position="relative" w="64" h="12" layerStyle="tabDropZone">
      <DropIndicator {...args} />
    </Box>
  ),
} satisfies Meta<typeof DropIndicator>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Horizontal: Story = { args: { orientation: "horizontal", bottom: "0" } };
export const Vertical: Story = { args: { orientation: "vertical", left: "0" } };
