import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { ModelSwapSeparator } from "./model-swap-separator";

const meta: Meta<typeof ModelSwapSeparator> = {
  title: "Patterns/Chat/Model Swap Separator",
  component: ModelSwapSeparator,
  parameters: {
    layout: "padded",
  },
};

export default meta;

type Story = StoryObj<typeof ModelSwapSeparator>;

export const Default: Story = {
  render: (args) => (
    <Box maxW="960px" w="full" borderWidth="1px" borderRadius="md" bg="bg" p="md">
      <ModelSwapSeparator {...args} />
    </Box>
  ),
  args: {
    fromModel: "GPT-5.3-Codex",
    toModel: "GPT-5.2",
  },
};
