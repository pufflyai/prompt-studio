import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { ConnectionLost } from "./connection-lost";

const meta: Meta = {
  title: "Sync/ConnectionLost",
  parameters: { layout: "fullscreen" },
};

export default meta;

type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <Box bg="bg" minH="100vh">
      <ConnectionLost />
    </Box>
  ),
};
