import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { PausedExtensionView } from "./paused-extension-view";

const meta = {
  title: "Extensions/Paused extension view",
  component: PausedExtensionView,
  args: { installedExtensionId: "shader", name: "Shader Lab" },
} satisfies Meta<typeof PausedExtensionView>;
export default meta;
type Story = StoryObj<typeof meta>;

// A view in a panel gets the full empty state.
export const Panel: Story = {
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
  decorators: [
    (Story) => (
      <Box h="10" w="full" borderWidth="1px" borderColor="border.subtle">
        <Story />
      </Box>
    ),
  ],
};
